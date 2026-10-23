jest.mock("../src/modules/sales/return.queries", () => ({
  one: jest.fn(),
  items: jest.fn(),
  create: jest.fn(),
  add: jest.fn(),
  complete: jest.fn()
}));
const q = require("../src/modules/sales/return.queries");
const s = require("../src/modules/sales/return.service");
describe("return service", () => {
  it("refuse un retour supérieur à la vente", async () => {
    q.add.mockRejectedValue(Object.assign(new Error(), { code: "RETURN_QUANTITY_EXCEEDED" }));
    await expect(s.add(1, {})).rejects.toMatchObject({
      status: 409,
      code: "RETURN_QUANTITY_EXCEEDED"
    });
  });
  it("refuse un retour vide", async () => {
    q.complete.mockRejectedValue(Object.assign(new Error(), { code: "RETURN_EMPTY" }));
    await expect(s.complete(1, 1)).rejects.toMatchObject({ status: 409, code: "RETURN_EMPTY" });
  });
});
