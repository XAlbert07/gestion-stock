const AppError = require("../../common/app-error");

function requiredText(payload, field, maxLength, label) {
  const value = typeof payload[field] === "string" ? payload[field].trim() : "";

  if (!value || value.length > maxLength) {
    throw new AppError(400, "VALIDATION_ERROR", "Les données fournies sont invalides.", [
      { field, message: `${label} est requis et ne doit pas dépasser ${maxLength} caractères.` }
    ]);
  }

  return value;
}

function optionalText(payload, field, maxLength) {
  if (payload[field] === undefined || payload[field] === null) return null;
  if (typeof payload[field] !== "string" || payload[field].trim().length > maxLength) {
    throw new AppError(400, "VALIDATION_ERROR", "Les données fournies sont invalides.", [
      { field, message: `La valeur ne doit pas dépasser ${maxLength} caractères.` }
    ]);
  }
  return payload[field].trim() || null;
}

function category(payload) {
  return {
    name: requiredText(payload, "name", 100, "Le nom"),
    description: optionalText(payload, "description", 5000)
  };
}

function unit(payload) {
  return {
    name: requiredText(payload, "name", 50, "Le nom"),
    symbol: requiredText(payload, "symbol", 20, "Le symbole")
  };
}

function id(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "L'identifiant fourni est invalide.");
  }
  return parsed;
}

module.exports = { category, unit, id };
