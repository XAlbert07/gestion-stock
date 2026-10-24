const jwt = require("jsonwebtoken");
const AppError = require("../common/app-error");
const { DEMO_ROLE } = require("../config/demo");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return next(new AppError(401, "UNAUTHORIZED", "Une authentification est requise."));
  try {
    req.user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
  } catch {
    return next(
      new AppError(401, "UNAUTHORIZED", "Le jeton d'authentification est invalide ou expiré.")
    );
  }
  // Le compte de démonstration peut tout consulter mais ne modifie rien.
  // Toutes les routes protégées passent par ce middleware : une seule règle suffit.
  if (req.user.role === DEMO_ROLE && !SAFE_METHODS.has(req.method))
    return next(
      new AppError(
        403,
        "DEMO_READ_ONLY",
        "Cette démonstration est en lecture seule : les modifications sont désactivées."
      )
    );
  return next();
}

module.exports = requireAuth;
