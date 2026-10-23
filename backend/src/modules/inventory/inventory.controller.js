const service = require("./inventory.service");
const AppError = require("../../common/app-error");
const { adjustment, stockCount, positiveId } = require("./inventory.validation");

function productId(req) {
  return positiveId(req.params.productId, "L'identifiant du produit");
}

async function getStock(req, res, next) {
  try {
    res.json(await service.getStock(productId(req)));
  } catch (error) {
    next(error);
  }
}
async function getDashboardSummary(req, res, next) {
  try {
    res.json(await service.getDashboardSummary());
  } catch (error) {
    next(error);
  }
}
async function listStockProducts(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 100)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "La recherche ne doit pas dépasser 100 caractères."
      );
    const status = typeof req.query.status === "string" ? req.query.status : "ALL";
    if (!["ALL", "LOW", "OUT"].includes(status))
      throw new AppError(400, "VALIDATION_ERROR", "Le filtre de stock est invalide.");
    res.json(await service.listStockProducts({ page, limit, search, status }));
  } catch (error) {
    next(error);
  }
}
async function getMovements(req, res, next) {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const from = dateFilter(req.query.from);
    const to = dateFilter(req.query.to);
    const operationType =
      typeof req.query.operation_type === "string" ? req.query.operation_type : "";
    const allowedTypes = [
      "OPENING_BALANCE",
      "RECEIPT",
      "SALE",
      "RETURN",
      "ADJUSTMENT",
      "LOSS",
      "DAMAGE",
      "CANCELLATION"
    ];
    if (operationType && !allowedTypes.includes(operationType))
      throw new AppError(400, "VALIDATION_ERROR", "Le type d'opération est invalide.");
    if (from && to && from > to)
      throw new AppError(400, "VALIDATION_ERROR", "La date de début doit précéder la date de fin.");
    res.json(await service.getMovements(productId(req), { limit, from, to, operationType }));
  } catch (error) {
    next(error);
  }
}

function dateFilter(value) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, "VALIDATION_ERROR", "Une date doit respecter le format AAAA-MM-JJ.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
    throw new AppError(400, "VALIDATION_ERROR", "La date est invalide.");
  return value;
}
async function createAdjustment(req, res, next) {
  try {
    res
      .status(201)
      .json(await service.adjustStock({ ...adjustment(req.body || {}), createdBy: req.user.sub }));
  } catch (error) {
    next(error);
  }
}
async function createOpeningStock(req, res, next) {
  try {
    res.status(201).json(
      await service.initializeStock({
        ...stockCount(req.body || {}, { opening: true }),
        createdBy: req.user.sub
      })
    );
  } catch (error) {
    next(error);
  }
}
async function createStockCount(req, res, next) {
  try {
    res
      .status(201)
      .json(await service.countStock({ ...stockCount(req.body || {}), createdBy: req.user.sub }));
  } catch (error) {
    next(error);
  }
}
async function cancelOperation(req, res, next) {
  try {
    const id = positiveId(req.params.operationId, "L'identifiant de l'opération");
    const notes =
      req.body && typeof req.body.notes === "string" ? req.body.notes.trim() || null : null;
    res.status(201).json(await service.cancelOperation(id, notes, req.user.sub));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardSummary,
  listStockProducts,
  getStock,
  getMovements,
  createAdjustment,
  createOpeningStock,
  createStockCount,
  cancelOperation
};
