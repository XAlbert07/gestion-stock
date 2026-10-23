const { getPool } = require("../../config/database");

async function findStock(productId) {
  return (
    await getPool().query(
      "SELECT id, name, sku, current_stock, critical_threshold, base_unit_id, is_active FROM products WHERE id = $1",
      [productId]
    )
  ).rows[0];
}

async function findDashboardSummary() {
  const result = await getPool().query(`
    SELECT
      count(*) FILTER (WHERE is_active = true)::int AS active_products,
      count(*) FILTER (WHERE is_active = true AND current_stock = 0)::int AS out_of_stock,
      count(*) FILTER (WHERE is_active = true AND current_stock > 0 AND current_stock <= critical_threshold)::int AS low_stock,
      (SELECT count(*)::int FROM stock_movements WHERE created_at >= now() - interval '7 days') AS movements_last_7_days
    FROM products
  `);
  const recentMovements = await getPool().query(`
    SELECT sm.id, sm.direction, sm.base_quantity, sm.created_at,
      so.id AS operation_id, so.operation_type, so.notes,
      p.id AS product_id, p.name AS product_name, p.sku, u.symbol AS unit_symbol
    FROM stock_movements sm
    JOIN stock_operations so ON so.id = (SELECT operation_id FROM stock_operation_items WHERE id = sm.operation_item_id)
    JOIN products p ON p.id = sm.product_id
    JOIN units u ON u.id = p.base_unit_id
    ORDER BY sm.created_at DESC, sm.id DESC
    LIMIT 8
  `);
  return { ...result.rows[0], recent_movements: recentMovements.rows };
}

async function findStockProducts({ page, limit, search, status }) {
  const values = [];
  const conditions = ["products.is_active = true"];
  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(products.name ILIKE $${values.length} OR products.sku ILIKE $${values.length})`
    );
  }
  if (status === "OUT") conditions.push("products.current_stock = 0");
  if (status === "LOW")
    conditions.push(
      "products.current_stock > 0 AND products.current_stock <= products.critical_threshold"
    );
  const where = `WHERE ${conditions.join(" AND ")}`;
  const count = await getPool().query(
    `SELECT count(*)::int AS total FROM products ${where}`,
    values
  );
  values.push(limit, (page - 1) * limit);
  const result = await getPool().query(
    `SELECT products.id,products.name,products.sku,products.current_stock,products.critical_threshold,products.average_cost,products.base_unit_id,units.name AS unit_name,units.symbol AS unit_symbol,products.is_active FROM products JOIN units ON units.id=products.base_unit_id ${where} ORDER BY products.name,products.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { data: result.rows, meta: { page, limit, total: count.rows[0].total } };
}

async function findMovements(productId, { limit, from, to, operationType }) {
  const values = [productId];
  const conditions = ["sm.product_id = $1"];
  if (from) {
    values.push(from);
    conditions.push(`sm.created_at >= $${values.length}::date`);
  }
  if (to) {
    values.push(to);
    conditions.push(`sm.created_at < ($${values.length}::date + interval '1 day')`);
  }
  if (operationType) {
    values.push(operationType);
    conditions.push(`so.operation_type = $${values.length}`);
  }
  values.push(limit);
  return (
    await getPool().query(
      `SELECT sm.id, sm.direction, sm.base_quantity, sm.created_at, so.id AS operation_id, so.operation_type, so.notes FROM stock_movements sm JOIN stock_operations so ON so.id = (SELECT operation_id FROM stock_operation_items WHERE id = sm.operation_item_id) WHERE ${conditions.join(" AND ")} ORDER BY sm.created_at DESC, sm.id DESC LIMIT $${values.length}`,
      values
    )
  ).rows;
}

async function createAdjustment(adjustment) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const product = (
      await client.query(
        "SELECT id, base_unit_id, current_stock, is_active FROM products WHERE id = $1 FOR UPDATE",
        [adjustment.productId]
      )
    ).rows[0];
    if (!product) return null;
    if (!product.is_active) {
      const error = new Error("PRODUCT_INACTIVE");
      error.code = "PRODUCT_INACTIVE";
      throw error;
    }
    if (
      adjustment.direction === "OUT" &&
      Number(product.current_stock) < Number(adjustment.quantity)
    ) {
      const error = new Error("INSUFFICIENT_STOCK");
      error.code = "INSUFFICIENT_STOCK";
      throw error;
    }
    const operation = (
      await client.query(
        "INSERT INTO stock_operations (operation_type, created_by, notes) VALUES ('ADJUSTMENT', $1, $2) RETURNING *",
        [adjustment.createdBy, adjustment.notes]
      )
    ).rows[0];
    await client.query(
      "INSERT INTO stock_adjustments (operation_id, reason, created_by, unit_cost) VALUES ($1, $2, $3, $4)",
      [
        operation.id,
        adjustment.reason,
        adjustment.createdBy,
        adjustment.direction === "IN" ? adjustment.unitCost : null
      ]
    );
    const item = (
      await client.query(
        "INSERT INTO stock_operation_items (operation_id, product_id, unit_id, direction, quantity, conversion_factor) VALUES ($1, $2, $3, $4, $5, 1) RETURNING *",
        [operation.id, product.id, product.base_unit_id, adjustment.direction, adjustment.quantity]
      )
    ).rows[0];
    await client.query(
      "INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity) VALUES ($1, $2, $3, $4)",
      [item.id, product.id, adjustment.direction, item.base_quantity]
    );
    const updated =
      adjustment.direction === "IN"
        ? (
            await client.query(
              "UPDATE products SET current_stock = current_stock + $1, average_cost = round(((current_stock * average_cost) + ($1 * $2)) / (current_stock + $1), 2) WHERE id = $3 RETURNING current_stock",
              [item.base_quantity, adjustment.unitCost, product.id]
            )
          ).rows[0]
        : (
            await client.query(
              "UPDATE products SET current_stock = current_stock - $1 WHERE id = $2 RETURNING current_stock",
              [item.base_quantity, product.id]
            )
          ).rows[0];
    await client.query("COMMIT");
    return { operationId: operation.id, itemId: item.id, currentStock: updated.current_stock };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function quantityInMilliunits(quantity) {
  const [integer, fraction = ""] = String(quantity).split(".");
  return Number(integer) * 1000 + Number(fraction.padEnd(3, "0"));
}

async function initializeStock(input) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const product = (
      await client.query(
        "SELECT id, base_unit_id, current_stock, is_active FROM products WHERE id = $1 FOR UPDATE",
        [input.productId]
      )
    ).rows[0];
    if (!product) return null;
    if (!product.is_active)
      throw Object.assign(new Error("PRODUCT_INACTIVE"), { code: "PRODUCT_INACTIVE" });
    const history = await client.query(
      "SELECT EXISTS (SELECT 1 FROM stock_movements WHERE product_id = $1) AS has_movement",
      [product.id]
    );
    if (history.rows[0].has_movement || quantityInMilliunits(product.current_stock) !== 0) {
      throw Object.assign(new Error("STOCK_ALREADY_INITIALIZED"), {
        code: "STOCK_ALREADY_INITIALIZED"
      });
    }
    if (input.unitCost === null) {
      throw Object.assign(new Error("UNIT_COST_REQUIRED"), { code: "UNIT_COST_REQUIRED" });
    }
    const operation = (
      await client.query(
        "INSERT INTO stock_operations (operation_type, created_by, notes) VALUES ('OPENING_BALANCE', $1, $2) RETURNING *",
        [input.createdBy, input.notes || "Stock initial"]
      )
    ).rows[0];
    await client.query(
      "INSERT INTO stock_adjustments (operation_id, reason, created_by, adjustment_type, counted_quantity, unit_cost) VALUES ($1, $2, $3, 'OPENING_STOCK', $4, $5)",
      [operation.id, input.reason, input.createdBy, input.countedQuantity, input.unitCost]
    );
    const item = (
      await client.query(
        "INSERT INTO stock_operation_items (operation_id, product_id, unit_id, direction, quantity, conversion_factor) VALUES ($1, $2, $3, 'IN', $4, 1) RETURNING *",
        [operation.id, product.id, product.base_unit_id, input.countedQuantity]
      )
    ).rows[0];
    await client.query(
      "INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity) VALUES ($1, $2, 'IN', $3)",
      [item.id, product.id, item.base_quantity]
    );
    const updated = (
      await client.query(
        "UPDATE products SET current_stock = $1, average_cost = $2, updated_at = now() WHERE id = $3 RETURNING current_stock, average_cost",
        [item.base_quantity, input.unitCost, product.id]
      )
    ).rows[0];
    await client.query("COMMIT");
    return {
      operationId: operation.id,
      itemId: item.id,
      direction: "IN",
      quantity: item.base_quantity,
      currentStock: updated.current_stock,
      averageCost: updated.average_cost
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function countStock(input) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const product = (
      await client.query(
        "SELECT id, base_unit_id, current_stock, average_cost, is_active FROM products WHERE id = $1 FOR UPDATE",
        [input.productId]
      )
    ).rows[0];
    if (!product) return null;
    if (!product.is_active)
      throw Object.assign(new Error("PRODUCT_INACTIVE"), { code: "PRODUCT_INACTIVE" });
    const delta =
      quantityInMilliunits(input.countedQuantity) - quantityInMilliunits(product.current_stock);
    if (delta === 0) throw Object.assign(new Error("NO_STOCK_CHANGE"), { code: "NO_STOCK_CHANGE" });
    if (delta > 0 && input.unitCost === null) {
      throw Object.assign(new Error("UNIT_COST_REQUIRED"), { code: "UNIT_COST_REQUIRED" });
    }
    const direction = delta > 0 ? "IN" : "OUT";
    const quantity = (Math.abs(delta) / 1000).toFixed(3);
    const operation = (
      await client.query(
        "INSERT INTO stock_operations (operation_type, created_by, notes) VALUES ('ADJUSTMENT', $1, $2) RETURNING *",
        [input.createdBy, input.notes || "Comptage physique"]
      )
    ).rows[0];
    await client.query(
      "INSERT INTO stock_adjustments (operation_id, reason, created_by, adjustment_type, counted_quantity, unit_cost) VALUES ($1, $2, $3, 'COUNT', $4, $5)",
      [
        operation.id,
        input.reason,
        input.createdBy,
        input.countedQuantity,
        direction === "IN" ? input.unitCost : null
      ]
    );
    const item = (
      await client.query(
        "INSERT INTO stock_operation_items (operation_id, product_id, unit_id, direction, quantity, conversion_factor) VALUES ($1, $2, $3, $4, $5, 1) RETURNING *",
        [operation.id, product.id, product.base_unit_id, direction, quantity]
      )
    ).rows[0];
    await client.query(
      "INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity) VALUES ($1, $2, $3, $4)",
      [item.id, product.id, direction, item.base_quantity]
    );
    const updated =
      direction === "IN"
        ? (
            await client.query(
              "UPDATE products SET current_stock = $1, average_cost = round(((current_stock * average_cost) + ($2::numeric * $3::numeric)) / $1::numeric, 2), updated_at = now() WHERE id = $4 RETURNING current_stock, average_cost",
              [input.countedQuantity, quantity, input.unitCost, product.id]
            )
          ).rows[0]
        : (
            await client.query(
              "UPDATE products SET current_stock = $1, updated_at = now() WHERE id = $2 RETURNING current_stock, average_cost",
              [input.countedQuantity, product.id]
            )
          ).rows[0];
    await client.query("COMMIT");
    return {
      operationId: operation.id,
      itemId: item.id,
      direction,
      quantity: item.base_quantity,
      currentStock: updated.current_stock,
      countedQuantity: updated.current_stock,
      averageCost: updated.average_cost
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reverseOperation(operationId, notes, createdBy) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const operation = (
      await client.query("SELECT * FROM stock_operations WHERE id = $1 FOR UPDATE", [operationId])
    ).rows[0];
    if (!operation) return null;
    if (operation.operation_type === "OPENING_BALANCE") {
      const error = new Error("OPENING_BALANCE_CANNOT_BE_CANCELLED");
      error.code = error.message;
      throw error;
    }
    if (operation.operation_type === "ADJUSTMENT") {
      const countedAdjustment = (
        await client.query(
          "SELECT id FROM stock_adjustments WHERE operation_id = $1 AND counted_quantity IS NOT NULL",
          [operationId]
        )
      ).rows[0];
      if (countedAdjustment) {
        const error = new Error("STOCK_COUNT_CANNOT_BE_CANCELLED");
        error.code = error.message;
        throw error;
      }
    }
    if (operation.operation_type === "RECEIPT") {
      const error = new Error("RECEIPT_CANNOT_BE_CANCELLED");
      error.code = error.message;
      throw error;
    }
    const alreadyReversed = (
      await client.query("SELECT id FROM stock_operations WHERE reversal_of_operation_id = $1", [
        operationId
      ])
    ).rows[0];
    if (alreadyReversed) {
      const error = new Error("OPERATION_ALREADY_REVERSED");
      error.code = error.message;
      throw error;
    }
    const items = (
      await client.query(
        "SELECT * FROM stock_operation_items WHERE operation_id = $1 ORDER BY product_id FOR UPDATE",
        [operationId]
      )
    ).rows;
    const reversal = (
      await client.query(
        "INSERT INTO stock_operations (operation_type, reversal_of_operation_id, created_by, notes) VALUES ('CANCELLATION', $1, $2, $3) RETURNING *",
        [operationId, createdBy, notes || `Annulation de l'opération ${operationId}`]
      )
    ).rows[0];
    for (const item of items) {
      const product = (
        await client.query("SELECT current_stock FROM products WHERE id = $1 FOR UPDATE", [
          item.product_id
        ])
      ).rows[0];
      const direction = item.direction === "IN" ? "OUT" : "IN";
      if (direction === "OUT" && Number(product.current_stock) < Number(item.base_quantity)) {
        const error = new Error("INSUFFICIENT_STOCK_FOR_CANCELLATION");
        error.code = error.message;
        throw error;
      }
      const reverseItem = (
        await client.query(
          "INSERT INTO stock_operation_items (operation_id, product_id, unit_id, direction, quantity, conversion_factor) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            reversal.id,
            item.product_id,
            item.unit_id,
            direction,
            item.quantity,
            item.conversion_factor
          ]
        )
      ).rows[0];
      await client.query(
        "INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity) VALUES ($1, $2, $3, $4)",
        [reverseItem.id, item.product_id, direction, reverseItem.base_quantity]
      );
      await client.query(
        "UPDATE products SET current_stock = current_stock + ($1 * $2) WHERE id = $3",
        [direction === "IN" ? 1 : -1, reverseItem.base_quantity, item.product_id]
      );
    }
    await client.query("COMMIT");
    return reversal;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  findStock,
  findDashboardSummary,
  findStockProducts,
  findMovements,
  createAdjustment,
  initializeStock,
  countStock,
  reverseOperation
};
