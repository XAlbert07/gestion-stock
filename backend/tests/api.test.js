jest.mock("../src/modules/products/product.service", () => ({
  listProducts: jest.fn(),
  createProduct: jest.fn()
}));
jest.mock("../src/config/database", () => ({ getPool: () => mockPool }));

const mockPool = { query: jest.fn() };

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const productService = require("../src/modules/products/product.service");
const { getPool } = require("../src/config/database");
const jwtSecret = "test-jwt-secret-that-is-long-enough-for-tests";
process.env.JWT_SECRET = jwtSecret;
const authorization = `Bearer ${jwt.sign({ sub: "test-admin", role: "ADMIN" }, jwtSecret)}`;

describe("API", () => {
  it("retourne l'état de santé", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("distingue la disponibilité de l'API de celle de PostgreSQL", async () => {
    const query = getPool().query;
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const ready = await request(app).get("/api/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: "ok", dependencies: { postgres: "ok" } });

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValueOnce(new Error("database unavailable"));
    const unavailable = await request(app).get("/api/health/ready");
    consoleError.mockRestore();
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ status: "unavailable" });
  });

  it("retourne une erreur JSON pour une route inconnue", async () => {
    const response = await request(app).get("/api/inconnue");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("liste les produits authentifié sans utiliser la base de développement", async () => {
    productService.listProducts.mockResolvedValue([{ id: "1", name: "Stylo", sku: "STY-001" }]);

    const response = await request(app).get("/api/products").set("Authorization", authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "1", name: "Stylo", sku: "STY-001" }]);
    expect(productService.listProducts).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      search: "",
      categoryId: null,
      includeInactive: false
    });
  });

  it("ne divulgue pas une erreur interne", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    productService.listProducts.mockRejectedValue(new Error("connexion PostgreSQL refusée"));

    const response = await request(app).get("/api/products").set("Authorization", authorization);

    consoleError.mockRestore();

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Une erreur interne est survenue."
      }
    });
  });

  it("refuse la création d'un produit invalide avant tout accès à la base", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", authorization)
      .send({ name: "", sku: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(productService.createProduct).not.toHaveBeenCalled();
  });

  it("refuse un tarif fractionnaire: les prix de vente sont exprimés en FCFA entiers", async () => {
    const response = await request(app)
      .post("/api/products/1/prices")
      .set("Authorization", authorization)
      .send({ customer_type_id: 1, unit_id: 1, price: "12.50" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuse une ligne de vente sans type de client", async () => {
    const response = await request(app)
      .post("/api/sales")
      .set("Authorization", authorization)
      .send({ reference: "SALE-1" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("valide les filtres de vente avant toute requête métier", async () => {
    const response = await request(app)
      .get("/api/sales?from=2026-02-31&to=2026-03-01")
      .set("Authorization", authorization);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("valide et crée un produit avec sa catégorie, son unité et son seuil", async () => {
    productService.createProduct.mockResolvedValue({ id: "4", name: "Eau", sku: "EAU-001" });

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", authorization)
      .send({
        name: " Eau ",
        sku: " EAU-001 ",
        category_id: "2",
        base_unit_id: "3",
        description: "Eau minérale",
        critical_threshold: "5"
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "4", name: "Eau", sku: "EAU-001" });
    expect(productService.createProduct).toHaveBeenCalledWith({
      name: "Eau",
      sku: "EAU-001",
      categoryId: 2,
      baseUnitId: 3,
      description: "Eau minérale",
      criticalThreshold: "5"
    });
  });

  it.each([
    ["GET", "/api/categories"],
    ["POST", "/api/categories"],
    ["GET", "/api/units"],
    ["GET", "/api/products"],
    ["POST", "/api/products"],
    ["GET", "/api/products/1/units"],
    ["GET", "/api/inventory/products/1/stock"],
    ["POST", "/api/inventory/adjustments"],
    ["POST", "/api/inventory/opening-stock"],
    ["POST", "/api/inventory/counts"],
    ["GET", "/api/suppliers"],
    ["POST", "/api/suppliers"],
    ["PATCH", "/api/suppliers/1"],
    ["GET", "/api/receipts"],
    ["POST", "/api/receipts"],
    ["GET", "/api/customers"],
    ["POST", "/api/customers"],
    ["GET", "/api/sales"],
    ["POST", "/api/sales"],
    ["POST", "/api/sales/1/returns"]
  ])("protège %s %s sans authentification", async (method, path) => {
    const response = await request(app)[method.toLowerCase()](path).send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("laisse la connexion publique et valide le corps de requête", async () => {
    const response = await request(app).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("limite les tentatives de connexion et renvoie une erreur JSON", async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => request(app).post("/api/auth/login").send({}))
    );
    const limited = responses.find((response) => response.status === 429);

    expect(limited).toBeDefined();
    expect(limited.body.error.code).toBe("LOGIN_RATE_LIMITED");
    expect(limited.headers["ratelimit"]).toBeDefined();
  });
});
