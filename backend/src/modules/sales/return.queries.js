const { getPool } = require("../../config/database");
async function create(saleId, value) {
  return (
    await getPool().query(
      "INSERT INTO sales_returns (sale_id,reference,created_by,reason) VALUES ($1,$2,$3,$4) RETURNING *",
      [saleId, value.reference, value.createdBy, value.reason]
    )
  ).rows[0];
}
async function one(id) {
  return (await getPool().query("SELECT * FROM sales_returns WHERE id=$1", [id])).rows[0];
}
async function items(id) {
  return (
    await getPool().query(
      "SELECT sales_return_items.*, products.name AS product_name FROM sales_return_items JOIN products ON products.id=sales_return_items.product_id WHERE return_id=$1 ORDER BY id",
      [id]
    )
  ).rows;
}
async function add(returnId, value) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const ret = (await c.query("SELECT * FROM sales_returns WHERE id=$1 FOR UPDATE", [returnId]))
      .rows[0];
    if (!ret) return null;
    if (ret.status !== "DRAFT") {
      const e = new Error("RETURN_NOT_DRAFT");
      e.code = e.message;
      throw e;
    }
    const sale = (await c.query("SELECT status FROM sales WHERE id=$1", [ret.sale_id])).rows[0];
    if (!sale || sale.status !== "COMPLETED") {
      const e = new Error("SALE_NOT_COMPLETED");
      e.code = e.message;
      throw e;
    }
    const line = (
      await c.query("SELECT * FROM sale_items WHERE id=$1 AND sale_id=$2", [
        value.saleItemId,
        ret.sale_id
      ])
    ).rows[0];
    if (!line) {
      const e = new Error("INVALID_SALE_ITEM");
      e.code = e.message;
      throw e;
    }
    const prior = (
      await c.query(
        "SELECT COALESCE(sum(quantity),0) AS quantity FROM sales_return_items sri JOIN sales_returns sr ON sr.id=sri.return_id WHERE sri.sale_item_id=$1 AND sr.status<>'CANCELLED'",
        [line.id]
      )
    ).rows[0];
    if (Number(prior.quantity) + Number(value.quantity) > Number(line.quantity)) {
      const e = new Error("RETURN_QUANTITY_EXCEEDED");
      e.code = e.message;
      throw e;
    }
    const result = (
      await c.query(
        "INSERT INTO sales_return_items (return_id,sale_item_id,product_id,unit_id,quantity,conversion_factor,unit_price,cost_at_return) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          returnId,
          line.id,
          line.product_id,
          line.unit_id,
          value.quantity,
          line.conversion_factor,
          line.unit_price,
          line.cost_at_sale
        ]
      )
    ).rows[0];
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function complete(returnId, userId) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const ret = (await c.query("SELECT * FROM sales_returns WHERE id=$1 FOR UPDATE", [returnId]))
      .rows[0];
    if (!ret) return null;
    if (ret.status !== "DRAFT") {
      const e = new Error("RETURN_NOT_DRAFT");
      e.code = e.message;
      throw e;
    }
    const lines = (await c.query("SELECT * FROM sales_return_items WHERE return_id=$1", [returnId]))
      .rows;
    if (!lines.length) {
      const e = new Error("RETURN_EMPTY");
      e.code = e.message;
      throw e;
    }
    const op = (
      await c.query(
        "INSERT INTO stock_operations (operation_type,created_by,notes) VALUES ('RETURN',$1,$2) RETURNING *",
        [userId, `Retour ${ret.reference}`]
      )
    ).rows[0];
    for (const line of lines) {
      await c.query("SELECT id FROM products WHERE id=$1 FOR UPDATE", [line.product_id]);
      const oi = (
        await c.query(
          "INSERT INTO stock_operation_items (operation_id,product_id,unit_id,direction,quantity,conversion_factor) VALUES ($1,$2,$3,'IN',$4,$5) RETURNING *",
          [op.id, line.product_id, line.unit_id, line.quantity, line.conversion_factor]
        )
      ).rows[0];
      await c.query(
        "INSERT INTO stock_movements (operation_item_id,product_id,direction,base_quantity) VALUES ($1,$2,'IN',$3)",
        [oi.id, line.product_id, oi.base_quantity]
      );
      await c.query("UPDATE products SET current_stock=current_stock+$1 WHERE id=$2", [
        oi.base_quantity,
        line.product_id
      ]);
    }
    const done = (
      await c.query(
        "UPDATE sales_returns SET status='COMPLETED',operation_id=$1,returned_at=now() WHERE id=$2 RETURNING *",
        [op.id, returnId]
      )
    ).rows[0];
    await c.query("COMMIT");
    return done;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
module.exports = { create, one, items, add, complete };
