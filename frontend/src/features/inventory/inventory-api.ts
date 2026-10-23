import { apiRequest } from "@/lib/api";

export type ProductStock = {
  id: string | number;
  name: string;
  sku: string;
  current_stock: string | number;
  critical_threshold: string | number;
  base_unit_id: string | number;
  is_active: boolean;
};

export type StockMovement = {
  id: string | number;
  direction: "IN" | "OUT";
  base_quantity: string | number;
  created_at: string;
  operation_id: string | number;
  operation_type: string;
  notes: string | null;
  product_id?: string | number;
  product_name?: string;
  sku?: string;
  unit_symbol?: string;
};

export type StockSummary = {
  active_products: number;
  out_of_stock: number;
  low_stock: number;
  movements_last_7_days: number;
  recent_movements: StockMovement[];
};

export type StockProduct = ProductStock & {
  average_cost: string | number;
  unit_name: string;
  unit_symbol: string;
};

export type StockProductPage = {
  data: StockProduct[];
  meta: { page: number; limit: number; total: number };
};

export function getStockSummary(signal?: AbortSignal) {
  return apiRequest<StockSummary>("/inventory/summary", { signal });
}

export function listStockProducts(
  filters: {
    page: number;
    limit: number;
    search: string;
    status: "ALL" | "LOW" | "OUT";
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
    status: filters.status,
  });
  if (filters.search) query.set("search", filters.search);
  return apiRequest<StockProductPage>(`/inventory/products?${query}`, {
    signal,
  });
}

export async function getProductStock(productId: string, signal?: AbortSignal) {
  return apiRequest<ProductStock>(
    `/inventory/products/${encodeURIComponent(productId)}/stock`,
    { signal },
  );
}

export async function getProductMovements(
  productId: string,
  filters: { from?: string; to?: string; operationType?: string } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: "50" });
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.operationType) query.set("operation_type", filters.operationType);
  return apiRequest<StockMovement[]>(
    `/inventory/products/${encodeURIComponent(productId)}/movements?${query}`,
    { signal },
  );
}

export async function createOpeningStock(payload: {
  product_id: number;
  quantity: string;
  unit_cost: string;
  reason: string;
}) {
  return apiRequest<{
    operationId: string | number;
    currentStock: string | number;
    averageCost: string | number;
  }>("/inventory/opening-stock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createStockCount(payload: {
  product_id: number;
  quantity: string;
  unit_cost?: string;
  reason: string;
}) {
  return apiRequest<{
    operationId: string | number;
    currentStock: string | number;
    countedQuantity: string | number;
    averageCost: string | number;
  }>("/inventory/counts", { method: "POST", body: JSON.stringify(payload) });
}
