const AppError = require("../../common/app-error");
const q = require("./sale.queries");
async function get(id) {
  const x = await q.one(id);
  if (!x) throw new AppError(404, "SALE_NOT_FOUND", "La vente demandée est introuvable.");
  return x;
}
async function create(v) {
  try {
    const sale = await q.create(v);
    if (!sale)
      throw new AppError(
        400,
        "CUSTOMER_TYPE_MISMATCH",
        "Le type choisi ne correspond pas au client sélectionné."
      );
    return sale;
  } catch (e) {
    if (e.code === "23503")
      throw new AppError(400, "INVALID_CUSTOMER_TYPE", "Le type de client indiqué n'existe pas.");
    throw e;
  }
}
async function add(id, v) {
  try {
    const x = await q.add(id, v);
    if (!x) throw new AppError(404, "SALE_NOT_FOUND", "La vente demandée est introuvable.");
    return x;
  } catch (e) {
    if (
      [
        "SALE_NOT_DRAFT",
        "INVALID_PRODUCT",
        "INVALID_PRODUCT_UNIT",
        "PRICE_NOT_FOUND",
        "PRICE_NOT_WHOLE_FCFA",
        "SALE_CUSTOMER_TYPE_REQUIRED"
      ].includes(e.code)
    )
      throw new AppError(
        409,
        e.code,
        e.code === "SALE_NOT_DRAFT"
          ? "Seul un brouillon peut être modifié."
          : e.code === "PRICE_NOT_FOUND"
            ? "Aucun tarif actif n'est défini pour ce produit, ce type de client et cette unité."
            : e.code === "PRICE_NOT_WHOLE_FCFA"
              ? "Le tarif existant comporte des fractions de FCFA. Corrigez-le dans le catalogue avant la vente."
              : e.code === "SALE_CUSTOMER_TYPE_REQUIRED"
                ? "Ce brouillon historique n’a pas de type de client; créez une nouvelle vente avec le type de tarif voulu."
                : "Le produit ou son unité est invalide."
      );
    throw e;
  }
}
async function complete(id, user) {
  try {
    const x = await q.complete(id, user);
    if (!x) throw new AppError(404, "SALE_NOT_FOUND", "La vente demandée est introuvable.");
    return x;
  } catch (e) {
    if (["SALE_NOT_DRAFT", "SALE_EMPTY", "INSUFFICIENT_STOCK"].includes(e.code))
      throw new AppError(
        409,
        e.code,
        e.code === "INSUFFICIENT_STOCK"
          ? "Le stock est insuffisant."
          : e.code === "SALE_EMPTY"
            ? "Une vente vide ne peut pas être validée."
            : "Cette vente n'est plus un brouillon."
      );
    throw e;
  }
}
module.exports = {
  list: q.all,
  report: q.report,
  get,
  listItems: async (id) => {
    await get(id);
    return q.items(id);
  },
  create,
  add,
  complete
};
