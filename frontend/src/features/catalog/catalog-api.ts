import { apiRequest } from '@/lib/api'

export type CatalogProduct = {
  id: string | number
  category_id: string | number
  base_unit_id: string | number
  name: string
  sku: string
  current_stock: string | number
  critical_threshold: string | number
  is_active: boolean
  description?: string | null
}

export type ProductPage = {
  data: CatalogProduct[]
  meta: { page: number; limit: number; total: number }
}

export type CatalogCategory = { id: string | number; name: string; description?: string | null }
export type CatalogUnit = { id: string | number; name: string; symbol: string }
export type CatalogProductUnit = {
  unit_id: string | number
  conversion_factor: string | number
  name: string
  symbol: string
  is_default_sale_unit: boolean
}
export type CustomerType = { id: string | number; name: string }
export type ProductPrice = {
  id: string | number
  customer_type_id: string | number
  unit_id: string | number
  price: string | number
  is_active: boolean
  customer_type_name: string
  unit_name: string
  unit_symbol: string
  created_at: string
}
export type ProductFilters = {
  page: number
  limit: number
  search: string
  categoryId: string
  includeInactive: boolean
}

export async function listProducts(filters: ProductFilters, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) })
  if (filters.search) query.set('search', filters.search)
  if (filters.categoryId) query.set('category_id', filters.categoryId)
  if (filters.includeInactive) query.set('include_inactive', 'true')
  return apiRequest<ProductPage>(`/products?${query}`, { signal })
}

export async function getCatalogReferences(signal?: AbortSignal) {
  const [categories, units] = await Promise.all([
    apiRequest<CatalogCategory[]>('/categories', { signal }),
    getCatalogUnits(signal),
  ])
  return { categories, units }
}

export function getCatalogUnits(signal?: AbortSignal) {
  return apiRequest<CatalogUnit[]>('/units', { signal })
}

export function getProductUnits(productId: string, signal?: AbortSignal) {
  return apiRequest<CatalogProductUnit[]>(`/products/${encodeURIComponent(productId)}/units`, {
    signal,
  })
}

export function getProduct(productId: string, signal?: AbortSignal) {
  return apiRequest<CatalogProduct>(`/products/${encodeURIComponent(productId)}`, { signal })
}

export function listCustomerTypes(signal?: AbortSignal) {
  return apiRequest<CustomerType[]>('/customers/types', { signal })
}

export function listProductPrices(productId: string, signal?: AbortSignal) {
  return apiRequest<ProductPrice[]>(`/products/${encodeURIComponent(productId)}/prices`, { signal })
}

export function saveProductPrice(
  productId: string,
  payload: { customer_type_id: number; unit_id: number; price: string },
) {
  return apiRequest<ProductPrice>(`/products/${encodeURIComponent(productId)}/prices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getProductPrice(
  productId: string,
  customerTypeId: string,
  unitId: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ customer_type_id: customerTypeId, unit_id: unitId })
  return apiRequest<{ price: string | number }>(
    `/products/${encodeURIComponent(productId)}/price?${query}`,
    { signal },
  )
}

export function createProduct(payload: {
  name: string
  sku: string
  category_id: number
  base_unit_id: number
  description: string
  critical_threshold: string
}) {
  return apiRequest<CatalogProduct>('/products', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateProduct(
  productId: string,
  payload: {
    name: string
    sku: string
    category_id: number
    base_unit_id: number
    description: string
    critical_threshold: string
    is_active: boolean
  },
) {
  return apiRequest<CatalogProduct>(`/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function saveCategory(
  id: string | number | null,
  payload: { name: string; description: string },
) {
  const path = id ? `/categories/${encodeURIComponent(String(id))}` : '/categories'
  return apiRequest<CatalogCategory>(path, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  })
}

export function saveUnit(id: string | number | null, payload: { name: string; symbol: string }) {
  const path = id ? `/units/${encodeURIComponent(String(id))}` : '/units'
  return apiRequest<CatalogUnit>(path, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  })
}
