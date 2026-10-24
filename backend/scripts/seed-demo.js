const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");
const { getDatabaseConfig } = require("../src/config/environment");

// Tables métier vidées par --reset (les comptes utilisateurs sont conservés).
const BUSINESS_TABLES = [
  "sales_return_items",
  "sales_returns",
  "sale_items",
  "sales",
  "stock_receipt_items",
  "stock_receipts",
  "stock_adjustments",
  "stock_movements",
  "stock_operation_items",
  "stock_operations",
  "supplier_products",
  "product_prices",
  "product_units",
  "products",
  "customers",
  "customer_types",
  "suppliers",
  "units",
  "categories"
];

const args = new Set(process.argv.slice(2));
const ifEmpty = args.has("--if-empty");
const reset = args.has("--reset");
const confirmed = args.has("--yes");

async function run() {
  // Mode démarrage automatique : n'agit que si SEED_DEMO=true est défini.
  if (ifEmpty && process.env.SEED_DEMO !== "true") {
    console.log("Seed démo ignoré (SEED_DEMO n'est pas à « true »).");
    return;
  }

  if (reset && !confirmed) {
    throw new Error(
      "--reset efface toutes les données métier (produits, ventes, clients...). " +
        "Ajoutez --yes pour confirmer."
    );
  }

  const client = new Client(getDatabaseConfig());
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT (SELECT count(*)::int FROM products) AS products, (SELECT count(*)::int FROM users) AS users"
    );

    if (rows[0].users === 0) {
      throw new Error("Aucun utilisateur : créez d'abord l'administrateur (npm run bootstrap:admin).");
    }

    if (rows[0].products > 0 && !reset) {
      console.log(
        "La base contient déjà des produits : seed démo ignoré. " +
          "Utilisez --reset --yes pour tout remplacer."
      );
      return;
    }

    const sql = await fs.readFile(path.resolve(__dirname, "../seeds/002_demo_boutique.sql"), "utf8");

    await client.query("BEGIN");
    try {
      if (reset) {
        await client.query(`TRUNCATE ${BUSINESS_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
      }
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    console.log("Données de démonstration (boutique générale) appliquées.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Échec du seed démo :", error.message);
  process.exitCode = 1;
});
