const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const { getDatabaseConfig } = require("../src/config/environment");
const { DEMO_ROLE, isDemoEnabled, getDemoEmail } = require("../src/config/demo");

// Crée le compte « visiteur » en lecture seule, utilisé par le bouton « Explorer la démo ».
// Son mot de passe est aléatoire et jamais affiché : on n'y accède que par ce bouton.
async function run() {
  if (!isDemoEnabled()) {
    console.log("Compte démo ignoré (DEMO_LOGIN_ENABLED n'est pas à « true »).");
    return;
  }

  const email = getDemoEmail();
  const client = new Client(getDatabaseConfig());
  await client.connect();
  try {
    await client.query("BEGIN");
    const role = (
      await client.query(
        "INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        [DEMO_ROLE]
      )
    ).rows[0];

    const existing = (
      await client.query(
        "SELECT users.id, roles.name AS role_name FROM users JOIN roles ON roles.id = users.role_id WHERE lower(users.email) = lower($1)",
        [email]
      )
    ).rows[0];

    if (existing) {
      await client.query("COMMIT");
      if (existing.role_name !== DEMO_ROLE) {
        throw new Error(
          `L'adresse ${email} appartient déjà à un compte « ${existing.role_name} ». ` +
            "Choisissez une autre valeur pour DEMO_USER_EMAIL."
        );
      }
      console.log("Compte démo déjà présent.");
      return;
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    await client.query(
      "INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES ($1, 'Visiteur', 'Démo', $2, $3)",
      [role.id, email, passwordHash]
    );
    await client.query("COMMIT");
    console.log("Compte démo créé.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Échec de création du compte démo :", error.message);
  process.exitCode = 1;
});
