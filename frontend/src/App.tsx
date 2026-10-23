import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/auth-provider";
import { RequireAuth } from "@/auth/require-auth";
import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/pages/dashboard-page";
import { LoginPage } from "@/pages/login-page";
import { CatalogPage } from "@/features/catalog/catalog-page";
import { CatalogProductFormPage } from "@/features/catalog/catalog-product-form-page";
import { CatalogReferencesPage } from "@/features/catalog/catalog-references-page";
import { ProductPricesPage } from "@/features/catalog/product-prices-page";
import { StockPage } from "@/features/inventory/stock-page";
import { StockCountPage } from "@/features/inventory/stock-count-page";
import { ReceiptsPage } from "@/features/receipts/receipts-page";
import { ReceiptDetailPage } from "@/features/receipts/receipt-detail-page";
import { SalesPage } from "@/features/sales/sales-page";
import { SaleDetailPage } from "@/features/sales/sale-detail-page";
import { SaleReturnDetailPage } from "@/features/sales/sale-return-detail-page";
import { CustomersPage } from "@/features/sales/customers-page";
import { SuppliersPage } from "@/features/suppliers/suppliers-page";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="catalogue" element={<CatalogPage />} />
              <Route
                path="catalogue/nouveau"
                element={<CatalogProductFormPage />}
              />
              <Route
                path="catalogue/referentiels"
                element={<CatalogReferencesPage />}
              />
              <Route
                path="catalogue/:productId/tarifs"
                element={<ProductPricesPage />}
              />
              <Route
                path="catalogue/:productId/modifier"
                element={<CatalogProductFormPage />}
              />
              <Route path="stock" element={<StockPage />} />
              <Route path="stock/:productId" element={<StockPage />} />
              <Route
                path="stock/:productId/initial"
                element={<StockCountPage mode="initial" />}
              />
              <Route
                path="stock/:productId/comptage"
                element={<StockCountPage mode="count" />}
              />
              <Route path="receptions" element={<ReceiptsPage />} />
              <Route path="fournisseurs" element={<SuppliersPage />} />
              <Route
                path="receptions/:receiptId"
                element={<ReceiptDetailPage />}
              />
              <Route path="ventes" element={<SalesPage />} />
              <Route path="clients" element={<CustomersPage />} />
              <Route
                path="ventes/retours/:returnId"
                element={<SaleReturnDetailPage />}
              />
              <Route path="ventes/:saleId" element={<SaleDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
