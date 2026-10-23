import { apiRequest } from '@/lib/api'

export type SupplierRecord = { id: string | number; name: string; phone: string | null; email: string | null; address: string | null; is_active: boolean }
export type SupplierInput = { name: string; phone: string; email: string; address: string; is_active: boolean }

export function listSuppliers(includeInactive = false, signal?: AbortSignal) {
  return apiRequest<SupplierRecord[]>(`/suppliers${includeInactive ? '?include_inactive=true' : ''}`, { signal })
}

export function saveSupplier(id: string | number | null, input: SupplierInput) {
  const path = id ? `/suppliers/${encodeURIComponent(String(id))}` : '/suppliers'
  return apiRequest<SupplierRecord>(path, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) })
}
