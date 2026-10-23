const { getPool } = require("../config/database");

function health(req, res) {
  res.json({
    status: "ok"
  });
}

async function readiness(req, res) {
  try {
    await getPool().query("SELECT 1");
    res.json({ status: "ok", dependencies: { postgres: "ok" } });
  } catch (error) {
    console.error(error);
    res.status(503).json({ status: "unavailable" });
  }
}

module.exports = {
  health,
  readiness
};
