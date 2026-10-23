const { Pool } = require("pg");
const { getDatabaseConfig } = require("./environment");

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool(getDatabaseConfig());
  }

  return pool;
}

module.exports = { getPool };
