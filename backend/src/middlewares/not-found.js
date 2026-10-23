const AppError = require("../common/app-error");

function notFound(req, res, next) {
  next(new AppError(404, "NOT_FOUND", "La ressource demandée est introuvable."));
}

module.exports = notFound;
