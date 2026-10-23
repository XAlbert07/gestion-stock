const AppError = require("../../common/app-error");
const queries = require("./inventory.queries");

async function getStock(productId) {
  const stock = await queries.findStock(productId);
  if (!stock) throw new AppError(404, "PRODUCT_NOT_FOUND", "Le produit demandé est introuvable.");
  return stock;
}

async function getDashboardSummary() {
  return queries.findDashboardSummary();
}

async function listStockProducts(filters) {
  return queries.findStockProducts(filters);
}

async function getMovements(productId, filters) {
  await getStock(productId);
  return queries.findMovements(productId, filters);
}

async function adjustStock(adjustment) {
  try {
    const result = await queries.createAdjustment(adjustment);
    if (!result)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Le produit demandé est introuvable.");
    return result;
  } catch (error) {
    if (error.code === "PRODUCT_INACTIVE")
      throw new AppError(409, "PRODUCT_INACTIVE", "Le produit est désactivé.");
    if (error.code === "INSUFFICIENT_STOCK")
      throw new AppError(409, "INSUFFICIENT_STOCK", "Le stock disponible est insuffisant.");
    throw error;
  }
}

function mapStockEntryError(error) {
  if (error.code === "PRODUCT_INACTIVE") {
    throw new AppError(409, "PRODUCT_INACTIVE", "Le produit est désactivé.");
  }
  if (error.code === "STOCK_ALREADY_INITIALIZED") {
    throw new AppError(
      409,
      "STOCK_ALREADY_INITIALIZED",
      "Le stock initial de ce produit a déjà été saisi ou un mouvement existe."
    );
  }
  if (error.code === "NO_STOCK_CHANGE") {
    throw new AppError(
      409,
      "NO_STOCK_CHANGE",
      "La quantité comptée est identique au stock actuel."
    );
  }
  if (error.code === "UNIT_COST_REQUIRED") {
    throw new AppError(
      400,
      "UNIT_COST_REQUIRED",
      "Le coût unitaire en F CFA est requis pour valoriser une entrée de stock."
    );
  }
  throw error;
}

async function initializeStock(input) {
  try {
    const result = await queries.initializeStock(input);
    if (!result)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Le produit demandé est introuvable.");
    return result;
  } catch (error) {
    return mapStockEntryError(error);
  }
}

async function countStock(input) {
  try {
    const result = await queries.countStock(input);
    if (!result)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Le produit demandé est introuvable.");
    return result;
  } catch (error) {
    return mapStockEntryError(error);
  }
}

async function cancelOperation(operationId, notes, createdBy) {
  try {
    const result = await queries.reverseOperation(operationId, notes, createdBy);
    if (!result)
      throw new AppError(404, "OPERATION_NOT_FOUND", "L'opération demandée est introuvable.");
    return result;
  } catch (error) {
    if (
      [
        "OPERATION_ALREADY_REVERSED",
        "INSUFFICIENT_STOCK_FOR_CANCELLATION",
        "RECEIPT_CANNOT_BE_CANCELLED",
        "OPENING_BALANCE_CANNOT_BE_CANCELLED",
        "STOCK_COUNT_CANNOT_BE_CANCELLED"
      ].includes(error.code)
    ) {
      throw new AppError(
        409,
        error.code,
        error.code === "OPERATION_ALREADY_REVERSED"
          ? "Cette opération a déjà été annulée."
          : error.code === "RECEIPT_CANNOT_BE_CANCELLED"
            ? "Une réception validée se corrige par ajustement de stock, pas par annulation."
            : error.code === "OPENING_BALANCE_CANNOT_BE_CANCELLED" ||
                error.code === "STOCK_COUNT_CANNOT_BE_CANCELLED"
              ? "Un stock initial ou un comptage se corrige par un nouveau comptage traçable."
              : "L'annulation rendrait le stock négatif."
      );
    }
    throw error;
  }
}

module.exports = {
  getStock,
  getDashboardSummary,
  listStockProducts,
  getMovements,
  adjustStock,
  initializeStock,
  countStock,
  cancelOperation
};
