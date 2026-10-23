import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { saveSessionToken } from '@/auth/session-token'
import { CatalogProductFormPage } from '@/features/catalog/catalog-product-form-page'
import { CatalogReferencesPage } from '@/features/catalog/catalog-references-page'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const authValue: AuthContextValue = {
  status: 'authenticated', user: { id: '9', first_name: 'Test', last_name: 'User', email: 'test@example.com', role: 'ADMIN' }, token: 'catalog-test-token', signIn: vi.fn(async () => {}), signOut: vi.fn(),
}

function installApi(handler: (input: RequestInfo | URL, init?: RequestInit) => unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const result = handler(input, init) as { status?: number; body: unknown }
    const status = result.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => result.body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderRoute(path: string, element: React.ReactNode) {
  saveSessionToken(authValue.token!)
  return render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={element} /></Routes></MemoryRouter></AuthContext.Provider>)
}

describe('gestion du catalogue', () => {
  it('crée un produit avec catégorie, unité et seuil via l’API', async () => {
    const user = userEvent.setup()
    const fetchMock = installApi((input, init) => {
      const url = String(input)
      if (url === '/api/categories') return { body: [{ id: '1', name: 'Boissons' }] }
      if (url === '/api/units') return { body: [{ id: '2', name: 'Bouteille', symbol: 'bt' }] }
      if (url === '/api/products' && init?.method === 'POST') return { status: 201, body: { id: '3' } }
      return { status: 404, body: { error: { message: `Requête imprévue : ${url}` } } }
    })

    renderRoute('/app/catalogue/nouveau', <CatalogProductFormPage />)
    await user.type(await screen.findByLabelText('Nom du produit'), 'Eau minérale')
    await user.type(screen.getByLabelText('Référence SKU'), 'EAU-001')
    await screen.findByRole('option', { name: 'Boissons' })
    await screen.findByRole('option', { name: /Bouteille/ })
    await user.selectOptions(screen.getByLabelText('Catégorie'), '1')
    await user.selectOptions(screen.getByLabelText('Unité de base'), '2')
    await user.type(screen.getByLabelText("Seuil d'alerte (quantité)"), '5')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le produit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/products', expect.objectContaining({ method: 'POST' })))
    const request = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/products' && init?.method === 'POST')
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ name: 'Eau minérale', sku: 'EAU-001', category_id: 1, base_unit_id: 2, critical_threshold: '5' })
  })

  it('permet de créer un référentiel catégorie', async () => {
    const user = userEvent.setup()
    const fetchMock = installApi((input, init) => {
      const url = String(input)
      if (url === '/api/categories' && init?.method === 'POST') return { status: 201, body: { id: '2', name: 'Épicerie' } }
      if (url === '/api/categories') return { body: [] }
      if (url === '/api/units') return { body: [] }
      return { status: 404, body: { error: { message: `Requête imprévue : ${url}` } } }
    })
    renderRoute('/app/catalogue/referentiels', <CatalogReferencesPage />)
    await user.type(await screen.findByRole('textbox', { name: 'Nom de la catégorie' }), 'Épicerie')
    await user.click(screen.getByRole('button', { name: 'Ajouter la catégorie' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/categories', expect.objectContaining({ method: 'POST' })))
  })
})
