import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Pencil, Plus, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCatalogReferences, saveCategory, saveUnit, type CatalogCategory, type CatalogUnit } from '@/features/catalog/catalog-api'

export function CatalogReferencesPage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [units, setUnits] = useState<CatalogUnit[]>([])
  const [category, setCategory] = useState<CatalogCategory | null>(null)
  const [unit, setUnit] = useState<CatalogUnit | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    getCatalogReferences(controller.signal).then((data) => { setCategories(data.categories); setUnits(data.units) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Impossible de charger les référentiels.'))
    return () => controller.abort()
  }, [reload])

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try { await saveCategory(category?.id ?? null, { name: String(form.get('name')).trim(), description: String(form.get('description') || '').trim() }); setCategory(null); setReload((value) => value + 1) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'La catégorie ne peut pas être enregistrée.') } finally { setBusy(false) }
  }
  async function submitUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try { await saveUnit(unit?.id ?? null, { name: String(form.get('name')).trim(), symbol: String(form.get('symbol')).trim() }); setUnit(null); setReload((value) => value + 1) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "L'unité ne peut pas être enregistrée.") } finally { setBusy(false) }
  }

  return <div className="space-y-6">
    <div><Link to="/app/catalogue" className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline">← Retour au catalogue</Link><p className="mt-4 text-sm text-muted-foreground">Configuration du catalogue</p><h2 className="mt-1 text-2xl font-semibold">Catégories et unités</h2><p className="mt-2 text-sm text-muted-foreground">Créez ou renommez les référentiels utilisés par les produits. Ils ne sont pas supprimables pour préserver les historiques.</p></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}><RotateCw size={15} />Réessayer</Button></div>}
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="space-y-4 rounded-lg border bg-card p-5"><div><h3 className="font-semibold">Catégories</h3><p className="mt-1 text-sm text-muted-foreground">Classez les articles comme boissons, épicerie ou hygiène.</p></div><form className="space-y-3 rounded-md bg-muted/40 p-4" onSubmit={submitCategory}><Input name="name" aria-label="Nom de la catégorie" placeholder="Nom de la catégorie" required maxLength={100} defaultValue={category?.name || ''} key={category?.id ?? `new-${reload}`} /><Input name="description" aria-label="Description de la catégorie" placeholder="Description (facultative)" maxLength={5000} defaultValue={category?.description || ''} key={`desc-${category?.id ?? `new-${reload}`}`} /><div className="flex justify-end gap-2">{category && <Button type="button" variant="outline" onClick={() => setCategory(null)}>Annuler</Button>}<Button disabled={busy}><Plus size={16} />{category ? 'Enregistrer' : 'Ajouter la catégorie'}</Button></div></form><ul className="divide-y divide-border">{categories.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{item.name}</p>{item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}</div><Button aria-label={`Modifier ${item.name}`} title={`Modifier ${item.name}`} variant="ghost" size="icon" onClick={() => setCategory(item)}><Pencil size={16} /></Button></li>)}{categories.length === 0 && <li className="py-5 text-sm text-muted-foreground">Aucune catégorie. Ajoutez-en une pour commencer.</li>}</ul></section>
      <section className="space-y-4 rounded-lg border bg-card p-5"><div><h3 className="font-semibold">Unités de mesure</h3><p className="mt-1 text-sm text-muted-foreground">Ex. pièce (pc), kilogramme (kg), litre (L).</p></div><form className="grid gap-3 rounded-md bg-muted/40 p-4 sm:grid-cols-[1fr_120px_auto]" onSubmit={submitUnit}><Input name="name" aria-label="Nom de l'unité" placeholder="Nom de l'unité" required maxLength={50} defaultValue={unit?.name || ''} key={unit?.id ?? `unit-${reload}`} /><Input name="symbol" aria-label="Symbole de l'unité" placeholder="Symbole" required maxLength={20} defaultValue={unit?.symbol || ''} key={`symbol-${unit?.id ?? `unit-${reload}`}`} /><div className="flex justify-end gap-2">{unit && <Button type="button" variant="outline" onClick={() => setUnit(null)}>Annuler</Button>}<Button disabled={busy}><Plus size={16} />{unit ? 'Enregistrer' : 'Ajouter'}</Button></div></form><ul className="divide-y divide-border">{units.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><p className="text-sm font-medium">{item.name} <span className="text-muted-foreground">({item.symbol})</span></p><Button aria-label={`Modifier ${item.name}`} title={`Modifier ${item.name}`} variant="ghost" size="icon" onClick={() => setUnit(item)}><Pencil size={16} /></Button></li>)}{units.length === 0 && <li className="py-5 text-sm text-muted-foreground">Aucune unité. Ajoutez-en une pour commencer.</li>}</ul></section>
    </div>
  </div>
}
