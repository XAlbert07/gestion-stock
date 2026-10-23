const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const requiredDatabaseVariables = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];

function getDatabaseConfig() {
  const missing = requiredDatabaseVariables.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Configuration PostgreSQL incomplète : ${missing.join(", ")}. Copiez .env.example vers .env et renseignez les valeurs.`
    );
  }

  const port = Number(process.env.DB_PORT || 5432);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("DB_PORT doit être un numéro de port valide.");
  }

  return {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port
  };
}

function getTrustProxyHops() {
  const raw = process.env.TRUST_PROXY_HOPS;
  const hops = raw === undefined || raw === "" ? 0 : Number(raw);

  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error("TRUST_PROXY_HOPS doit être un entier positif ou nul.");
  }

  return hops;
}

function validateEnvironment() {
  getDatabaseConfig();
  getTrustProxyHops();
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET est requis et doit contenir au moins 32 caractères.");
  }
}

module.exports = {
  getDatabaseConfig,
  getTrustProxyHops,
  validateEnvironment
};
