const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");
const { getDatabaseConfig } = require("../src/config/environment");

const migrationsDirectory = path.resolve(__dirname, "../migrations");
const initialSchemaTables = [
  "categories",
  "customer_types",
  "customers",
  "product_prices",
  "product_units",
  "products",
  "roles",
  "sale_items",
  "sales",
  "sales_return_items",
  "sales_returns",
  "stock_adjustments",
  "stock_movements",
  "stock_operation_items",
  "stock_operations",
  "stock_receipt_items",
  "stock_receipts",
  "supplier_products",
  "suppliers",
  "units",
  "users"
];

async function hasExistingInitialSchema(client, file) {
  if (file !== "001_initial_schema.sql") {
    return false;
  }

  const result = await client.query(
    "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
    [initialSchemaTables]
  );

  return result.rows[0].count === initialSchemaTables.length;
}

async function run() {
  const client = new Client(getDatabaseConfig());
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    const files = (await fs.readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const applied = await client.query("SELECT name FROM public.schema_migrations");
    const appliedNames = new Set(applied.rows.map((row) => row.name));

    for (const file of files) {
      if (appliedNames.has(file)) {
        continue;
      }

      if (await hasExistingInitialSchema(client, file)) {
        await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [file]);
        console.log(`Migration enregistrée comme référence existante : ${file}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Migration appliquée : ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Échec de migration :", error.message);
  process.exitCode = 1;
});
