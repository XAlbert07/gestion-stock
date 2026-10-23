jest.mock("../src/modules/inventory/inventory.queries", () => ({
  findStock: jest.fn(),
  findMovements: jest.fn(),
  createAdjustment: jest.fn(),
  initializeStock: jest.fn(),
  countStock: jest.fn(),
  reverseOperation: jest.fn()
}));

const queries = require("../src/modules/inventory/inventory.queries");
const service = require("../src/modules/inventory/inventory.service");

describe("inventory service", () => {
  it("refuse une sortie sans stock disponible", async () => {
    queries.createAdjustment.mockRejectedValue(
      Object.assign(new Error(), { code: "INSUFFICIENT_STOCK" })
    );

    await expect(
      service.adjustStock({ productId: 1, direction: "OUT", quantity: "1" })
    ).rejects.toMatchObject({ status: 409, code: "INSUFFICIENT_STOCK" });
  });

  it("retourne une erreur lorsque le produit est absent", async () => {
    queries.findStock.mockResolvedValue(undefined);

    await expect(service.getStock(99)).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND"
    });
  });

  it("refuse de réinitialiser un stock déjà ouvert", async () => {
    queries.initializeStock.mockRejectedValue(
      Object.assign(new Error(), { code: "STOCK_ALREADY_INITIALIZED" })
    );
    await expect(
      service.initializeStock({ productId: 1, countedQuantity: "2", unitCost: "100" })
    ).rejects.toMatchObject({ status: 409, code: "STOCK_ALREADY_INITIALIZED" });
  });

  it("demande un coût pour valoriser un écart de stock positif", async () => {
    queries.countStock.mockRejectedValue(
      Object.assign(new Error(), { code: "UNIT_COST_REQUIRED" })
    );
    await expect(
      service.countStock({ productId: 1, countedQuantity: "2", unitCost: null })
    ).rejects.toMatchObject({ status: 400, code: "UNIT_COST_REQUIRED" });
  });

  it("refuse une deuxième annulation de la même opération", async () => {
    queries.reverseOperation.mockRejectedValue(
      Object.assign(new Error(), { code: "OPERATION_ALREADY_REVERSED" })
    );

    await expect(service.cancelOperation(2)).rejects.toMatchObject({
      status: 409,
      code: "OPERATION_ALREADY_REVERSED"
    });
  });

  it("refuse l'annulation d'une réception validée", async () => {
    queries.reverseOperation.mockRejectedValue(
      Object.assign(new Error(), { code: "RECEIPT_CANNOT_BE_CANCELLED" })
    );

    await expect(service.cancelOperation(2)).rejects.toMatchObject({
      status: 409,
      code: "RECEIPT_CANNOT_BE_CANCELLED"
    });
  });
});
