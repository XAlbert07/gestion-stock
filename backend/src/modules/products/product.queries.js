const { getPool } = require("../../config/database");

async function findAll({ page, limit, search, categoryId, includeInactive }) {
  const values = [];
  const conditions = [];
  if (!includeInactive) conditions.push("is_active = true");
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(name ILIKE $${values.length} OR sku ILIKE $${values.length})`);
  }
  if (categoryId) {
    values.push(categoryId);
    conditions.push(`category_id = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await getPool().query(
    `SELECT count(*)::int AS total FROM products ${where}`,
    values
  );
  values.push(limit, (page - 1) * limit);
  const result = await getPool().query(
    `SELECT * FROM products ${where} ORDER BY name ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { data: result.rows, meta: { page, limit, total: count.rows[0].total } };
}

async function findById(id) {
  return (await getPool().query("SELECT * FROM products WHERE id = $1", [id])).rows[0];
}

async function update(id, patch) {
  const columns = {
    name: "name",
    sku: "sku",
    description: "description",
    category_id: "category_id",
    base_unit_id: "base_unit_id",
    critical_threshold: "critical_threshold",
    is_active: "is_active"
  };
  const keys = Object.keys(patch);
  const values = keys.map((key) => patch[key]);
  const assignments = keys.map((key, index) => `${columns[key]} = $${index + 1}`).join(", ");
  values.push(id);
  return (
    await getPool().query(
      `UPDATE products SET ${assignments} WHERE id = $${values.length} RETURNING *`,
      values
    )
  ).rows[0];
}

async function findUnits(id) {
  return (
    await getPool().query(
      "SELECT product_units.*, units.name, units.symbol FROM product_units JOIN units ON units.id = product_units.unit_id WHERE product_id = $1 ORDER BY units.name",
      [id]
    )
  ).rows;
}
async function findPrices(id) {
  return (
    await getPool().query(
      "SELECT product_prices.*,customer_types.name AS customer_type_name,units.name AS unit_name,units.symbol AS unit_symbol FROM product_prices JOIN customer_types ON customer_types.id=product_prices.customer_type_id JOIN units ON units.id=product_prices.unit_id WHERE product_prices.product_id=$1 ORDER BY customer_types.name,units.name,product_prices.created_at DESC",
      [id]
    )
  ).rows;
}
async function insertPrice(productId, price) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const product = (
      await client.query("SELECT id,base_unit_id FROM products WHERE id=$1 FOR UPDATE", [productId])
    ).rows[0];
    if (!product) {
      const error = new Error("PRODUCT_NOT_FOUND");
      error.code = error.message;
      throw error;
    }
    if (Number(product.base_unit_id) !== price.unitId) {
      const unit = (
        await client.query("SELECT 1 FROM product_units WHERE product_id=$1 AND unit_id=$2", [
          productId,
          price.unitId
        ])
      ).rows[0];
      if (!unit) {
        const error = new Error("INVALID_PRODUCT_UNIT");
        error.code = error.message;
        throw error;
      }
    }
    await client.query(
      "UPDATE product_prices SET is_active=false WHERE product_id=$1 AND customer_type_id=$2 AND unit_id=$3 AND is_active=true",
      [productId, price.customerTypeId, price.unitId]
    );
    const result = await client.query(
      "INSERT INTO product_prices (product_id,customer_type_id,unit_id,price,is_active) VALUES ($1,$2,$3,$4,true) RETURNING *",
      [productId, price.customerTypeId, price.unitId, price.amount]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function resolvePrice(productId, customerTypeId, unitId) {
  return (
    (
      await getPool().query(
        "SELECT price FROM product_prices WHERE product_id=$1 AND customer_type_id=$2 AND unit_id=$3 AND is_active=true",
        [productId, customerTypeId, unitId]
      )
    ).rows[0] || null
  );
}
async function upsertUnit(productId, unit) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (unit.isDefaultSaleUnit)
      await client.query(
        "UPDATE product_units SET is_default_sale_unit = false WHERE product_id = $1",
        [productId]
      );
    const result = await client.query(
      "INSERT INTO product_units (product_id, unit_id, conversion_factor, is_default_sale_unit) VALUES ($1, $2, $3, $4) ON CONFLICT (product_id, unit_id) DO UPDATE SET conversion_factor = EXCLUDED.conversion_factor, is_default_sale_unit = EXCLUDED.is_default_sale_unit RETURNING *",
      [productId, unit.unitId, unit.conversionFactor, unit.isDefaultSaleUnit]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insert({ categoryId, baseUnitId, name, sku, description, criticalThreshold }) {
  const result = await getPool().query(
    `
      INSERT INTO products (category_id, base_unit_id, name, sku, description, critical_threshold)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [categoryId, baseUnitId, name, sku, description, criticalThreshold]
  );

  return result.rows[0];
}

module.exports = {
  findAll,
  findById,
  insert,
  update,
  findUnits,
  upsertUnit,
  findPrices,
  insertPrice,
  resolvePrice
};
