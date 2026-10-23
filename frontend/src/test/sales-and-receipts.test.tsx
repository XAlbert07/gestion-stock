import { AuthContext, type AuthContextValue } from "@/auth/auth-context";
import { saveSessionToken } from "@/auth/session-token";
import { ReceiptDetailPage } from "@/features/receipts/receipt-detail-page";
import { ReceiptsPage } from "@/features/receipts/receipts-page";
import { SaleDetailPage } from "@/features/sales/sale-detail-page";
import { SaleReturnDetailPage } from "@/features/sales/sale-return-detail-page";
import { SalesPage } from "@/features/sales/sales-page";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

type MockResponse = { status?: number; body: unknown };

const authValue: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "9",
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    role: "ADMIN",
  },
  token: "test-session-token",
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(),
};

function installApi(responses: Record<string, MockResponse>) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method || "GET"} ${String(input)}`;
      const response = responses[key] ||
        responses[key.split("?")[0]] || {
          status: 404,
          body: { error: { message: `Unexpected request: ${key}` } },
        };
      const status = response.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => response.body,
      } as Response;
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderRoute(path: string) {
  saveSessionToken(authValue.token!);
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/receptions" element={<ReceiptsPage />} />
          <Route
            path="/app/receptions/:receiptId"
            element={<ReceiptDetailPage />}
          />
          <Route path="/app/ventes" element={<SalesPage />} />
          <Route
            path="/app/ventes/retours/:returnId"
            element={<SaleReturnDetailPage />}
          />
          <Route path="/app/ventes/:saleId" element={<SaleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("parcours métier frontend", () => {
  it("présente les ventes validées et les retours sans les confondre avec un encaissement", async () => {
    installApi({
      "GET /api/sales": { body: { data: [], total: 0, page: 1, limit: 20 } },
      "GET /api/sales/report": {
        body: {
          from: "2026-10-19",
          to: "2026-10-19",
          timezone: "Africa/Ouagadougou",
          sales: {
            sale_count: 2,
            sales_total_fcfa: "1500.00",
          },
          returns: {
            return_count: 1,
            returned_items_value_fcfa: "500.00",
          },
          sold_by_unit: [
            {
              unit_id: 1,
              unit_name: "Bouteille",
              unit_symbol: "bt",
              quantity: "3.000",
            },
          ],
          returned_by_unit: [
            {
              unit_id: 1,
              unit_name: "Bouteille",
              unit_symbol: "bt",
              quantity: "1.000",
            },
          ],
        },
      },
      "GET /api/customers": { body: [] },
      "GET /api/customers/types": { body: [{ id: "1", name: "Particulier" }] },
    });

    renderRoute("/app/ventes");

    expect(await screen.findByText("Ventes de la période")).toBeInTheDocument();
    expect(
      screen.getByText(/Le montant des ventes n’est pas un montant encaissé/),
    ).toBeInTheDocument();
    expect(screen.getByText("Retours physiques")).toBeInTheDocument();
    expect(screen.getByText(/pas un remboursement/)).toBeInTheDocument();
  });

  it("bloque la création d’une réception sans fournisseur actif et affiche l’historique vide", async () => {
    installApi({
      "GET /api/receipts": { body: [] },
      "GET /api/suppliers": { body: [] },
    });

    renderRoute("/app/receptions");

    expect(
      await screen.findByText("Aucune réception enregistrée."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Aucun fournisseur actif/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Créer le brouillon/ }),
    ).toBeDisabled();
  });

  it("ajoute une ligne à un brouillon de réception avec l’unité de base du produit", async () => {
    const receipt = {
      id: "3",
      supplier_id: "8",
      supplier_name: "Fournisseur test",
      reference: "REC-3",
      status: "DRAFT",
      operation_id: null,
      created_at: "2026-10-18T10:00:00Z",
      received_at: null,
      notes: null,
    };
    const product = {
      id: "2",
      category_id: "1",
      base_unit_id: "3",
      name: "Produit test",
      sku: "PRD-2",
      current_stock: "0",
      critical_threshold: "0",
      is_active: true,
    };
    const fetchMock = installApi({
      "GET /api/receipts/3": { body: receipt },
      "GET /api/receipts/3/items": { body: [] },
      "GET /api/products?page=1&limit=100": {
        body: { data: [product], meta: { page: 1, limit: 100, total: 1 } },
      },
      "GET /api/products/2/units": { body: [] },
      "GET /api/units": { body: [{ id: "3", name: "Unité", symbol: "u" }] },
      "POST /api/receipts/3/items": {
        status: 201,
        body: {
          id: "1",
          receipt_id: "3",
          product_id: "2",
          unit_id: "3",
          product_name: "Produit test",
          unit_symbol: "u",
          quantity: "4",
          unit_purchase_price: "50",
        },
      },
    });
    const user = userEvent.setup();

    renderRoute("/app/receptions/3");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/products?page=1&limit=100",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await screen.findByRole("option", { name: /Produit test/ });
    await user.selectOptions(screen.getByLabelText("Produit à ajouter"), "2");
    await screen.findByRole("option", { name: /unité de base/ });
    await user.selectOptions(
      await screen.findByLabelText("Unité de réception"),
      "3",
    );
    await user.clear(screen.getByLabelText("Quantité"));
    await user.type(screen.getByLabelText("Quantité"), "4");
    await user.clear(screen.getByLabelText("Prix d’achat par unité (F CFA)"));
    await user.type(
      screen.getByLabelText("Prix d’achat par unité (F CFA)"),
      "50",
    );
    await user.click(
      screen.getByRole("button", { name: /Ajouter à la réception/ }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/receipts/3/items",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const addRequest = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url) === "/api/receipts/3/items" && options?.method === "POST",
    );
    expect(JSON.parse(String(addRequest?.[1]?.body))).toEqual({
      product_id: "2",
      unit_id: "3",
      quantity: "4",
      unit_purchase_price: "50",
    });
    expect(new Headers(addRequest?.[1]?.headers).get("Authorization")).toBe(
      "Bearer test-session-token",
    );
  });

  it("crée une vente avec client facultatif et ouvre le brouillon", async () => {
    const sale = {
      id: "12",
      customer_id: null,
      customer_type_id: "5",
      customer_name: null,
      reference: "TICKET-12",
      status: "DRAFT",
      operation_id: null,
      created_at: "2026-10-18T10:00:00Z",
      sold_at: null,
      total_amount: "0.00",
    };
    const fetchMock = installApi({
      "GET /api/sales": { body: [] },
      "GET /api/customers": { body: [] },
      "GET /api/customers/types": { body: [{ id: "5", name: "Particulier" }] },
      "POST /api/sales": { status: 201, body: sale },
      "GET /api/sales/12": { body: sale },
      "GET /api/sales/12/items": { body: [] },
    });
    const user = userEvent.setup();

    renderRoute("/app/ventes");

    await screen.findByRole("option", { name: "Particulier" });
    await user.selectOptions(
      screen.getByLabelText("Type de client pour le tarif"),
      "5",
    );
    await user.type(
      screen.getByLabelText("Référence du ticket ou référence interne"),
      "TICKET-12",
    );
    await user.click(
      screen.getByRole("button", { name: /Créer le brouillon/ }),
    );

    expect(await screen.findByText("TICKET-12")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sales",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const createRequest = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url) === "/api/sales" && options?.method === "POST",
    );
    expect(JSON.parse(String(createRequest?.[1]?.body))).toEqual({
      customer_id: null,
      customer_type_id: "5",
      reference: "TICKET-12",
    });
    expect(new Headers(createRequest?.[1]?.headers).get("Authorization")).toBe(
      "Bearer test-session-token",
    );
  });

  it("affiche l’état vide d’un brouillon et empêche la validation sans ligne", async () => {
    const sale = {
      id: "20",
      customer_id: null,
      customer_name: null,
      reference: "SALE-20",
      status: "DRAFT",
      operation_id: null,
      created_at: "2026-10-18T10:00:00Z",
      sold_at: null,
      total_amount: "0.00",
    };
    installApi({
      "GET /api/sales/20": { body: sale },
      "GET /api/sales/20/items": { body: [] },
      "GET /api/products?page=1&limit=100": {
        body: { data: [], meta: { page: 1, limit: 100, total: 0 } },
      },
    });

    renderRoute("/app/ventes/20");

    expect(
      await screen.findByText("Aucun article dans cette vente."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Valider la vente" }),
    ).toBeDisabled();
  });

  it("restitue le refus serveur lorsqu’une quantité dépasse le solde encore retournable", async () => {
    const returned = {
      id: "7",
      sale_id: "20",
      reference: "RET-7",
      status: "DRAFT",
      operation_id: null,
      created_at: "2026-10-18T10:00:00Z",
      returned_at: null,
      reason: "Test retour",
    };
    const sale = {
      id: "20",
      customer_id: null,
      customer_name: null,
      reference: "SALE-20",
      status: "COMPLETED",
      operation_id: "30",
      created_at: "2026-10-18T09:00:00Z",
      sold_at: "2026-10-18T09:30:00Z",
      total_amount: "200.00",
    };
    const soldItem = {
      id: "4",
      sale_id: "20",
      product_id: "2",
      unit_id: "3",
      product_name: "Produit test",
      quantity: "2.000",
      conversion_factor: "1.000",
      base_quantity: "2.000",
      unit_price: "100.00",
      line_total: "200.00",
    };
    installApi({
      "GET /api/sales/returns/7": { body: returned },
      "GET /api/sales/returns/7/items": { body: [] },
      "GET /api/sales/20": { body: sale },
      "GET /api/sales/20/items": { body: [soldItem] },
      "GET /api/units": { body: [{ id: "3", name: "Unité", symbol: "u" }] },
      "POST /api/sales/returns/7/items": {
        status: 409,
        body: {
          error: {
            message: "La quantité retournée dépasse la quantité vendue.",
          },
        },
      },
    });
    const user = userEvent.setup();

    renderRoute("/app/ventes/retours/7");

    await screen.findByRole("option", { name: /Produit test/ });
    await user.selectOptions(
      await screen.findByLabelText("Article de la vente d’origine"),
      "4",
    );
    const quantity = screen.getByLabelText("Quantité à retourner");
    await user.clear(quantity);
    await user.type(quantity, "2");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La quantité retournée dépasse la quantité vendue.",
    );
    expect(
      screen.getByRole("button", { name: "Valider le retour" }),
    ).toBeDisabled();
  });
});
