import { AuthContext, type AuthContextValue } from "@/auth/auth-context";
import { saveSessionToken } from "@/auth/session-token";
import { StockCountPage } from "@/features/inventory/stock-count-page";
import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const authValue: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "9",
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    role: "ADMIN",
  },
  token: "stock-test-token",
  signIn: vi.fn(async () => {}),
  signInDemo: vi.fn(async () => {}),
  signOut: vi.fn(),
};

describe("parcours de comptage du stock", () => {
  it("ignore les requêtes annulées lors du remontage en mode strict", async () => {
    const responses: Record<string, unknown> = {
      "/api/inventory/products/7/stock": {
        id: "7",
        name: "Eau",
        sku: "EAU-7",
        current_stock: "0.000",
        critical_threshold: "2.000",
        base_unit_id: "3",
        is_active: true,
      },
      "/api/inventory/products/7/movements?limit=50": [],
      "/api/units": [{ id: "3", name: "Bouteille", symbol: "bt" }],
    };
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init?.signal;
          const rejectOnAbort = () =>
            reject(new DOMException("La requête a été annulée.", "AbortError"));
          if (signal?.aborted) {
            rejectOnAbort();
            return;
          }
          signal?.addEventListener("abort", rejectOnAbort, { once: true });
          setTimeout(() => {
            if (signal?.aborted) return;
            signal?.removeEventListener("abort", rejectOnAbort);
            resolve({
              ok: true,
              status: 200,
              json: async () => responses[String(input)],
            } as Response);
          }, 0);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    saveSessionToken(authValue.token!);

    render(
      <StrictMode>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={["/app/stock/7/initial"]}>
            <Routes>
              <Route
                path="/app/stock/:productId/initial"
                element={<StockCountPage mode="initial" />}
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </StrictMode>,
    );

    expect(await screen.findByText("Eau")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("enregistre le stock initial avec coût FCFA, motif et confirmation explicite", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const routes: Record<string, unknown> = {
          "GET /api/inventory/products/7/stock": {
            id: "7",
            name: "Eau",
            sku: "EAU-7",
            current_stock: "0.000",
            critical_threshold: "2.000",
            base_unit_id: "3",
            is_active: true,
          },
          "GET /api/inventory/products/7/movements?limit=50": [],
          "GET /api/units": [{ id: "3", name: "Bouteille", symbol: "bt" }],
        };
        const key = `${init?.method || "GET"} ${url}`;
        const body =
          key === "POST /api/inventory/opening-stock"
            ? {
                operationId: "10",
                currentStock: "12.000",
                averageCost: "700.00",
              }
            : (routes[key] ?? { error: { message: "Requête imprévue" } });
        const status =
          key === "POST /api/inventory/opening-stock"
            ? 201
            : key in routes
              ? 200
              : 404;
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
        } as Response;
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    saveSessionToken(authValue.token!);
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/app/stock/7/initial"]}>
          <Routes>
            <Route
              path="/app/stock/:productId/initial"
              element={<StockCountPage mode="initial" />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const submit = await screen.findByRole("button", {
      name: "Confirmer le mouvement",
    });
    await screen.findByText("Eau");
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Quantité initiale (bt)"), "12");
    await user.type(
      screen.getByLabelText("Coût d’achat par bt (F CFA)"),
      "700",
    );
    await user.type(
      screen.getByLabelText("Motif de l’opération"),
      "Inventaire avant ouverture",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(submit);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventory/opening-stock",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === "/api/inventory/opening-stock" &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      product_id: 7,
      quantity: "12",
      reason: "Inventaire avant ouverture",
      unit_cost: "700",
    });
    expect(
      await screen.findByText("Stock enregistré avec succès."),
    ).toBeInTheDocument();
  });
});
