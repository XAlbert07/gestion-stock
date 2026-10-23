const AppError = require("../../common/app-error");
const q = require("./customer.queries");
async function conflict(action, message) {
  try {
    return await action();
  } catch (error) {
    if (error.code === "23505") throw new AppError(409, "CUSTOMER_ALREADY_EXISTS", message);
    if (error.code === "23503")
      throw new AppError(400, "INVALID_REFERENCE", "Le type de client indiqué n'existe pas.");
    throw error;
  }
}
module.exports = {
  listTypes: q.types,
  listCustomers: q.customers,
  createType: (v) => conflict(() => q.addType(v), "Ce type de client existe déjà."),
  createCustomer: (v) => conflict(() => q.addCustomer(v), "Ce client existe déjà.")
};
