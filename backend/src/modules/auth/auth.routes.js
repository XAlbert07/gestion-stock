const express = require("express");
const controller = require("./auth.controller");
const requireAuth = require("../../middlewares/require-auth");
const loginRateLimit = require("../../middlewares/login-rate-limit");
const router = express.Router();
router.post("/login", loginRateLimit, controller.signIn);
router.get("/me", requireAuth, controller.me);
module.exports = router;
