import {
  Boxes,
  ClipboardList,
  LogOut,
  Package,
  ShoppingCart,
  Truck,
  UsersRound,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const sections = [
  { label: 'Tableau de bord', icon: Boxes, to: '/app' },
  { label: 'Catalogue', icon: Package, to: '/app/catalogue' },
  { label: 'Stock', icon: ClipboardList, to: '/app/stock' },
  { label: 'Réceptions', icon: Truck, to: '/app/receptions' },
  { label: 'Fournisseurs', icon: UsersRound, to: '/app/fournisseurs' },
  { label: 'Ventes', icon: ShoppingCart, to: '/app/ventes' },
  { label: 'Clients', icon: UsersRound, to: '/app/clients' },
]

export function AppShell() {
  const auth = useAuth()
  const user = auth.user
  if (auth.status !== 'authenticated' || !user) return null
  const { signOut } = auth
  const isDemo = user.role === 'DEMO'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary">GESTION DE STOCK</p>
            <h1 className="mt-1 text-xl font-semibold">Espace de gestion</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="secondary">{isDemo ? 'Démo' : user.role}</Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              onClick={signOut}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>
      {isDemo && (
        <div role="status" className="border-b bg-warning/15 px-5 py-2.5 text-center text-sm sm:px-8">
          <strong className="font-semibold">Mode démonstration</strong> : les données sont fictives et les modifications sont désactivées (lecture seule).
        </div>
      )}
      <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Navigation principale" className="rounded-lg border bg-card p-3">
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {sections.map(({ label, icon: Icon, to }) => (
              <li key={to}>
                <NavLink
                  end={to === '/app'}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
