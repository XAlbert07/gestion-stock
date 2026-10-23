jest.mock("../src/modules/sales/sale.queries", () => ({
  all: jest.fn(),
  one: jest.fn(),
  items: jest.fn(),
  create: jest.fn(),
  add: jest.fn(),
  complete: jest.fn()
}));
const q = require("../src/modules/sales/sale.queries");
const s = require("../src/modules/sales/sale.service");
describe("sale service", () => {
  it("refuse une vente sans stock", async () => {
    q.complete.mockRejectedValue(Object.assign(new Error(), { code: "INSUFFICIENT_STOCK" }));
    await expect(s.complete(1, 1)).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK"
    });
  });
  it("refuse une vente vide", async () => {
    q.complete.mockRejectedValue(Object.assign(new Error(), { code: "SALE_EMPTY" }));
    await expect(s.complete(1, 1)).rejects.toMatchObject({ status: 409, code: "SALE_EMPTY" });
  });
});
