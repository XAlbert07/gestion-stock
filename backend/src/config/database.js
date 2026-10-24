const { Pool } = require("pg");
const { getDatabaseConfig } = require("./environment");

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      ...getDatabaseConfig(),
      // Une base serverless (Neon) se met en veille puis redémarre : on laisse le temps
      // à la première connexion, mais on ne reste jamais bloqué indéfiniment.
      connectionTimeoutMillis: 15000,
      keepAlive: true
    });

    // Sans écouteur, la coupure d'une connexion inactive (redémarrage ou maintenance de
    // la base) ferait tomber tout le processus : on la journalise, le pool se reconnecte.
    pool.on("error", (error) => {
      console.error("Connexion PostgreSQL inactive interrompue :", error.message);
    });
  }

  return pool;
}

module.exports = { getPool };
