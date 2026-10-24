jest.mock("../src/config/database", () => ({ getPool: () => mockPool }));
jest.mock("../src/modules/products/product.service", () => ({
  listProducts: jest.fn(),
  createProduct: jest.fn()
}));

const mockPool = { query: jest.fn() };

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const productService = require("../src/modules/products/product.service");

const jwtSecret = "test-jwt-secret-that-is-long-enough-for-tests";
process.env.JWT_SECRET = jwtSecret;
const demoAuthorization = `Bearer ${jwt.sign({ sub: "42", role: "DEMO" }, jwtSecret)}`;
const adminAuthorization = `Bearer ${jwt.sign({ sub: "1", role: "ADMIN" }, jwtSecret)}`;

const demoUserRow = {
  id: "42",
  first_name: "Visiteur",
  last_name: "Démo",
  email: "demo@gestion-stock.local",
  role_name: "DEMO"
};

describe("mode démonstration", () => {
  beforeEach(() => {
    mockPool.query.mockReset();
    delete process.env.DEMO_LOGIN_ENABLED;
    delete process.env.DEMO_USER_EMAIL;
  });

  describe("lecture seule du rôle DEMO", () => {
    it.each([
      ["POST", "/api/products"],
      ["PATCH", "/api/products/1"],
      ["POST", "/api/sales"],
      ["POST", "/api/receipts"],
      ["POST", "/api/inventory/adjustments"],
      ["POST", "/api/customers"],
      ["POST", "/api/suppliers"]
    ])("refuse %s %s avec un message clair", async (method, path) => {
      const response = await request(app)
        [method.toLowerCase()](path)
        .set("Authorization", demoAuthorization)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("DEMO_READ_ONLY");
      expect(response.body.error.message).toMatch(/lecture seule/);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("autorise la consultation", async () => {
      productService.listProducts.mockResolvedValue([{ id: "1", name: "Stylo" }]);

      const response = await request(app).get("/api/products").set("Authorization", demoAuthorization);

      expect(response.status).toBe(200);
    });

    it("n'affecte pas les autres rôles", async () => {
      productService.createProduct.mockResolvedValue({ id: "1" });

      const response = await request(app)
        .post("/api/products")
        .set("Authorization", adminAuthorization)
        .send({ name: "Stylo", sku: "STY-1", categoryId: 1, baseUnitId: 1 });

      expect(response.status).not.toBe(403);
    });
  });

  describe("connexion en un clic", () => {
    it("annonce que la démo est désactivée par défaut, sans interroger la base", async () => {
      const response = await request(app).get("/api/auth/demo");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("refuse la connexion démo quand elle est désactivée", async () => {
      const response = await request(app).post("/api/auth/demo");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("DEMO_DISABLED");
    });

    it("annonce la démo disponible quand le compte existe", async () => {
      process.env.DEMO_LOGIN_ENABLED = "true";
      mockPool.query.mockResolvedValueOnce({ rows: [demoUserRow] });

      const response = await request(app).get("/api/auth/demo");

      expect(response.body).toEqual({ enabled: true });
    });

    it("annonce la démo indisponible quand le compte n'a pas été créé", async () => {
      process.env.DEMO_LOGIN_ENABLED = "true";
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get("/api/auth/demo");

      expect(response.body).toEqual({ enabled: false });
    });

    it("délivre un jeton DEMO de courte durée", async () => {
      process.env.DEMO_LOGIN_ENABLED = "true";
      mockPool.query.mockResolvedValueOnce({ rows: [demoUserRow] });

      const response = await request(app).post("/api/auth/demo");

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ id: "42", role: "DEMO" });
      const payload = jwt.verify(response.body.token, jwtSecret);
      expect(payload.role).toBe("DEMO");
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(2 * 60 * 60);
    });

    it("ne cherche que des comptes de rôle DEMO actifs", async () => {
      process.env.DEMO_LOGIN_ENABLED = "true";
      process.env.DEMO_USER_EMAIL = "visiteur@exemple.test";
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post("/api/auth/demo");

      expect(response.status).toBe(404);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toMatch(/roles\.name = 'DEMO'/);
      expect(sql).toMatch(/is_active = true/);
      expect(params).toEqual(["visiteur@exemple.test"]);
    });

    it("le jeton démo ouvre la lecture mais pas l'écriture", async () => {
      process.env.DEMO_LOGIN_ENABLED = "true";
      mockPool.query.mockResolvedValueOnce({ rows: [demoUserRow] });
      productService.listProducts.mockResolvedValue([]);
      const login = await request(app).post("/api/auth/demo");
      const authorization = `Bearer ${login.body.token}`;

      const read = await request(app).get("/api/products").set("Authorization", authorization);
      const write = await request(app).post("/api/products").set("Authorization", authorization).send({});

      expect(read.status).toBe(200);
      expect(write.status).toBe(403);
    });
  });
});
