const AppError = require("../../common/app-error");

function validateCreateProduct(payload) {
  const errors = [];
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const sku = typeof payload.sku === "string" ? payload.sku.trim() : "";
  const categoryId = Number(payload.category_id);
  const baseUnitId = Number(payload.base_unit_id);

  if (!name || name.length > 150) {
    errors.push({
      field: "name",
      message: "Le nom est requis et ne doit pas dépasser 150 caractères."
    });
  }

  if (!sku || sku.length > 100) {
    errors.push({
      field: "sku",
      message: "Le SKU est requis et ne doit pas dépasser 100 caractères."
    });
  }

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    errors.push({
      field: "category_id",
      message: "La catégorie doit être un identifiant positif."
    });
  }

  if (!Number.isSafeInteger(baseUnitId) || baseUnitId <= 0) {
    errors.push({
      field: "base_unit_id",
      message: "L'unité de base doit être un identifiant positif."
    });
  }

  if (errors.length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Les données fournies sont invalides.", errors);
  }

  const description = payload.description == null ? null : payload.description;
  if (description !== null && (typeof description !== "string" || description.length > 5000)) {
    errors.push({
      field: "description",
      message: "La description ne doit pas dépasser 5000 caractères."
    });
  }
  if (
    payload.critical_threshold !== undefined &&
    !/^\d+(\.\d{1,3})?$/.test(String(payload.critical_threshold))
  ) {
    errors.push({ field: "critical_threshold", message: "Le seuil critique est invalide." });
  }
  if (errors.length > 0)
    throw new AppError(400, "VALIDATION_ERROR", "Les données fournies sont invalides.", errors);
  return {
    name,
    sku,
    categoryId,
    baseUnitId,
    description,
    criticalThreshold: payload.critical_threshold ?? "0"
  };
}

function validateProductUpdate(payload) {
  const allowed = [
    "name",
    "sku",
    "description",
    "category_id",
    "base_unit_id",
    "critical_threshold",
    "is_active"
  ];
  const update = {};
  for (const key of allowed) if (payload[key] !== undefined) update[key] = payload[key];
  if (Object.keys(update).length === 0)
    throw new AppError(400, "VALIDATION_ERROR", "Aucun champ modifiable n'a été fourni.");
  if (
    update.name !== undefined &&
    (typeof update.name !== "string" ||
      !(update.name = update.name.trim()) ||
      update.name.length > 150)
  )
    throw new AppError(400, "VALIDATION_ERROR", "Le nom est invalide.");
  if (
    update.sku !== undefined &&
    (typeof update.sku !== "string" || !(update.sku = update.sku.trim()) || update.sku.length > 100)
  )
    throw new AppError(400, "VALIDATION_ERROR", "Le SKU est invalide.");
  if (
    update.description !== undefined &&
    update.description !== null &&
    (typeof update.description !== "string" || update.description.length > 5000)
  )
    throw new AppError(400, "VALIDATION_ERROR", "La description est invalide.");
  for (const field of ["category_id", "base_unit_id"])
    if (
      update[field] !== undefined &&
      (!Number.isSafeInteger(Number(update[field])) || Number(update[field]) <= 0)
    )
      throw new AppError(400, "VALIDATION_ERROR", `Le champ ${field} est invalide.`);
    else if (update[field] !== undefined) update[field] = Number(update[field]);
  if (
    update.critical_threshold !== undefined &&
    !/^\d+(\.\d{1,3})?$/.test(String(update.critical_threshold))
  )
    throw new AppError(400, "VALIDATION_ERROR", "Le seuil critique est invalide.");
  if (update.is_active !== undefined && typeof update.is_active !== "boolean")
    throw new AppError(400, "VALIDATION_ERROR", "Le statut actif est invalide.");
  return update;
}

function validateProductUnit(payload) {
  const unitId = Number(payload.unit_id);
  if (
    !Number.isSafeInteger(unitId) ||
    unitId <= 0 ||
    !/^\d+(\.\d{1,3})?$/.test(String(payload.conversion_factor))
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "L'unité ou le facteur de conversion est invalide."
    );
  return {
    unitId,
    conversionFactor: String(payload.conversion_factor),
    isDefaultSaleUnit: payload.is_default_sale_unit === true
  };
}

function validateProductPrice(payload) {
  const customerTypeId = Number(payload.customer_type_id);
  const unitId = Number(payload.unit_id);
  const amount = String(payload.price ?? "");
  if (
    !Number.isSafeInteger(customerTypeId) ||
    customerTypeId <= 0 ||
    !Number.isSafeInteger(unitId) ||
    unitId <= 0 ||
    !/^\d{1,12}$/.test(amount)
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Le type de client, l'unité ou le prix entier en F CFA est invalide."
    );
  return { customerTypeId, unitId, amount };
}

module.exports = {
  validateCreateProduct,
  validateProductUpdate,
  validateProductUnit,
  validateProductPrice
};
