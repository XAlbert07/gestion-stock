const AppError = require("../../common/app-error");
const q = require("./return.queries");
async function get(id) {
  const x = await q.one(id);
  if (!x) throw new AppError(404, "RETURN_NOT_FOUND", "Le retour demandé est introuvable.");
  return x;
}
async function add(id, v) {
  try {
    const x = await q.add(id, v);
    if (!x) throw new AppError(404, "RETURN_NOT_FOUND", "Le retour demandé est introuvable.");
    return x;
  } catch (e) {
    if (
      [
        "RETURN_NOT_DRAFT",
        "SALE_NOT_COMPLETED",
        "INVALID_SALE_ITEM",
        "RETURN_QUANTITY_EXCEEDED"
      ].includes(e.code)
    )
      throw new AppError(
        409,
        e.code,
        e.code === "RETURN_QUANTITY_EXCEEDED"
          ? "La quantité retournée dépasse la quantité vendue."
          : "Cette ligne ne peut pas être ajoutée au retour."
      );
    throw e;
  }
}
async function complete(id, user) {
  try {
    const x = await q.complete(id, user);
    if (!x) throw new AppError(404, "RETURN_NOT_FOUND", "Le retour demandé est introuvable.");
    return x;
  } catch (e) {
    if (["RETURN_NOT_DRAFT", "RETURN_EMPTY"].includes(e.code))
      throw new AppError(
        409,
        e.code,
        e.code === "RETURN_EMPTY"
          ? "Un retour vide ne peut pas être validé."
          : "Ce retour n'est plus un brouillon."
      );
    throw e;
  }
}
module.exports = {
  get,
  items: async (id) => {
    await get(id);
    return q.items(id);
  },
  create: q.create,
  add,
  complete
};
