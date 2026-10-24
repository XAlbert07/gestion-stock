import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { AppShell } from '@/components/app-shell'
import { LoginPage } from '@/pages/login-page'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

function anonymousAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'anonymous',
    user: null,
    token: null,
    signIn: vi.fn(async () => {}),
    signInDemo: vi.fn(async () => {}),
    signOut: vi.fn(),
    ...overrides,
  } as AuthContextValue
}

function mockDemoStatus(enabled: boolean) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ enabled }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderLogin(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/connexion']}>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/app" element={<p>Espace de gestion ouvert</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('connexion à la démonstration', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("propose « Explorer la démo » quand le serveur l'active, puis ouvre l'application", async () => {
    const fetchMock = mockDemoStatus(true)
    const auth = anonymousAuth()
    renderLogin(auth)

    const button = await screen.findByRole('button', { name: /explorer la démo/i })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/demo', expect.anything())

    await userEvent.click(button)

    expect(auth.signInDemo).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Espace de gestion ouvert')).toBeInTheDocument()
  })

  it("n'affiche aucun bouton démo quand le serveur ne la propose pas", async () => {
    const fetchMock = mockDemoStatus(false)
    renderLogin(anonymousAuth())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/préparation de la démo/i)).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /explorer la démo/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
  })

  it("affiche l'erreur si la connexion démo échoue", async () => {
    mockDemoStatus(true)
    const auth = anonymousAuth({
      signInDemo: vi.fn(async () => {
        throw new Error("La démonstration n'est pas disponible.")
      }),
    })
    renderLogin(auth)

    await userEvent.click(await screen.findByRole('button', { name: /explorer la démo/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent("La démonstration n'est pas disponible.")
  })
})

describe('bandeau du mode démonstration', () => {
  function renderShell(role: string) {
    const auth = {
      status: 'authenticated',
      user: { id: '1', first_name: 'Visiteur', last_name: 'Démo', email: 'demo@example.test', role },
      token: 't',
      signIn: vi.fn(async () => {}),
      signInDemo: vi.fn(async () => {}),
      signOut: vi.fn(),
    } as AuthContextValue
    return render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app']}>
          <Routes>
            <Route path="/app" element={<AppShell />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }

  it('prévient que les données sont fictives et en lecture seule', () => {
    renderShell('DEMO')
    expect(screen.getByRole('status')).toHaveTextContent(/mode démonstration/i)
    expect(screen.getByRole('status')).toHaveTextContent(/lecture seule/i)
  })

  it("n'apparaît pas pour un administrateur", () => {
    renderShell('ADMIN')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
