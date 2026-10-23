jest.mock("../src/modules/receipts/receipt.queries", () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findItems: jest.fn(),
  createDraft: jest.fn(),
  addItem: jest.fn(),
  complete: jest.fn()
}));

const queries = require("../src/modules/receipts/receipt.queries");
const service = require("../src/modules/receipts/receipt.service");

describe("receipt service", () => {
  it("refuse de valider une réception vide", async () => {
    queries.complete.mockRejectedValue(Object.assign(new Error(), { code: "RECEIPT_EMPTY" }));

    await expect(service.complete(1, 1)).rejects.toMatchObject({
      status: 409,
      code: "RECEIPT_EMPTY"
    });
  });

  it("refuse l'ajout d'une ligne après validation", async () => {
    queries.addItem.mockRejectedValue(Object.assign(new Error(), { code: "RECEIPT_NOT_DRAFT" }));

    await expect(service.addItem(1, {})).rejects.toMatchObject({
      status: 409,
      code: "RECEIPT_NOT_DRAFT"
    });
  });
});
