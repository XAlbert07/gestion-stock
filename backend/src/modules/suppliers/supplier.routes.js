const express = require("express");
const controller = require("./supplier.controller");
const requireAuth = require("../../middlewares/require-auth");
const router = express.Router();
router.use(requireAuth);
router.get("/", controller.getSuppliers);
router.post("/", controller.createSupplier);
router.patch("/:id", controller.updateSupplier);
module.exports = router;
