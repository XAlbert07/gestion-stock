// Configuration du mode démonstration (compte visiteur en lecture seule).
const DEMO_ROLE = "DEMO";
const DEFAULT_DEMO_EMAIL = "demo@gestion-stock.local";

function isDemoEnabled() {
  return process.env.DEMO_LOGIN_ENABLED === "true";
}

function getDemoEmail() {
  return (process.env.DEMO_USER_EMAIL || DEFAULT_DEMO_EMAIL).trim();
}

module.exports = { DEMO_ROLE, isDemoEnabled, getDemoEmail };
