const AppError = require("../../common/app-error");
const queries = require("./catalog.queries");

async function mapConflict(operation, message) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === "23505") throw new AppError(409, "CATALOG_ENTRY_ALREADY_EXISTS", message);
    throw error;
  }
}

module.exports = {
  listCategories: queries.findCategories,
  listUnits: queries.findUnits,
  createCategory: (category) =>
    mapConflict(() => queries.insertCategory(category), "Cette catégorie existe déjà."),
  createUnit: (unit) =>
    mapConflict(() => queries.insertUnit(unit), "Cette unité ou ce symbole existe déjà."),
  updateCategory: async (id, category) => {
    const result = await mapConflict(
      () => queries.updateCategory(id, category),
      "Cette catégorie existe déjà."
    );
    if (!result) throw new AppError(404, "CATEGORY_NOT_FOUND", "Cette catégorie est introuvable.");
    return result;
  },
  updateUnit: async (id, unit) => {
    const result = await mapConflict(
      () => queries.updateUnit(id, unit),
      "Cette unité ou ce symbole existe déjà."
    );
    if (!result) throw new AppError(404, "UNIT_NOT_FOUND", "Cette unité est introuvable.");
    return result;
  }
};
