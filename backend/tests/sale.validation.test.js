const AppError = require("../src/common/app-error");
const validation = require("../src/modules/sales/sale.validation");

describe("sales query validation", () => {
  it("accepts a valid bounded list query and applies safe defaults", () => {
    expect(validation.listFilters({ from: "2026-10-01", to: "2026-10-19" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-19",
      status: null,
      page: 1,
      limit: 20,
      search: ""
    });
  });

  it.each([
    [{ from: "2026-02-31", to: "2026-03-01" }, "invalid date"],
    [{ from: "2026-10-20", to: "2026-10-19" }, "reversed date range"],
    [{ from: "2026-01-01" }, "incomplete date range"],
    [{ page: "0" }, "invalid page"],
    [{ limit: "101" }, "excessive page size"],
    [{ status: "PAID" }, "unsupported status"]
  ])("rejects %s (%s)", (query) => {
    expect(() => validation.listFilters(query)).toThrow(AppError);
  });

  it("requires both dates for a sales report", () => {
    expect(() => validation.reportRange({ from: "2026-10-01" })).toThrow(AppError);
    expect(validation.reportRange({ from: "2026-10-01", to: "2026-10-19" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-19"
    });
  });
});
