const AppError = require("../../common/app-error");
const productQueries = require("./product.queries");

async function listProducts(filters) {
  return productQueries.findAll(filters);
}

async function getProduct(id) {
  const product = await productQueries.findById(id);
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Le produit demandé est introuvable.");
  return product;
}

async function createProduct(product) {
  try {
    return await productQueries.insert(product);
  } catch (error) {
    if (error.code === "23505") {
      throw new AppError(
        409,
        "PRODUCT_ALREADY_EXISTS",
        "Un produit avec ce nom ou ce SKU existe déjà."
      );
    }

    if (error.code === "23503") {
      throw new AppError(
        400,
        "INVALID_REFERENCE",
        "La catégorie ou l'unité de base indiquée n'existe pas."
      );
    }

    throw error;
  }
}

async function updateProduct(id, patch) {
  try {
    const product = await productQueries.update(id, patch);
    if (!product)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Le produit demandé est introuvable.");
    return product;
  } catch (error) {
    if (error.code === "23505")
      throw new AppError(
        409,
        "PRODUCT_ALREADY_EXISTS",
        "Un produit avec ce nom ou ce SKU existe déjà."
      );
    if (error.code === "23503")
      throw new AppError(
        400,
        "INVALID_REFERENCE",
        "La catégorie ou l'unité indiquée n'existe pas."
      );
    throw error;
  }
}

async function listProductUnits(id) {
  await getProduct(id);
  return productQueries.findUnits(id);
}
async function saveProductUnit(id, unit) {
  await getProduct(id);
  try {
    return await productQueries.upsertUnit(id, unit);
  } catch (error) {
    if (error.code === "23503")
      throw new AppError(400, "INVALID_REFERENCE", "L'unité indiquée n'existe pas.");
    throw error;
  }
}
async function listProductPrices(id) {
  await getProduct(id);
  return productQueries.findPrices(id);
}
async function saveProductPrice(id, price) {
  await getProduct(id);
  try {
    return await productQueries.insertPrice(id, price);
  } catch (error) {
    if (error.code === "INVALID_PRODUCT_UNIT")
      throw new AppError(
        400,
        "INVALID_PRODUCT_UNIT",
        "Cette unité n'est pas définie pour ce produit."
      );
    if (error.code === "23503")
      throw new AppError(
        400,
        "INVALID_REFERENCE",
        "Le type de client ou l'unité indiqué n'existe pas."
      );
    throw error;
  }
}
async function resolveProductPrice(id, customerTypeId, unitId) {
  await getProduct(id);
  return productQueries.resolvePrice(id, customerTypeId, unitId);
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  listProductUnits,
  saveProductUnit,
  listProductPrices,
  saveProductPrice,
  resolveProductPrice
};
