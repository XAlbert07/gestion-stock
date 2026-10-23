const s = require("./return.service");
const v = require("./sale.validation");
async function get(req, res, next) {
  try {
    res.json(await s.get(v.id(req.params.returnId, "L'identifiant du retour")));
  } catch (e) {
    next(e);
  }
}
async function items(req, res, next) {
  try {
    res.json(await s.items(v.id(req.params.returnId, "L'identifiant du retour")));
  } catch (e) {
    next(e);
  }
}
async function create(req, res, next) {
  try {
    res.status(201).json(
      await s.create(v.id(req.params.saleId, "L'identifiant de la vente"), {
        ...v.returnDraft(req.body || {}),
        createdBy: req.user.sub
      })
    );
  } catch (e) {
    next(e);
  }
}
async function add(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await s.add(
          v.id(req.params.returnId, "L'identifiant du retour"),
          v.returnItem(req.body || {})
        )
      );
  } catch (e) {
    next(e);
  }
}
async function complete(req, res, next) {
  try {
    res.json(await s.complete(v.id(req.params.returnId, "L'identifiant du retour"), req.user.sub));
  } catch (e) {
    next(e);
  }
}
module.exports = { get, items, create, add, complete };
