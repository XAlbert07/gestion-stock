const { getPool } = require("../../config/database");
async function all(filters) {
  const values = [];
  const conditions = [];
  if (filters.from) {
    values.push(filters.from);
    conditions.push(
      `COALESCE(sales.sold_at, sales.created_at) >= ($${values.length}::date AT TIME ZONE 'Africa/Ouagadougou')`
    );
  }
  if (filters.to) {
    values.push(filters.to);
    conditions.push(
      `COALESCE(sales.sold_at, sales.created_at) < (($${values.length}::date + interval '1 day') AT TIME ZONE 'Africa/Ouagadougou')`
    );
  }
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`sales.status = $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(sales.reference ILIKE $${values.length} OR customers.name ILIKE $${values.length})`
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.limit;
  const pool = getPool();
  const count = await pool.query(
    `SELECT count(*)::int AS total FROM sales
     LEFT JOIN customers ON customers.id = sales.customer_id
     ${where}`,
    values
  );
  const pageValues = [...values, filters.limit, offset];
  const result = await pool.query(
    `SELECT sales.*, customers.name AS customer_name, customer_types.name AS customer_type_name
     FROM sales
     LEFT JOIN customers ON customers.id = sales.customer_id
     LEFT JOIN customer_types ON customer_types.id = COALESCE(sales.customer_type_id, customers.customer_type_id)
     ${where}
     ORDER BY COALESCE(sales.sold_at, sales.created_at) DESC, sales.id DESC
     LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues
  );
  return {
    data: result.rows,
    total: count.rows[0].total,
    page: filters.page,
    limit: filters.limit
  };
}
async function report({ from, to }) {
  const pool = getPool();
  const start = "($1::date AT TIME ZONE 'Africa/Ouagadougou')";
  const end = "(($2::date + interval '1 day') AT TIME ZONE 'Africa/Ouagadougou')";
  const sales = await pool.query(
    `SELECT count(*)::int AS sale_count, COALESCE(sum(total_amount), 0)::text AS sales_total_fcfa
     FROM sales WHERE status='COMPLETED' AND sold_at >= ${start} AND sold_at < ${end}`,
    [from, to]
  );
  const returns = await pool.query(
    `SELECT count(DISTINCT sr.id)::int AS return_count,
       COALESCE(sum(sri.quantity), 0)::text AS quantity_returned,
       COALESCE(sum(round(sri.quantity * sri.unit_price, 0)), 0)::text AS returned_items_value_fcfa
     FROM sales_returns sr LEFT JOIN sales_return_items sri ON sri.return_id=sr.id
     WHERE sr.status='COMPLETED' AND sr.returned_at >= ${start} AND sr.returned_at < ${end}`,
    [from, to]
  );
  const quantities = await pool.query(
    `SELECT COALESCE(json_agg(json_build_object('unit_id', totals.unit_id, 'unit_name', units.name,
       'unit_symbol', units.symbol, 'quantity', totals.quantity) ORDER BY units.name), '[]'::json) AS sold_by_unit
     FROM (SELECT si.unit_id, sum(si.quantity)::text AS quantity FROM sales s
       JOIN sale_items si ON si.sale_id=s.id
       WHERE s.status='COMPLETED' AND s.sold_at >= ${start} AND s.sold_at < ${end}
       GROUP BY si.unit_id) totals JOIN units ON units.id=totals.unit_id`,
    [from, to]
  );
  const returnedQuantities = await pool.query(
    `SELECT COALESCE(json_agg(json_build_object('unit_id', totals.unit_id, 'unit_name', units.name,
       'unit_symbol', units.symbol, 'quantity', totals.quantity) ORDER BY units.name), '[]'::json) AS returned_by_unit
     FROM (SELECT sri.unit_id, sum(sri.quantity)::text AS quantity FROM sales_returns sr
       JOIN sales_return_items sri ON sri.return_id=sr.id
       WHERE sr.status='COMPLETED' AND sr.returned_at >= ${start} AND sr.returned_at < ${end}
       GROUP BY sri.unit_id) totals JOIN units ON units.id=totals.unit_id`,
    [from, to]
  );
  return {
    sales: sales.rows[0],
    returns: returns.rows[0],
    sold_by_unit: quantities.rows[0].sold_by_unit,
    returned_by_unit: returnedQuantities.rows[0].returned_by_unit,
    timezone: "Africa/Ouagadougou",
    from,
    to
  };
}
async function one(id) {
  return (
    await getPool().query(
      "SELECT sales.*,customers.name AS customer_name,customer_types.name AS customer_type_name FROM sales LEFT JOIN customers ON customers.id=sales.customer_id LEFT JOIN customer_types ON customer_types.id=COALESCE(sales.customer_type_id,customers.customer_type_id) WHERE sales.id=$1",
      [id]
    )
  ).rows[0];
}
async function items(id) {
  return (
    await getPool().query(
      "SELECT sale_items.*,products.name AS product_name FROM sale_items JOIN products ON products.id=sale_items.product_id WHERE sale_id=$1 ORDER BY id",
      [id]
    )
  ).rows;
}
async function create(v) {
  return (
    await getPool().query(
      "INSERT INTO sales (customer_id,customer_type_id,reference,created_by) SELECT $1::bigint,$2::bigint,$3::varchar,$4::bigint WHERE $1::bigint IS NULL OR EXISTS (SELECT 1 FROM customers WHERE id=$1::bigint AND customer_type_id=$2::bigint AND is_active=true) RETURNING *",
      [v.customerId, v.customerTypeId, v.reference, v.createdBy]
    )
  ).rows[0];
}
async function add(saleId, item) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const sale = (
      await c.query(
        "SELECT sales.status,COALESCE(sales.customer_type_id,customers.customer_type_id) AS customer_type_id FROM sales LEFT JOIN customers ON customers.id=sales.customer_id WHERE sales.id=$1 FOR UPDATE OF sales",
        [saleId]
      )
    ).rows[0];
    if (!sale) return null;
    if (sale.status !== "DRAFT") {
      const e = new Error("SALE_NOT_DRAFT");
      e.code = e.message;
      throw e;
    }
    if (!sale.customer_type_id) {
      const e = new Error("SALE_CUSTOMER_TYPE_REQUIRED");
      e.code = e.message;
      throw e;
    }
    const p = (
      await c.query("SELECT base_unit_id,average_cost,is_active FROM products WHERE id=$1", [
        item.productId
      ])
    ).rows[0];
    if (!p || !p.is_active) {
      const e = new Error("INVALID_PRODUCT");
      e.code = e.message;
      throw e;
    }
    const factor =
      item.unitId === Number(p.base_unit_id)
        ? "1"
        : (
            await c.query(
              "SELECT conversion_factor FROM product_units WHERE product_id=$1 AND unit_id=$2",
              [item.productId, item.unitId]
            )
          ).rows[0]?.conversion_factor;
    if (!factor) {
      const e = new Error("INVALID_PRODUCT_UNIT");
      e.code = e.message;
      throw e;
    }
    const priceRow = (
      await c.query(
        "SELECT price FROM product_prices WHERE product_id=$1 AND customer_type_id=$2 AND unit_id=$3 AND is_active=true",
        [item.productId, sale.customer_type_id, item.unitId]
      )
    ).rows[0];
    if (!priceRow) {
      const e = new Error("PRICE_NOT_FOUND");
      e.code = e.message;
      throw e;
    }
    if (!/^\d+(?:\.0{1,2})?$/.test(String(priceRow.price))) {
      const e = new Error("PRICE_NOT_WHOLE_FCFA");
      e.code = e.message;
      throw e;
    }
    const r = (
      await c.query(
        "INSERT INTO sale_items (sale_id,product_id,unit_id,quantity,conversion_factor,unit_price,cost_at_sale) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [saleId, item.productId, item.unitId, item.quantity, factor, priceRow.price, p.average_cost]
      )
    ).rows[0];
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function complete(saleId, userId) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const sale = (await c.query("SELECT * FROM sales WHERE id=$1 FOR UPDATE", [saleId])).rows[0];
    if (!sale) return null;
    if (sale.status !== "DRAFT") {
      const e = new Error("SALE_NOT_DRAFT");
      e.code = e.message;
      throw e;
    }
    const lines = (
      await c.query("SELECT * FROM sale_items WHERE sale_id=$1 ORDER BY product_id", [saleId])
    ).rows;
    if (!lines.length) {
      const e = new Error("SALE_EMPTY");
      e.code = e.message;
      throw e;
    }
    const op = (
      await c.query(
        "INSERT INTO stock_operations (operation_type,created_by,notes) VALUES ('SALE',$1,$2) RETURNING *",
        [userId, `Vente ${sale.reference}`]
      )
    ).rows[0];
    for (const line of lines) {
      const p = (
        await c.query("SELECT current_stock FROM products WHERE id=$1 FOR UPDATE", [
          line.product_id
        ])
      ).rows[0];
      if (Number(p.current_stock) < Number(line.base_quantity)) {
        const e = new Error("INSUFFICIENT_STOCK");
        e.code = e.message;
        throw e;
      }
      const oi = (
        await c.query(
          "INSERT INTO stock_operation_items (operation_id,product_id,unit_id,direction,quantity,conversion_factor) VALUES ($1,$2,$3,'OUT',$4,$5) RETURNING *",
          [op.id, line.product_id, line.unit_id, line.quantity, line.conversion_factor]
        )
      ).rows[0];
      await c.query(
        "INSERT INTO stock_movements (operation_item_id,product_id,direction,base_quantity) VALUES ($1,$2,'OUT',$3)",
        [oi.id, line.product_id, oi.base_quantity]
      );
      await c.query("UPDATE products SET current_stock=current_stock-$1 WHERE id=$2", [
        oi.base_quantity,
        line.product_id
      ]);
    }
    const completed = (
      await c.query(
        "UPDATE sales SET status='COMPLETED',operation_id=$1,sold_at=now(),total_amount=(SELECT COALESCE(sum(round(quantity * unit_price,0)),0) FROM sale_items WHERE sale_id=$2) WHERE id=$2 RETURNING *",
        [op.id, saleId]
      )
    ).rows[0];
    await c.query("COMMIT");
    return completed;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
module.exports = { all, report, one, items, create, add, complete };
