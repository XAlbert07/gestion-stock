const service = require("./supplier.service");
const { supplier, supplierUpdate, id } = require("./supplier.validation");
async function getSuppliers(req, res, next) {
  try {
    res.json(
      await service.listSuppliers({ includeInactive: req.query.include_inactive === "true" })
    );
  } catch (error) {
    next(error);
  }
}
async function createSupplier(req, res, next) {
  try {
    res.status(201).json(await service.createSupplier(supplier(req.body || {})));
  } catch (error) {
    next(error);
  }
}
async function updateSupplier(req, res, next) {
  try {
    res.json(await service.updateSupplier(id(req.params.id), supplierUpdate(req.body || {})));
  } catch (error) {
    next(error);
  }
}
module.exports = { getSuppliers, createSupplier, updateSupplier };
