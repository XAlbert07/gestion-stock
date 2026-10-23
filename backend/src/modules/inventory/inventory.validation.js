const AppError = require("../../common/app-error");

function positiveId(value, field) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new AppError(400, "VALIDATION_ERROR", `${field} est invalide.`);
  return id;
}

function adjustment(payload) {
  const productId = positiveId(payload.product_id, "Le produit");
  const direction = payload.direction;
  const quantity = String(payload.quantity);
  const unitCost =
    direction === "IN" ? nonNegativeAmount(payload.unit_cost, "Le coût unitaire") : null;
  if (
    !["IN", "OUT"].includes(direction) ||
    !/^\d+(\.\d{1,3})?$/.test(quantity) ||
    quantity.split(".")[0].length > 11 ||
    Number(quantity) <= 0
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Le sens ou la quantité de l'ajustement est invalide."
    );
  }
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (!reason || reason.length > 5000)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Le motif est requis et ne doit pas dépasser 5000 caractères."
    );
  return {
    productId,
    direction,
    quantity,
    unitCost,
    reason,
    notes: typeof payload.notes === "string" ? payload.notes.trim() || null : null
  };
}

function nonNegativeAmount(value, field) {
  const amount = String(value);
  if (!/^\d+$/.test(amount) || amount.length > 12) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} doit être un montant entier en F CFA.`);
  }
  return amount;
}

function stockCount(payload, { opening = false } = {}) {
  const productId = positiveId(payload.product_id, "Le produit");
  const countedQuantity = String(payload.quantity);
  if (
    !/^\d+(\.\d{1,3})?$/.test(countedQuantity) ||
    countedQuantity.split(".")[0].length > 11 ||
    (opening && Number(countedQuantity) <= 0)
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      opening
        ? "La quantité de stock initial doit être supérieure à zéro."
        : "La quantité comptée doit être positive ou nulle, avec au plus trois décimales."
    );
  }
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (!reason || reason.length > 5000) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Le motif est requis et ne doit pas dépasser 5000 caractères."
    );
  }
  return {
    productId,
    countedQuantity,
    unitCost:
      payload.unit_cost === undefined
        ? null
        : nonNegativeAmount(payload.unit_cost, "Le coût unitaire"),
    reason,
    notes: typeof payload.notes === "string" ? payload.notes.trim() || null : null
  };
}

module.exports = { adjustment, stockCount, positiveId };
