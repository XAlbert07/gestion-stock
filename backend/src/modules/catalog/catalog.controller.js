const service = require("./catalog.service");
const validation = require("./catalog.validation");

function handler(action) {
  return async (req, res, next) => {
    try {
      const result = await action(req);
      res.status(req.method === "POST" ? 201 : 200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  getCategories: handler(() => service.listCategories()),
  createCategory: handler((req) => service.createCategory(validation.category(req.body || {}))),
  getUnits: handler(() => service.listUnits()),
  createUnit: handler((req) => service.createUnit(validation.unit(req.body || {}))),
  updateCategory: handler((req) =>
    service.updateCategory(validation.id(req.params.id), validation.category(req.body || {}))
  ),
  updateUnit: handler((req) =>
    service.updateUnit(validation.id(req.params.id), validation.unit(req.body || {}))
  )
};
