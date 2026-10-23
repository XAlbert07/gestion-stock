const s = require("./customer.service");
const v = require("./customer.validation");
async function types(req, res, next) {
  try {
    res.json(await s.listTypes());
  } catch (e) {
    next(e);
  }
}
async function customers(req, res, next) {
  try {
    res.json(await s.listCustomers());
  } catch (e) {
    next(e);
  }
}
async function createType(req, res, next) {
  try {
    res.status(201).json(await s.createType(v.customerType(req.body || {})));
  } catch (e) {
    next(e);
  }
}
async function createCustomer(req, res, next) {
  try {
    res.status(201).json(await s.createCustomer(v.customer(req.body || {})));
  } catch (e) {
    next(e);
  }
}
module.exports = { types, customers, createType, createCustomer };
