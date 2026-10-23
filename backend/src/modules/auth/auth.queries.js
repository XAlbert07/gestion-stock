const { getPool } = require("../../config/database");

async function findByEmail(email) {
  return (
    await getPool().query(
      "SELECT users.*, roles.name AS role_name FROM users JOIN roles ON roles.id = users.role_id WHERE lower(users.email) = lower($1)",
      [email]
    )
  ).rows[0];
}

async function findPublicById(id) {
  return (
    await getPool().query(
      "SELECT users.id, users.first_name, users.last_name, users.email, users.is_active, roles.name AS role FROM users JOIN roles ON roles.id = users.role_id WHERE users.id = $1",
      [id]
    )
  ).rows[0];
}

module.exports = { findByEmail, findPublicById };
