const { getPool } = require("../../config/database");
async function types() {
  return (await getPool().query("SELECT * FROM customer_types ORDER BY name")).rows;
}
async function customers() {
  return (
    await getPool().query(
      "SELECT customers.*, customer_types.name AS customer_type_name FROM customers JOIN customer_types ON customer_types.id=customers.customer_type_id WHERE customers.is_active=true ORDER BY customers.name"
    )
  ).rows;
}
async function addType(value) {
  return (
    await getPool().query("INSERT INTO customer_types (name) VALUES ($1) RETURNING *", [value.name])
  ).rows[0];
}
async function addCustomer(value) {
  return (
    await getPool().query(
      "INSERT INTO customers (customer_type_id,name,phone,address) VALUES ($1,$2,$3,$4) RETURNING *",
      [value.customerTypeId, value.name, value.phone, value.address]
    )
  ).rows[0];
}
module.exports = { types, customers, addType, addCustomer };
