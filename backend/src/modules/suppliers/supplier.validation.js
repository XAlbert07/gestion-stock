const AppError = require("../../common/app-error");

function supplier(payload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name || name.length > 150)
    throw new AppError(400, "VALIDATION_ERROR", "Le nom du fournisseur est invalide.");
  const optional = (field, max) =>
    payload[field] === undefined || payload[field] === null
      ? null
      : typeof payload[field] === "string" && payload[field].trim().length <= max
        ? payload[field].trim() || null
        : (() => {
            throw new AppError(400, "VALIDATION_ERROR", `Le champ ${field} est invalide.`);
          })();
  return {
    name,
    phone: optional("phone", 30),
    email: optional("email", 255),
    address: optional("address", 5000)
  };
}

function id(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "L'identifiant du fournisseur est invalide.");
  }
  return parsed;
}

function supplierUpdate(payload) {
  if (typeof payload.is_active !== "boolean") {
    throw new AppError(400, "VALIDATION_ERROR", "Le statut actif du fournisseur est invalide.");
  }
  return { ...supplier(payload), isActive: payload.is_active };
}

module.exports = { supplier, supplierUpdate, id };
