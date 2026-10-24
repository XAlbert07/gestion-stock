const baseEnv = {
  DB_HOST: "db.exemple.test",
  DB_NAME: "gestion",
  DB_USER: "app",
  DB_PASSWORD: "secret"
};

describe("configuration PostgreSQL", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    Object.assign(process.env, baseEnv);
    delete process.env.DB_SSL;
    delete process.env.DB_PORT;
  });

  afterAll(() => {
    process.env = saved;
  });

  function loadConfig() {
    return require("../src/config/environment").getDatabaseConfig();
  }

  it("n'active pas SSL par défaut (base locale)", () => {
    const config = loadConfig();

    expect(config).toEqual({
      host: "db.exemple.test",
      database: "gestion",
      user: "app",
      password: "secret",
      port: 5432
    });
    expect(config).not.toHaveProperty("ssl");
  });

  it("active SSL avec vérification du certificat quand DB_SSL=true", () => {
    process.env.DB_SSL = "true";

    expect(loadConfig().ssl).toEqual({ rejectUnauthorized: true });
  });

  it("accepte DB_SSL=TRUE (casse ignorée) et DB_SSL=false", () => {
    process.env.DB_SSL = "TRUE";
    expect(loadConfig().ssl).toEqual({ rejectUnauthorized: true });

    process.env.DB_SSL = "false";
    expect(loadConfig()).not.toHaveProperty("ssl");
  });

  it("refuse une valeur ambiguë plutôt que de se connecter sans chiffrement", () => {
    process.env.DB_SSL = "1";

    expect(loadConfig).toThrow("DB_SSL doit valoir true ou false.");
  });

  it("est validée au démarrage avec le reste de l'environnement", () => {
    process.env.DB_SSL = "oui";
    process.env.JWT_SECRET = "x".repeat(40);

    expect(() => require("../src/config/environment").validateEnvironment()).toThrow("DB_SSL");
  });
});

describe("pool PostgreSQL", () => {
  const saved = { ...process.env };

  afterAll(() => {
    process.env = saved;
  });

  it("transmet SSL, borne l'attente de connexion et journalise les coupures", () => {
    jest.resetModules();
    Object.assign(process.env, baseEnv, { DB_SSL: "true" });

    const handlers = {};
    const Pool = jest.fn(() => ({ on: (event, handler) => (handlers[event] = handler) }));
    jest.doMock("pg", () => ({ Pool }));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const { getPool } = require("../src/config/database");
    const pool = getPool();

    expect(getPool()).toBe(pool);
    expect(Pool).toHaveBeenCalledTimes(1);
    expect(Pool.mock.calls[0][0]).toMatchObject({
      host: "db.exemple.test",
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 15000
    });

    expect(() => handlers.error(new Error("terminating connection"))).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Connexion PostgreSQL inactive interrompue :",
      "terminating connection"
    );

    consoleError.mockRestore();
    jest.dontMock("pg");
  });
});
