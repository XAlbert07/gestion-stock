const AppError = require("../../common/app-error");
const productService = require("./product.service");
const {
  validateCreateProduct,
  validateProductUpdate,
  validateProductUnit,
  validateProductPrice
} = require("./product.validation");

async function getProducts(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const categoryId = Number.parseInt(req.query.category_id, 10);
    const products = await productService.listProducts({
      page,
      limit,
      search: typeof req.query.search === "string" ? req.query.search.trim() : "",
      categoryId: Number.isSafeInteger(categoryId) && categoryId > 0 ? categoryId : null,
      includeInactive: req.query.include_inactive === "true"
    });
    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, "VALIDATION_ERROR", "L'identifiant du produit est invalide.");
    }
    res.json(await productService.getProduct(id));
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = validateCreateProduct(req.body || {});
    const createdProduct = await productService.createProduct(product);
    res.status(201).json(createdProduct);
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    res.json(
      await productService.updateProduct(
        Number(req.params.id),
        validateProductUpdate(req.body || {})
      )
    );
  } catch (error) {
    next(error);
  }
}
async function getProductUnits(req, res, next) {
  try {
    res.json(await productService.listProductUnits(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}
async function saveProductUnit(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await productService.saveProductUnit(
          Number(req.params.id),
          validateProductUnit(req.body || {})
        )
      );
  } catch (error) {
    next(error);
  }
}
async function getProductPrices(req, res, next) {
  try {
    res.json(await productService.listProductPrices(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}
async function saveProductPrice(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await productService.saveProductPrice(
          Number(req.params.id),
          validateProductPrice(req.body || {})
        )
      );
  } catch (error) {
    next(error);
  }
}
async function getResolvedProductPrice(req, res, next) {
  try {
    const customerTypeId = Number(req.query.customer_type_id);
    const unitId = Number(req.query.unit_id);
    if (
      !Number.isSafeInteger(customerTypeId) ||
      customerTypeId <= 0 ||
      !Number.isSafeInteger(unitId) ||
      unitId <= 0
    )
      throw new AppError(400, "VALIDATION_ERROR", "Le type de client ou l'unité est invalide.");
    const price = await productService.resolveProductPrice(
      Number(req.params.id),
      customerTypeId,
      unitId
    );
    if (!price)
      throw new AppError(
        404,
        "PRICE_NOT_FOUND",
        "Aucun tarif actif n'est défini pour cette combinaison."
      );
    res.json(price);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  getProductUnits,
  saveProductUnit,
  getProductPrices,
  saveProductPrice,
  getResolvedProductPrice
};
