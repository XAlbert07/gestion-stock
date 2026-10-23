const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const { getDatabaseConfig } = require("../src/config/environment");

const required = ["ADMIN_FIRST_NAME", "ADMIN_LAST_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"];

async function run() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(`Variables administrateur manquantes : ${missing.join(", ")}`);
  if (process.env.ADMIN_PASSWORD.length < 12)
    throw new Error("ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  const client = new Client(getDatabaseConfig());
  await client.connect();
  try {
    await client.query("BEGIN");
    const role = (
      await client.query(
        "INSERT INTO roles (name) VALUES ('ADMIN') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        []
      )
    ).rows[0];
    const existing = (
      await client.query("SELECT id FROM users WHERE lower(email) = lower($1)", [
        process.env.ADMIN_EMAIL
      ])
    ).rows[0];
    if (existing) {
      await client.query("COMMIT");
      console.log("Administrateur déjà présent.");
      return;
    }
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await client.query(
      "INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5)",
      [
        role.id,
        process.env.ADMIN_FIRST_NAME,
        process.env.ADMIN_LAST_NAME,
        process.env.ADMIN_EMAIL,
        passwordHash
      ]
    );
    await client.query("COMMIT");
    console.log("Administrateur créé.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Échec de création de l'administrateur :", error.message);
  process.exitCode = 1;
});
