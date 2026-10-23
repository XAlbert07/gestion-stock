const { rateLimit } = require("express-rate-limit");

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      error: {
        code: "LOGIN_RATE_LIMITED",
        message: "Trop de tentatives de connexion. Réessayez dans quelques minutes."
      }
    });
  }
});

module.exports = loginRateLimit;
