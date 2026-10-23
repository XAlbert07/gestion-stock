const jwt = require("jsonwebtoken");
const AppError = require("../common/app-error");

function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return next(new AppError(401, "UNAUTHORIZED", "Une authentification est requise."));
  try {
    req.user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
    return next();
  } catch {
    return next(
      new AppError(401, "UNAUTHORIZED", "Le jeton d'authentification est invalide ou expiré.")
    );
  }
}

module.exports = requireAuth;
