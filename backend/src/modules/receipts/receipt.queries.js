const { getPool } = require("../../config/database");

async function findAll(filters = {}) {
  const { search = "", limit = 20, offset = 0 } = filters;
  const params = [];
  const where = ["stock_receipts.is_active = true"];
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(stock_receipts.reference ILIKE $${params.length} OR suppliers.name ILIKE $${params.length})`
    );
  }
  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;
  const items = (
    await getPool().query(
      `SELECT stock_receipts.*, suppliers.name AS supplier_name FROM stock_receipts JOIN suppliers ON suppliers.id = stock_receipts.supplier_id WHERE ${where.join(" AND ")} ORDER BY stock_receipts.created_at DESC, stock_receipts.id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    )
  ).rows;
  const countParams = params.slice(0, -2);
  const countRows = (
    await getPool().query(
      `SELECT COUNT(*)::int AS total FROM stock_receipts JOIN suppliers ON suppliers.id = stock_receipts.supplier_id WHERE ${where.join(" AND ")}`,
      countParams
    )
  ).rows;
  return { items, total: countRows[0]?.total || 0 };
}
async function findById(id) {
  return (
    await getPool().query(
      "SELECT stock_receipts.*, suppliers.name AS supplier_name FROM stock_receipts JOIN suppliers ON suppliers.id = stock_receipts.supplier_id WHERE stock_receipts.id = $1",
      [id]
    )
  ).rows[0];
}
async function findItems(id) {
  return (
    await getPool().query(
      "SELECT stock_receipt_items.*, products.name AS product_name, units.symbol AS unit_symbol FROM stock_receipt_items JOIN products ON products.id = stock_receipt_items.product_id JOIN units ON units.id = stock_receipt_items.unit_id WHERE receipt_id = $1 ORDER BY id",
      [id]
    )
  ).rows;
}
async function createDraft(receipt) {
  return (
    await getPool().query(
      "INSERT INTO stock_receipts (supplier_id, reference, created_by, notes) SELECT id, $2, $3, $4 FROM suppliers WHERE id = $1 AND is_active = true RETURNING *",
      [receipt.supplierId, receipt.reference, receipt.createdBy, receipt.notes]
    )
  ).rows[0];
}
async function addItem(receiptId, item) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const receipt = (
      await client.query("SELECT status FROM stock_receipts WHERE id = $1 FOR UPDATE", [receiptId])
    ).rows[0];
    if (!receipt) return null;
    if (receipt.status !== "DRAFT") {
      const e = new Error("RECEIPT_NOT_DRAFT");
      e.code = e.message;
      throw e;
    }
    const product = (
      await client.query("SELECT base_unit_id, is_active FROM products WHERE id=$1", [
        item.productId
      ])
    ).rows[0];
    if (!product || !product.is_active) {
      const e = new Error("INVALID_PRODUCT");
      e.code = e.message;
      throw e;
    }
    const factor =
      item.unitId === Number(product.base_unit_id)
        ? "1"
        : (
            await client.query(
              "SELECT conversion_factor FROM product_units WHERE product_id=$1 AND unit_id=$2",
              [item.productId, item.unitId]
            )
          ).rows[0]?.conversion_factor;
    if (!factor) {
      const e = new Error("INVALID_PRODUCT_UNIT");
      e.code = e.message;
      throw e;
    }
    const result = (
      await client.query(
        "INSERT INTO stock_receipt_items (receipt_id, product_id, unit_id, quantity, conversion_factor, unit_purchase_price) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [receiptId, item.productId, item.unitId, item.quantity, factor, item.purchasePrice]
      )
    ).rows[0];
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function complete(receiptId, createdBy) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const receipt = (
      await client.query("SELECT * FROM stock_receipts WHERE id=$1 FOR UPDATE", [receiptId])
    ).rows[0];
    if (!receipt) return null;
    if (receipt.status !== "DRAFT") {
      const e = new Error("RECEIPT_NOT_DRAFT");
      e.code = e.message;
      throw e;
    }
    const items = (
      await client.query(
        "SELECT * FROM stock_receipt_items WHERE receipt_id=$1 ORDER BY product_id",
        [receiptId]
      )
    ).rows;
    if (!items.length) {
      const e = new Error("RECEIPT_EMPTY");
      e.code = e.message;
      throw e;
    }
    const operation = (
      await client.query(
        "INSERT INTO stock_operations (operation_type, created_by, notes) VALUES ('RECEIPT',$1,$2) RETURNING *",
        [createdBy, `Réception ${receipt.reference}`]
      )
    ).rows[0];
    for (const item of items) {
      await client.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [item.product_id]);
      const opItem = (
        await client.query(
          "INSERT INTO stock_operation_items (operation_id, product_id, unit_id, direction, quantity, conversion_factor) VALUES ($1,$2,$3,'IN',$4,$5) RETURNING *",
          [operation.id, item.product_id, item.unit_id, item.quantity, item.conversion_factor]
        )
      ).rows[0];
      await client.query(
        "INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity) VALUES ($1,$2,'IN',$3)",
        [opItem.id, item.product_id, opItem.base_quantity]
      );
      await client.query(
        "UPDATE products SET current_stock=current_stock+$1, average_cost=(((current_stock*average_cost)+$2)/(current_stock+$1)) WHERE id=$3",
        [
          opItem.base_quantity,
          Number(item.quantity) * Number(item.unit_purchase_price),
          item.product_id
        ]
      );
      await client.query(
        "INSERT INTO supplier_products (supplier_id, product_id, last_purchase_price) VALUES ($1,$2,$3) ON CONFLICT (supplier_id,product_id) DO UPDATE SET last_purchase_price=EXCLUDED.last_purchase_price",
        [receipt.supplier_id, item.product_id, item.unit_purchase_price]
      );
    }
    const completed = (
      await client.query(
        "UPDATE stock_receipts SET status='COMPLETED', operation_id=$1, received_at=now() WHERE id=$2 RETURNING *",
        [operation.id, receiptId]
      )
    ).rows[0];
    await client.query("COMMIT");
    return completed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { findAll, findById, findItems, createDraft, addItem, complete };
