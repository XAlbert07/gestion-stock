const { getPool } = require("../../config/database");

async function findCategories() {
  return (await getPool().query("SELECT * FROM categories ORDER BY name ASC")).rows;
}
async function findUnits() {
  return (await getPool().query("SELECT * FROM units ORDER BY name ASC")).rows;
}
async function insertCategory(category) {
  return (
    await getPool().query(
      "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *",
      [category.name, category.description]
    )
  ).rows[0];
}
async function insertUnit(unit) {
  return (
    await getPool().query("INSERT INTO units (name, symbol) VALUES ($1, $2) RETURNING *", [
      unit.name,
      unit.symbol
    ])
  ).rows[0];
}

async function updateCategory(id, category) {
  return (
    await getPool().query(
      "UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *",
      [category.name, category.description, id]
    )
  ).rows[0];
}

async function updateUnit(id, unit) {
  return (
    await getPool().query("UPDATE units SET name = $1, symbol = $2 WHERE id = $3 RETURNING *", [
      unit.name,
      unit.symbol,
      id
    ])
  ).rows[0];
}

module.exports = {
  findCategories,
  findUnits,
  insertCategory,
  insertUnit,
  updateCategory,
  updateUnit
};
