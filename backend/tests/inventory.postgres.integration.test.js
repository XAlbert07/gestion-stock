const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";
const jwtSecret = "isolated-postgres-integration-secret-32-chars";
process.env.JWT_SECRET = jwtSecret;

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { getPool } = require("../src/config/database");

const integrationSuite = enabled ? describe : describe.skip;

integrationSuite("inventory API on isolated PostgreSQL", () => {
  let productId;
  let concurrentProductId;
  let receiptProductId;
  let reportProductId;
  let baseUnitId;
  let integrationUserId;
  let token;

  beforeAll(async () => {
    if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith("_test")) {
      throw new Error("Le test d'intégration exige une base dont le nom se termine par _test.");
    }
    const pool = getPool();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const role = (
      await pool.query(
        "INSERT INTO roles (name) VALUES ('INTEGRATION_ADMIN') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id"
      )
    ).rows[0];
    const user = (
      await pool.query(
        "INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES ($1, 'Test', 'Integration', $2, 'unused') RETURNING id",
        [role.id, `integration-${suffix}@example.invalid`]
      )
    ).rows[0];
    integrationUserId = user.id;
    token = jwt.sign({ sub: String(user.id), role: "ADMIN" }, jwtSecret);
    const category = (
      await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING id", [
        `Integration ${suffix}`
      ])
    ).rows[0];
    const unit = (
      await pool.query("INSERT INTO units (name, symbol) VALUES ($1, $2) RETURNING id", [
        `Pièce integration ${suffix}`,
        `pi${suffix.slice(-6)}`
      ])
    ).rows[0];
    baseUnitId = unit.id;
    const products = await Promise.all(
      ["Opening", "Concurrency", "Receipt", "Report"].map((name) =>
        pool.query(
          "INSERT INTO products (category_id, base_unit_id, name, sku,critical_threshold) VALUES ($1, $2, $3, $4,$5) RETURNING id",
          [
            category.id,
            unit.id,
            `${name} integration ${suffix}`,
            `${name}-${suffix}`,
            name === "Report" ? "5" : "0"
          ]
        )
      )
    );
    productId = products[0].rows[0].id;
    concurrentProductId = products[1].rows[0].id;
    receiptProductId = products[2].rows[0].id;
    reportProductId = products[3].rows[0].id;
  });

  afterAll(async () => {
    if (enabled) await getPool().end();
  });

  it("creates and renames catalogue references and edits a product through the API", async () => {
    const category = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Catégorie ${Date.now()}`, description: "Test d'intégration" });
    expect(category.status).toBe(201);
    const renamedCategory = await request(app)
      .patch(`/api/categories/${category.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Catégorie renommée ${Date.now()}`, description: "Référence mise à jour" });
    expect(renamedCategory.status).toBe(200);

    const unit = await request(app)
      .post("/api/units")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Unité ${Date.now()}`, symbol: `u${Math.floor(Math.random() * 100000)}` });
    expect(unit.status).toBe(201);
    const renamedUnit = await request(app)
      .patch(`/api/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Unité renommée ${Date.now()}`,
        symbol: `r${Math.floor(Math.random() * 100000)}`
      });
    expect(renamedUnit.status).toBe(200);

    const product = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Produit ${Date.now()}`,
        sku: `PRD-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        category_id: category.body.id,
        base_unit_id: unit.body.id,
        description: "Création API",
        critical_threshold: "3"
      });
    expect(product.status).toBe(201);
    const edited = await request(app)
      .patch(`/api/products/${product.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Fiche modifiée", critical_threshold: "5", is_active: false });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      description: "Fiche modifiée",
      critical_threshold: "5.000",
      is_active: false
    });
  });

  it("serves the dashboard, filtered stock state and date/type-filtered movement history", async () => {
    const opening = await request(app)
      .post("/api/inventory/opening-stock")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: reportProductId,
        quantity: "2",
        unit_cost: "100",
        reason: "Test état stock"
      });
    expect(opening.status).toBe(201);

    const low = await request(app)
      .get(`/api/inventory/products?status=LOW&search=Report&page=1&limit=10`)
      .set("Authorization", `Bearer ${token}`);
    expect(low.status).toBe(200);
    expect(low.body.data.map((product) => product.id)).toContain(reportProductId);
    expect(low.body.meta).toMatchObject({ page: 1, limit: 10 });
    expect(low.body.meta.total).toBeGreaterThanOrEqual(1);

    const out = await request(app)
      .get("/api/inventory/products?status=OUT")
      .set("Authorization", `Bearer ${token}`);
    expect(out.body.data.map((product) => product.id)).toContain(concurrentProductId);

    const summary = await request(app)
      .get("/api/inventory/summary")
      .set("Authorization", `Bearer ${token}`);
    expect(summary.status).toBe(200);
    expect(summary.body.low_stock).toBeGreaterThanOrEqual(1);
    expect(summary.body.recent_movements[0].product_id).toBe(reportProductId);

    const today = new Date().toISOString().slice(0, 10);
    const movements = await request(app)
      .get(
        `/api/inventory/products/${reportProductId}/movements?from=${today}&to=${today}&operation_type=OPENING_BALANCE`
      )
      .set("Authorization", `Bearer ${token}`);
    expect(movements.status).toBe(200);
    expect(movements.body).toHaveLength(1);
    const invalidDate = await request(app)
      .get(`/api/inventory/products/${reportProductId}/movements?from=2026-02-31`)
      .set("Authorization", `Bearer ${token}`);
    expect(invalidDate.status).toBe(400);
  });

  it("filters sales by sale date and reports validated totals and physical returns", async () => {
    const pool = getPool();
    const sale = (
      await pool.query(
        "INSERT INTO sales (reference,status,sold_at,created_by,total_amount) VALUES ($1,'COMPLETED','2999-12-01 12:00:00+00',$2,1000) RETURNING id",
        [`REPORT-${Date.now()}-${Math.floor(Math.random() * 100000)}`, integrationUserId]
      )
    ).rows[0];
    const line = (
      await pool.query(
        "INSERT INTO sale_items (sale_id,product_id,unit_id,quantity,conversion_factor,unit_price,cost_at_sale) VALUES ($1,$2,$3,2,1,500,300) RETURNING id",
        [sale.id, reportProductId, baseUnitId]
      )
    ).rows[0];
    const draft = (
      await pool.query(
        "INSERT INTO sales (reference,status,created_at,created_by,total_amount) VALUES ($1,'DRAFT','2999-12-01 09:00:00+00',$2,999) RETURNING id",
        [`DRAFT-${Date.now()}-${Math.floor(Math.random() * 100000)}`, integrationUserId]
      )
    ).rows[0];
    const returned = (
      await pool.query(
        "INSERT INTO sales_returns (sale_id,reference,status,returned_at,created_by) VALUES ($1,$2,'COMPLETED','2999-12-01 15:00:00+00',$3) RETURNING id",
        [sale.id, `RETURN-${Date.now()}-${Math.floor(Math.random() * 100000)}`, integrationUserId]
      )
    ).rows[0];
    await pool.query(
      "INSERT INTO sales_return_items (return_id,sale_item_id,product_id,unit_id,quantity,conversion_factor,unit_price,cost_at_return) VALUES ($1,$2,$3,$4,1,1,500,300)",
      [returned.id, line.id, reportProductId, baseUnitId]
    );

    try {
      const history = await request(app)
        .get("/api/sales?from=2999-12-01&to=2999-12-01")
        .set("Authorization", `Bearer ${token}`);
      expect(history.status).toBe(200);
      expect(history.body.data.map((entry) => entry.id)).toEqual(
        expect.arrayContaining([sale.id, draft.id])
      );

      const report = await request(app)
        .get("/api/sales/report?from=2999-12-01&to=2999-12-01")
        .set("Authorization", `Bearer ${token}`);
      expect(report.status).toBe(200);
      expect(report.body.sales).toMatchObject({ sale_count: 1, sales_total_fcfa: "1000.00" });
      expect(report.body.sold_by_unit).toContainEqual(
        expect.objectContaining({ unit_id: Number(baseUnitId), quantity: "2.000" })
      );
      expect(report.body.returns).toMatchObject({ return_count: 1 });
      expect(report.body.returned_by_unit).toContainEqual(
        expect.objectContaining({ unit_id: Number(baseUnitId), quantity: "1.000" })
      );
    } finally {
      await pool.query("DELETE FROM sales_return_items WHERE return_id=$1", [returned.id]);
      await pool.query("DELETE FROM sales_returns WHERE id=$1", [returned.id]);
      await pool.query("DELETE FROM sale_items WHERE sale_id=$1", [sale.id]);
      await pool.query("DELETE FROM sales WHERE id = ANY($1::bigint[])", [[sale.id, draft.id]]);
    }
  });

  it("completes a supplier receipt once and keeps its history after supplier deactivation", async () => {
    const supplier = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Fournisseur integration ${Date.now()}`, phone: "70000000" });
    expect(supplier.status).toBe(201);

    const receipt = await request(app)
      .post("/api/receipts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplier.body.id,
        reference: `REC-${Date.now()}`,
        notes: "Test PostgreSQL"
      });
    expect(receipt.status).toBe(201);
    expect(receipt.body.status).toBe("DRAFT");

    const item = await request(app)
      .post(`/api/receipts/${receipt.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: receiptProductId,
        unit_id: baseUnitId,
        quantity: "2",
        unit_purchase_price: "500.25"
      });
    expect(item.status).toBe(400);

    const validItem = await request(app)
      .post(`/api/receipts/${receipt.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: receiptProductId,
        unit_id: baseUnitId,
        quantity: "2",
        unit_purchase_price: "500"
      });
    expect(validItem.status).toBe(201);

    const completed = await request(app)
      .post(`/api/receipts/${receipt.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("COMPLETED");

    const duplicate = await request(app)
      .post(`/api/receipts/${receipt.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(duplicate.status).toBe(409);

    const stock = await getPool().query(
      "SELECT current_stock, average_cost FROM products WHERE id = $1",
      [receiptProductId]
    );
    expect(stock.rows[0]).toMatchObject({ current_stock: "2.000", average_cost: "500.00" });

    const deactivated = await request(app)
      .patch(`/api/suppliers/${supplier.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: supplier.body.name,
        phone: "70000000",
        email: "",
        address: "",
        is_active: false
      });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.is_active).toBe(false);
    const newReceiptFromInactiveSupplier = await request(app)
      .post("/api/receipts")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplier_id: supplier.body.id, reference: `REC-INACTIVE-${Date.now()}` });
    expect(newReceiptFromInactiveSupplier.status).toBe(409);
    expect(newReceiptFromInactiveSupplier.body.error.code).toBe("SUPPLIER_NOT_ACTIVE");
    const suppliers = await request(app)
      .get("/api/suppliers?include_inactive=true")
      .set("Authorization", `Bearer ${token}`);
    expect(suppliers.body.find((entry) => entry.id === supplier.body.id)?.is_active).toBe(false);
    const history = await request(app)
      .get(`/api/receipts/${receipt.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(history.body.supplier_name).toBe(supplier.body.name);
  });

  it("initializes, recounts atomically, values additions and rejects duplicate opening stock", async () => {
    const opening = await request(app)
      .post("/api/inventory/opening-stock")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: productId,
        quantity: "10",
        unit_cost: "1200",
        reason: "Inventaire initial"
      });

    expect(opening.status).toBe(201);
    expect(opening.body.currentStock).toBe("10.000");
    expect(opening.body.averageCost).toBe("1200.00");

    const cancelOpening = await request(app)
      .post(`/api/inventory/operations/${opening.body.operationId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Tentative d'annulation" });
    expect(cancelOpening.status).toBe(409);
    expect(cancelOpening.body.error.code).toBe("OPENING_BALANCE_CANNOT_BE_CANCELLED");

    const duplicate = await request(app)
      .post("/api/inventory/opening-stock")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, quantity: "10", unit_cost: "1200", reason: "Double saisie" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("STOCK_ALREADY_INITIALIZED");

    const increase = await request(app)
      .post("/api/inventory/counts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: productId,
        quantity: "12",
        unit_cost: "1500",
        reason: "Écart positif inventaire"
      });
    expect(increase.status).toBe(201);
    expect(increase.body.currentStock).toBe("12.000");
    expect(increase.body.averageCost).toBe("1250.00");

    const cancelCount = await request(app)
      .post(`/api/inventory/operations/${increase.body.operationId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Tentative d'annulation comptage" });
    expect(cancelCount.status).toBe(409);
    expect(cancelCount.body.error.code).toBe("STOCK_COUNT_CANNOT_BE_CANCELLED");

    const decrease = await request(app)
      .post("/api/inventory/counts")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, quantity: "9.5", reason: "Casse constatée" });
    expect(decrease.status).toBe(201);
    expect(decrease.body.direction).toBe("OUT");
    expect(decrease.body.currentStock).toBe("9.500");
    expect(decrease.body.averageCost).toBe("1250.00");

    const sameCount = await request(app)
      .post("/api/inventory/counts")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, quantity: "9.5", reason: "Comptage identique" });
    expect(sameCount.status).toBe(409);
    expect(sameCount.body.error.code).toBe("NO_STOCK_CHANGE");

    const overshoot = await request(app)
      .post("/api/inventory/adjustments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: productId,
        direction: "OUT",
        quantity: "10",
        reason: "Sortie supérieure au disponible"
      });
    expect(overshoot.status).toBe(409);
    expect(overshoot.body.error.code).toBe("INSUFFICIENT_STOCK");

    const movements = await request(app)
      .get(`/api/inventory/products/${productId}/movements?limit=50`)
      .set("Authorization", `Bearer ${token}`);
    expect(movements.status).toBe(200);
    expect(movements.body.map((movement) => movement.operation_type)).toEqual(
      expect.arrayContaining(["OPENING_BALANCE", "ADJUSTMENT"])
    );

    const history = await getPool().query(
      "SELECT count(*)::int AS movements FROM stock_movements WHERE product_id = $1",
      [productId]
    );
    expect(history.rows[0].movements).toBe(3);
  });

  it("applies the active customer-type tariff and rounds each sale line to whole FCFA", async () => {
    const type = await request(app)
      .post("/api/customers/types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Type tarif ${Date.now()}` });
    expect(type.status).toBe(201);

    const price = await request(app)
      .post(`/api/products/${productId}/prices`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_type_id: type.body.id, unit_id: baseUnitId, price: "101" });
    expect(price.status).toBe(201);
    const fractional = await request(app)
      .post(`/api/products/${productId}/prices`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_type_id: type.body.id, unit_id: baseUnitId, price: "101.25" });
    expect(fractional.status).toBe(400);

    const replacementPrice = await request(app)
      .post(`/api/products/${productId}/prices`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_type_id: type.body.id, unit_id: baseUnitId, price: "499" });
    expect(replacementPrice.status).toBe(201);
    const history = await request(app)
      .get(`/api/products/${productId}/prices`)
      .set("Authorization", `Bearer ${token}`);
    expect(history.body).toHaveLength(2);
    expect(history.body.filter((entry) => entry.is_active)).toHaveLength(1);
    const resolved = await request(app)
      .get(
        `/api/products/${productId}/price?customer_type_id=${type.body.id}&unit_id=${baseUnitId}`
      )
      .set("Authorization", `Bearer ${token}`);
    expect(resolved.body.price).toBe("499.00");

    const sale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_type_id: type.body.id, reference: `SALE-${Date.now()}` });
    expect(sale.status).toBe(201);

    const line = await request(app)
      .post(`/api/sales/${sale.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, unit_id: baseUnitId, quantity: "0.005", unit_price: "1" });
    expect(line.status).toBe(201);
    expect(line.body.unit_price).toBe("499.00");
    expect(line.body.line_total).toBe("2.50");

    const completed = await request(app)
      .post(`/api/sales/${sale.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(200);
    expect(completed.body.total_amount).toBe("2.00");
  });

  it("serializes concurrent initial-stock submissions so only one is accepted", async () => {
    const submit = () =>
      request(app)
        .post("/api/inventory/opening-stock")
        .set("Authorization", `Bearer ${token}`)
        .send({
          product_id: concurrentProductId,
          quantity: "4",
          unit_cost: "500",
          reason: "Stock départ"
        });
    const results = await Promise.all([submit(), submit()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);

    const product = await getPool().query("SELECT current_stock FROM products WHERE id = $1", [
      concurrentProductId
    ]);
    const count = () =>
      request(app).post("/api/inventory/counts").set("Authorization", `Bearer ${token}`).send({
        product_id: concurrentProductId,
        quantity: "6",
        unit_cost: "600",
        reason: "Comptage concurrent"
      });
    const countResults = await Promise.all([count(), count()]);
    expect(countResults.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      Number(
        (
          await getPool().query("SELECT current_stock FROM products WHERE id = $1", [
            concurrentProductId
          ])
        ).rows[0].current_stock
      )
    ).toBe(6);
    expect(product.rows[0].current_stock).toBe("4.000");
  });
});
