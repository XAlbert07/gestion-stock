const AppError = require("../../common/app-error");

function id(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new AppError(400, "VALIDATION_ERROR", `${field} est invalide.`);
  return parsed;
}
function text(value, field, max, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max)
    throw new AppError(400, "VALIDATION_ERROR", `${field} est invalide.`);
  return result || null;
}
function customerType(payload) {
  return { name: text(payload.name, "Le nom du type", 50, true) };
}
function customer(payload) {
  return {
    customerTypeId: id(payload.customer_type_id, "Le type de client"),
    name: text(payload.name, "Le nom du client", 150, true),
    phone: text(payload.phone, "Le téléphone", 30),
    address: text(payload.address, "L'adresse", 5000)
  };
}
module.exports = { id, customerType, customer };
