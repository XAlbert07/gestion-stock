const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");
const { getDatabaseConfig } = require("../src/config/environment");

async function run() {
  const client = new Client(getDatabaseConfig());
  const seedPath = path.resolve(__dirname, "../seeds/001_demo.sql");
  const sql = await fs.readFile(seedPath, "utf8");

  await client.connect();
  try {
    await client.query(sql);
    console.log("Données de démonstration appliquées.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Échec du seed :", error.message);
  process.exitCode = 1;
});
