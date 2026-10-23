import { saveSessionToken } from '@/auth/session-token'
import { SuppliersPage } from '@/features/suppliers/suppliers-page'
import { calculateFcfaLineAmount, formatFcfa } from '@/lib/money'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

describe('fournisseurs et montants F CFA', () => {
  it('arrondit une ligne et son affichage sans calcul monétaire flottant', () => {
    expect(calculateFcfaLineAmount('1.5', '100.50')).toBe(151n)
    expect(calculateFcfaLineAmount('0.5', '101')).toBe(51n)
    expect(formatFcfa(151n)).toContain('151')
    expect(formatFcfa(151n)).toContain('F CFA')
  })

  it('crée un fournisseur et recharge le répertoire', async () => {
    const user = userEvent.setup()
    const supplier = { id: '12', name: 'Grossiste test', phone: '70000000', email: null, address: null, is_active: true }
    let created = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method || 'GET'} ${String(input)}`
      if (key === 'POST /api/suppliers') { created = true; return response(201, supplier) }
      if (key === 'GET /api/suppliers?include_inactive=true') return response(200, created ? [supplier] : [])
      return response(404, { error: { message: `Requête imprévue : ${key}` } })
    })
    vi.stubGlobal('fetch', fetchMock)
    saveSessionToken('supplier-test-token')
    render(<MemoryRouter><SuppliersPage /></MemoryRouter>)

    await screen.findByText('Aucun fournisseur actif. Créez-en un pour enregistrer une réception.')
    await user.type(await screen.findByLabelText('Nom du fournisseur'), supplier.name)
    await user.type(screen.getByLabelText('Téléphone'), supplier.phone)
    await user.click(screen.getByRole('button', { name: 'Créer le fournisseur' }))

    expect(await screen.findByText(supplier.name)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/suppliers', expect.objectContaining({ method: 'POST' })))
    const call = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/suppliers' && init?.method === 'POST')
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ name: supplier.name, phone: supplier.phone, is_active: true })
  })
})

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}
