const { rateLimit } = require("express-rate-limit");

// Limiteur distinct de celui de la connexion : derrière un proxy (Vercel), tous les
// visiteurs partagent la même adresse IP, une limite stricte bloquerait la démo
// pour tout le monde (et la vraie connexion si les compteurs étaient communs).
const demoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      error: {
        code: "DEMO_RATE_LIMITED",
        message: "Trop de demandes pour la démonstration. Réessayez dans quelques minutes."
      }
    });
  }
});

module.exports = demoRateLimit;
