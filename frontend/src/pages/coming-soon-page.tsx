import { useLocation } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const titles: Record<string, string> = {
  '/app/stock': 'Stock',
}

export function ComingSoonPage() {
  const { pathname } = useLocation()
  const title = titles[pathname] || 'Page introuvable'
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Cet écran sera relié à l’API dans la prochaine étape de la Phase 5.</CardDescription></CardHeader></Card>
}
