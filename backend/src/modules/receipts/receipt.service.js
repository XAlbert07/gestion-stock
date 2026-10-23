const AppError = require("../../common/app-error");
const queries = require("./receipt.queries");

async function getReceipt(id) {
  const receipt = await queries.findById(id);
  if (!receipt)
    throw new AppError(404, "RECEIPT_NOT_FOUND", "La réception demandée est introuvable.");
  return receipt;
}
async function addItem(id, item) {
  try {
    const result = await queries.addItem(id, item);
    if (!result)
      throw new AppError(404, "RECEIPT_NOT_FOUND", "La réception demandée est introuvable.");
    return result;
  } catch (error) {
    if (["RECEIPT_NOT_DRAFT", "INVALID_PRODUCT", "INVALID_PRODUCT_UNIT"].includes(error.code))
      throw new AppError(
        409,
        error.code,
        error.code === "RECEIPT_NOT_DRAFT"
          ? "Seul un brouillon peut être modifié."
          : "Le produit ou son unité de réception est invalide."
      );
    throw error;
  }
}
async function complete(id, userId) {
  try {
    const result = await queries.complete(id, userId);
    if (!result)
      throw new AppError(404, "RECEIPT_NOT_FOUND", "La réception demandée est introuvable.");
    return result;
  } catch (error) {
    if (["RECEIPT_NOT_DRAFT", "RECEIPT_EMPTY"].includes(error.code))
      throw new AppError(
        409,
        error.code,
        error.code === "RECEIPT_EMPTY"
          ? "Une réception vide ne peut pas être validée."
          : "Cette réception n'est plus un brouillon."
      );
    throw error;
  }
}

async function createDraft(receipt) {
  const created = await queries.createDraft(receipt);
  if (!created) {
    throw new AppError(409, "SUPPLIER_NOT_ACTIVE", "Choisissez un fournisseur existant et actif.");
  }
  return created;
}

async function listReceipts(filters = {}) {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const { items, total } = await queries.findAll({ search: filters.search || "", limit, offset });
  return { items, total, page, limit };
}

module.exports = {
  listReceipts,
  getReceipt,
  listItems: async (id) => {
    await getReceipt(id);
    return queries.findItems(id);
  },
  createDraft,
  addItem,
  complete
};
