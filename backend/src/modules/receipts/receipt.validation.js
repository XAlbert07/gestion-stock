const AppError = require("../../common/app-error");

function id(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new AppError(400, "VALIDATION_ERROR", `${label} est invalide.`);
  return parsed;
}
function decimal(value, label, allowZero = false) {
  const text = String(value);
  if (!/^\d+(\.\d{1,3})?$/.test(text) || (!allowZero && Number(text) <= 0))
    throw new AppError(400, "VALIDATION_ERROR", `${label} est invalide.`);
  return text;
}
function fcfaAmount(value, label, allowZero = false) {
  const text = String(value);
  if (!/^\d{1,12}$/.test(text) || (!allowZero && text === "0")) {
    throw new AppError(400, "VALIDATION_ERROR", `${label} doit être un montant entier en F CFA.`);
  }
  return text;
}
function draft(payload) {
  const reference = typeof payload.reference === "string" ? payload.reference.trim() : "";
  if (!reference || reference.length > 100)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "La référence est requise et ne doit pas dépasser 100 caractères."
    );
  return {
    supplierId: id(payload.supplier_id, "Le fournisseur"),
    reference,
    notes: typeof payload.notes === "string" ? payload.notes.trim() || null : null
  };
}
function item(payload) {
  return {
    productId: id(payload.product_id, "Le produit"),
    unitId: id(payload.unit_id, "L'unité"),
    quantity: decimal(payload.quantity, "La quantité"),
    purchasePrice: fcfaAmount(payload.unit_purchase_price, "Le prix d'achat", true)
  };
}
function listFilters(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new AppError(400, "VALIDATION_ERROR", "La pagination est invalide.");
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search.length > 100)
    throw new AppError(400, "VALIDATION_ERROR", "La recherche est trop longue.");
  return { page, limit, search };
}
module.exports = { draft, item, id, listFilters };
