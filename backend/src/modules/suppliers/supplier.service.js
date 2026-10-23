const AppError = require("../../common/app-error");
const queries = require("./supplier.queries");

async function updateSupplier(id, supplier) {
  const updated = await queries.update(id, supplier);
  if (!updated)
    throw new AppError(404, "SUPPLIER_NOT_FOUND", "Le fournisseur demandé est introuvable.");
  return updated;
}

module.exports = {
  listSuppliers: queries.findAll,
  createSupplier: queries.insert,
  updateSupplier
};
