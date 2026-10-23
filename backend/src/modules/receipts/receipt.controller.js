const service = require("./receipt.service");
const validation = require("./receipt.validation");

async function list(req, res, next) {
  try {
    const filters = validation.listFilters(req.query);
    res.json(await service.listReceipts(filters));
  } catch (error) {
    next(error);
  }
}
async function get(req, res, next) {
  try {
    res.json(
      await service.getReceipt(validation.id(req.params.id, "L'identifiant de la réception"))
    );
  } catch (error) {
    next(error);
  }
}
async function items(req, res, next) {
  try {
    res.json(
      await service.listItems(validation.id(req.params.id, "L'identifiant de la réception"))
    );
  } catch (error) {
    next(error);
  }
}
async function create(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await service.createDraft({ ...validation.draft(req.body || {}), createdBy: req.user.sub })
      );
  } catch (error) {
    next(error);
  }
}
async function addItem(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await service.addItem(
          validation.id(req.params.id, "L'identifiant de la réception"),
          validation.item(req.body || {})
        )
      );
  } catch (error) {
    next(error);
  }
}
async function complete(req, res, next) {
  try {
    res.json(
      await service.complete(
        validation.id(req.params.id, "L'identifiant de la réception"),
        req.user.sub
      )
    );
  } catch (error) {
    next(error);
  }
}
module.exports = { list, get, items, create, addItem, complete };
