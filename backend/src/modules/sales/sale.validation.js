const AppError = require("../../common/app-error");
function id(v, l) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new AppError(400, "VALIDATION_ERROR", `${l} est invalide.`);
  return n;
}
function dateValue(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${label} doit être une date au format AAAA-MM-JJ.`
    );
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
    throw new AppError(400, "VALIDATION_ERROR", `${label} est invalide.`);
  return value;
}
function dateRange(fromValue, toValue, required = false) {
  const from = fromValue ? dateValue(fromValue, "La date de début") : null;
  const to = toValue ? dateValue(toValue, "La date de fin") : null;
  if (required && (!from || !to))
    throw new AppError(400, "VALIDATION_ERROR", "Les dates de début et de fin sont obligatoires.");
  if ((from && !to) || (!from && to))
    throw new AppError(400, "VALIDATION_ERROR", "Les deux dates de la période sont nécessaires.");
  if (from && from > to)
    throw new AppError(400, "VALIDATION_ERROR", "La date de début doit précéder la date de fin.");
  if (from && (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000 > 366)
    throw new AppError(400, "VALIDATION_ERROR", "La période ne peut pas dépasser 367 jours.");
  return { from, to };
}
function listFilters(query) {
  const { from, to } = dateRange(query.from, query.to);
  const status = query.status || null;
  if (status && !["DRAFT", "COMPLETED", "CANCELLED"].includes(status))
    throw new AppError(400, "VALIDATION_ERROR", "Le statut de vente est invalide.");
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
  return { from, to, status, page, limit, search };
}
function reportRange(query) {
  return dateRange(query.from, query.to, true);
}
function num(v, l, zero = false) {
  const s = String(v);
  if (!/^\d+(\.\d{1,3})?$/.test(s) || (!zero && Number(s) <= 0))
    throw new AppError(400, "VALIDATION_ERROR", `${l} est invalide.`);
  return s;
}
function draft(p) {
  const reference = typeof p.reference === "string" ? p.reference.trim() : "";
  if (!reference || reference.length > 100)
    throw new AppError(400, "VALIDATION_ERROR", "La référence est invalide.");
  return {
    customerId:
      p.customer_id === null || p.customer_id === undefined ? null : id(p.customer_id, "Le client"),
    customerTypeId: id(p.customer_type_id, "Le type de client"),
    reference
  };
}
function item(p) {
  return {
    productId: id(p.product_id, "Le produit"),
    unitId: id(p.unit_id, "L'unité"),
    quantity: num(p.quantity, "La quantité")
  };
}
function returnDraft(p) {
  const reference = typeof p.reference === "string" ? p.reference.trim() : "";
  const reason = typeof p.reason === "string" ? p.reason.trim() : null;
  if (!reference || reference.length > 100)
    throw new AppError(400, "VALIDATION_ERROR", "La référence est invalide.");
  return { reference, reason: reason || null };
}
function returnItem(p) {
  return {
    saleItemId: id(p.sale_item_id, "La ligne de vente"),
    quantity: num(p.quantity, "La quantité")
  };
}
module.exports = { id, draft, item, returnDraft, returnItem, listFilters, reportRange };
