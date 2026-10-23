const express = require("express");
const productController = require("./product.controller");
const requireAuth = require("../../middlewares/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", productController.getProducts);
router.post("/", productController.createProduct);
router.get("/:id/prices", productController.getProductPrices);
router.post("/:id/prices", productController.saveProductPrice);
router.get("/:id/price", productController.getResolvedProductPrice);
router.get("/:id/units", productController.getProductUnits);
router.post("/:id/units", productController.saveProductUnit);
router.get("/:id", productController.getProduct);
router.patch("/:id", productController.updateProduct);

module.exports = router;
