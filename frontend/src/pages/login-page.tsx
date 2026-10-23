import { useState, type FormEvent } from 'react'
import { ArrowRight, Boxes, LoaderCircle } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { getLoginError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (auth.status === 'authenticated') return <Navigate to="/app" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await auth.signIn(email, password)
      const destination = (location.state as { from?: string } | null)?.from || '/app'
      navigate(destination, { replace: true })
    } catch (loginError) {
      setError(getLoginError(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_1fr]">
      <section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-white/15"><Boxes size={21} /></span>Gestion de stock</div>
        <div className="max-w-lg pb-10">
          <p className="text-sm font-medium text-primary-foreground/70">UNE GESTION PLUS CLAIRE</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">Vos opérations, votre stock, une seule vue.</h1>
          <p className="mt-5 leading-7 text-primary-foreground/75">Retrouvez les outils essentiels pour suivre les articles et les mouvements de votre activité.</p>
        </div>
        <p className="text-xs text-primary-foreground/65">Un espace de travail sécurisé pour votre équipe.</p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="space-y-3 px-0 sm:px-6">
            <div className="mb-3 grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground lg:hidden"><Boxes size={22} /></div>
            <CardTitle className="text-2xl">Bienvenue</CardTitle>
            <CardDescription>Connectez-vous pour accéder à votre espace de gestion.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@entreprise.com" disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" disabled={submitting} />
              </div>
              {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? <><LoaderCircle className="animate-spin" size={17} />Connexion…</> : <>Se connecter<ArrowRight size={17} /></>}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">L’accès est réservé aux comptes créés par l’administrateur.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
