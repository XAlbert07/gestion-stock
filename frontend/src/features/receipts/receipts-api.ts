import { apiRequest } from '@/lib/api'

export type Supplier = { id: string | number; name: string }
export type ReceiptStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
export type Receipt = {
  id: string | number
  supplier_id: string | number
  supplier_name?: string
  reference: string
  status: ReceiptStatus
  operation_id: string | number | null
  created_at: string
  received_at: string | null
  notes: string | null
}

export type ReceiptItem = {
  id: string | number
  receipt_id: string | number
  product_id: string | number
  unit_id: string | number
  product_name: string
  unit_symbol: string
  quantity: string | number
  conversion_factor: string | number
  base_quantity: string | number
  unit_purchase_price: string | number
}

export type ReceiptDraftInput = { supplier_id: string; reference: string; notes?: string }
export type ReceiptItemInput = {
  product_id: string
  unit_id: string
  quantity: string
  unit_purchase_price: string
}

export type PaginatedReceipts = {
  items: Receipt[]
  total: number
  page: number
  limit: number
}

export function listReceipts(
  params: { page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.search) searchParams.set('search', params.search)
  const query = searchParams.toString()
  return apiRequest<PaginatedReceipts>(query ? `/receipts?${query}` : '/receipts', { signal })
}

export function listSuppliers(signal?: AbortSignal) {
  return apiRequest<Supplier[]>('/suppliers', { signal })
}

export function getReceipt(receiptId: string, signal?: AbortSignal) {
  return apiRequest<Receipt>(`/receipts/${encodeURIComponent(receiptId)}`, { signal })
}

export function listReceiptItems(receiptId: string, signal?: AbortSignal) {
  return apiRequest<ReceiptItem[]>(`/receipts/${encodeURIComponent(receiptId)}/items`, { signal })
}

export function createReceipt(token: string, input: ReceiptDraftInput) {
  return apiRequest<Receipt>('/receipts', { method: 'POST', token, body: JSON.stringify(input) })
}

export function addReceiptItem(token: string, receiptId: string, input: ReceiptItemInput) {
  return apiRequest<ReceiptItem>(`/receipts/${encodeURIComponent(receiptId)}/items`, {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

export function completeReceipt(token: string, receiptId: string) {
  return apiRequest<Receipt>(`/receipts/${encodeURIComponent(receiptId)}/complete`, {
    method: 'POST',
    token,
  })
}
