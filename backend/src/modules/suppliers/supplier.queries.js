const { getPool } = require("../../config/database");
async function findAll({ includeInactive = false } = {}) {
  return (
    await getPool().query(
      `SELECT * FROM suppliers ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY name`
    )
  ).rows;
}
async function insert(value) {
  return (
    await getPool().query(
      "INSERT INTO suppliers (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING *",
      [value.name, value.phone, value.email, value.address]
    )
  ).rows[0];
}
async function update(id, value) {
  return (
    await getPool().query(
      "UPDATE suppliers SET name = $1, phone = $2, email = $3, address = $4, is_active = $5, updated_at = now() WHERE id = $6 RETURNING *",
      [value.name, value.phone, value.email, value.address, value.isActive, id]
    )
  ).rows[0];
}
module.exports = { findAll, insert, update };
