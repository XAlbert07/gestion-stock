import { apiRequest } from "@/lib/api";

export type SaleStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type Customer = {
  id: string | number;
  name: string;
  customer_type_name?: string;
  customer_type_id: string | number;
  phone?: string | null;
  address?: string | null;
};
export type CustomerType = { id: string | number; name: string };
export type Sale = {
  id: string | number;
  customer_id: string | number | null;
  customer_type_id: string | number | null;
  customer_type_name?: string | null;
  customer_name?: string | null;
  reference: string;
  status: SaleStatus;
  operation_id: string | number | null;
  created_at: string;
  sold_at: string | null;
  total_amount: string | number;
};
export type SalesPageResult = {
  data: Sale[];
  total: number;
  page: number;
  limit: number;
};
export type SalesReport = {
  from: string;
  to: string;
  timezone: string;
  sales: {
    sale_count: number;
    sales_total_fcfa: string;
  };
  returns: {
    return_count: number;
    returned_items_value_fcfa: string;
  };
  sold_by_unit: Array<{
    unit_id: string | number;
    unit_name: string;
    unit_symbol: string;
    quantity: string;
  }>;
  returned_by_unit: Array<{
    unit_id: string | number;
    unit_name: string;
    unit_symbol: string;
    quantity: string;
  }>;
};
export type SaleItem = {
  id: string | number;
  sale_id: string | number;
  product_id: string | number;
  unit_id: string | number;
  product_name: string;
  quantity: string | number;
  conversion_factor: string | number;
  base_quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
};
export type SaleDraftInput = {
  customer_id?: string | null;
  customer_type_id: string;
  reference: string;
};
export type SaleItemInput = {
  product_id: string;
  unit_id: string;
  quantity: string;
};
export type SaleReturn = {
  id: string | number;
  sale_id: string | number;
  reference: string;
  status: SaleStatus;
  operation_id: string | number | null;
  created_at: string;
  returned_at: string | null;
  reason: string | null;
};
export type SaleReturnItem = {
  id: string | number;
  return_id: string | number;
  sale_item_id: string | number;
  product_id: string | number;
  unit_id: string | number;
  product_name: string;
  quantity: string | number;
  conversion_factor: string | number;
  base_quantity: string | number;
  unit_price: string | number;
  cost_at_return: string | number;
};

export function listSales(
  filters: {
    from?: string;
    to?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiRequest<SalesPageResult>(`/sales?${query.toString()}`, { signal });
}

export function getSalesReport(from: string, to: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ from, to });
  return apiRequest<SalesReport>(`/sales/report?${query.toString()}`, {
    signal,
  });
}

export function listCustomers(signal?: AbortSignal) {
  return apiRequest<Customer[]>("/customers", { signal });
}

export function listCustomerTypes(signal?: AbortSignal) {
  return apiRequest<CustomerType[]>("/customers/types", { signal });
}

export function createCustomerType(token: string, name: string) {
  return apiRequest<CustomerType>("/customers/types", {
    method: "POST",
    token,
    body: JSON.stringify({ name }),
  });
}

export function createCustomer(
  token: string,
  input: {
    customer_type_id: number;
    name: string;
    phone: string;
    address: string;
  },
) {
  return apiRequest<Customer>("/customers", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function getSale(saleId: string, signal?: AbortSignal) {
  return apiRequest<Sale>(`/sales/${encodeURIComponent(saleId)}`, { signal });
}

export function listSaleItems(saleId: string, signal?: AbortSignal) {
  return apiRequest<SaleItem[]>(`/sales/${encodeURIComponent(saleId)}/items`, {
    signal,
  });
}

export function createSale(token: string, input: SaleDraftInput) {
  return apiRequest<Sale>("/sales", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function addSaleItem(
  token: string,
  saleId: string,
  input: SaleItemInput,
) {
  return apiRequest<SaleItem>(`/sales/${encodeURIComponent(saleId)}/items`, {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function completeSale(token: string, saleId: string) {
  return apiRequest<Sale>(`/sales/${encodeURIComponent(saleId)}/complete`, {
    method: "POST",
    token,
  });
}

export function createSaleReturn(
  token: string,
  saleId: string,
  input: { reference: string; reason?: string },
) {
  return apiRequest<SaleReturn>(
    `/sales/${encodeURIComponent(saleId)}/returns`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    },
  );
}

export function getSaleReturn(returnId: string, signal?: AbortSignal) {
  return apiRequest<SaleReturn>(
    `/sales/returns/${encodeURIComponent(returnId)}`,
    { signal },
  );
}

export function listSaleReturnItems(returnId: string, signal?: AbortSignal) {
  return apiRequest<SaleReturnItem[]>(
    `/sales/returns/${encodeURIComponent(returnId)}/items`,
    {
      signal,
    },
  );
}

export function addSaleReturnItem(
  token: string,
  returnId: string,
  input: { sale_item_id: string; quantity: string },
) {
  return apiRequest<SaleReturnItem>(
    `/sales/returns/${encodeURIComponent(returnId)}/items`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    },
  );
}

export function completeSaleReturn(token: string, returnId: string) {
  return apiRequest<SaleReturn>(
    `/sales/returns/${encodeURIComponent(returnId)}/complete`,
    {
      method: "POST",
      token,
    },
  );
}
