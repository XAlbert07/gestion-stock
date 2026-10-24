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

// Ne retourne que des comptes dont le rôle est DEMO et qui sont actifs : l'entrée
// « démo » ne peut jamais produire un jeton d'un autre rôle, même si l'adresse
// configurée correspondait par erreur à un compte réel.
async function findDemoUser(email) {
  return (
    await getPool().query(
      "SELECT users.id, users.first_name, users.last_name, users.email, roles.name AS role_name FROM users JOIN roles ON roles.id = users.role_id WHERE lower(users.email) = lower($1) AND roles.name = 'DEMO' AND users.is_active = true",
      [email]
    )
  ).rows[0];
}

module.exports = { findByEmail, findPublicById, findDemoUser };
