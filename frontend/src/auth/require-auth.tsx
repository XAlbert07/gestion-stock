import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'

export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Vérification de la session…</main>
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
