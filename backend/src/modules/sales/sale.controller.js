const s = require("./sale.service");
const v = require("./sale.validation");
async function list(req, res, next) {
  try {
    res.json(await s.list(v.listFilters(req.query)));
  } catch (e) {
    next(e);
  }
}
async function report(req, res, next) {
  try {
    res.json(await s.report(v.reportRange(req.query)));
  } catch (e) {
    next(e);
  }
}
async function get(req, res, next) {
  try {
    res.json(await s.get(v.id(req.params.id, "L'identifiant de la vente")));
  } catch (e) {
    next(e);
  }
}
async function items(req, res, next) {
  try {
    res.json(await s.listItems(v.id(req.params.id, "L'identifiant de la vente")));
  } catch (e) {
    next(e);
  }
}
async function create(req, res, next) {
  try {
    res.status(201).json(await s.create({ ...v.draft(req.body || {}), createdBy: req.user.sub }));
  } catch (e) {
    next(e);
  }
}
async function add(req, res, next) {
  try {
    res
      .status(201)
      .json(await s.add(v.id(req.params.id, "L'identifiant de la vente"), v.item(req.body || {})));
  } catch (e) {
    next(e);
  }
}
async function complete(req, res, next) {
  try {
    res.json(await s.complete(v.id(req.params.id, "L'identifiant de la vente"), req.user.sub));
  } catch (e) {
    next(e);
  }
}
module.exports = { list, report, get, items, create, add, complete };
