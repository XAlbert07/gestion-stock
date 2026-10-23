import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, LoaderCircle, PackagePlus, PackageSearch, RotateCw, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listProducts, getCatalogReferences, type CatalogCategory, type CatalogUnit, type CatalogProduct } from '@/features/catalog/catalog-api'

const PAGE_SIZE = 20
const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

export function CatalogPage() {
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [productResponse, setProductResponse] = useState<{ key: string; data: CatalogProduct[]; total: number } | null>(null)
  const [productFailure, setProductFailure] = useState<{ key: string; message: string } | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [units, setUnits] = useState<CatalogUnit[]>([])
  const [referencesRetry, setReferencesRetry] = useState(0)
  const [referenceFailure, setReferenceFailure] = useState<{ attempt: number; message: string } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSubmittedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    getCatalogReferences(controller.signal)
      .then((references) => {
        if (!active) return
        setCategories(references.categories)
        setUnits(references.units)
      })
      .catch((referenceError: unknown) => {
        if (active) {
          setCategories([])
          setUnits([])
          setReferenceFailure({ attempt: referencesRetry, message: referenceError instanceof Error ? referenceError.message : 'Les catégories et unités ne sont pas disponibles.' })
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [referencesRetry])

  const requestKey = JSON.stringify([page, submittedSearch, categoryId, includeInactive, retry])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    listProducts({ page, limit: PAGE_SIZE, search: submittedSearch, categoryId, includeInactive }, controller.signal)
      .then((result) => {
        if (!active) return
        const pageCount = Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
        if (page > pageCount) {
          setPage(pageCount)
          return
        }
        setProductResponse({ key: requestKey, data: result.data, total: result.meta.total })
      })
      .catch((requestError: unknown) => {
        if (active) setProductFailure({ key: requestKey, message: requestError instanceof Error ? requestError.message : 'Le catalogue ne peut pas être chargé.' })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [page, submittedSearch, categoryId, includeInactive, retry, requestKey])

  const categoryNames = useMemo(() => new Map(categories.map((category) => [String(category.id), category.name])), [categories])
  const unitNames = useMemo(() => new Map(units.map((unit) => [String(unit.id), unit.symbol || unit.name])), [units])
  const currentResponse = productResponse?.key === requestKey ? productResponse : null
  const error = productFailure?.key === requestKey ? productFailure.message : ''
  const loading = !currentResponse && !error
  const products = currentResponse?.data || []
  const total = currentResponse?.total || 0
  const referencesError = referenceFailure?.attempt === referencesRetry ? referenceFailure.message : ''
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem = Math.min(page * PAGE_SIZE, total)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateCategory(value: string) {
    setCategoryId(value)
    setPage(1)
  }

  function updateInactive(value: boolean) {
    setIncludeInactive(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Gestion des articles</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Catalogue</h2>
          <p className="mt-2 text-sm text-muted-foreground">Consultez et gérez les produits enregistrés.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{total.toLocaleString('fr-FR')} produit{total === 1 ? '' : 's'}</Badge><Button asChild variant="outline"><Link to="/app/catalogue/referentiels"><Settings2 size={16} />Catégories et unités</Link></Button><Button asChild><Link to="/app/catalogue/nouveau"><PackagePlus size={16} />Nouveau produit</Link></Button></div>
      </section>

      <section aria-label="Filtres du catalogue" className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)] sm:items-end">
        <div className="space-y-2">
          <label htmlFor="catalog-search" className="text-sm font-medium">Rechercher un produit</label>
          <div className="relative">
            <PackageSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} aria-hidden="true" />
            <Input id="catalog-search" type="search" className="pl-10" placeholder="Nom ou référence SKU" value={search} onChange={(event) => updateSearch(event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="catalog-category" className="text-sm font-medium">Catégorie</label>
          <select id="catalog-category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={categoryId} onChange={(event) => updateCategory(event.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
          <input className="size-4 accent-primary" type="checkbox" checked={includeInactive} onChange={(event) => updateInactive(event.target.checked)} />
          Inclure les produits désactivés
        </label>
      </section>

      {referencesError && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning"><span>{referencesError} Les identifiants seront affichés à la place de leurs libellés.</span><Button variant="outline" size="sm" onClick={() => setReferencesRetry((value) => value + 1)}><RotateCw size={15} />Réessayer</Button></div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></div>}

      <section aria-label="Résultats du catalogue" aria-busy={loading}>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Produits enregistrés, leur catégorie, leur stock, leur seuil critique, leur état et les actions disponibles.</caption>
            <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr><th scope="col" className="px-4 py-3">Produit</th><th scope="col" className="px-4 py-3">Catégorie</th><th scope="col" className="px-4 py-3 text-right">Stock actuel</th><th scope="col" className="px-4 py-3 text-right">Seuil critique</th><th scope="col" className="px-4 py-3">État</th><th scope="col" className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground"><span className="inline-flex items-center gap-2"><LoaderCircle size={18} className="animate-spin" />Chargement du catalogue…</span></td></tr> : error ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Les résultats ne sont pas disponibles pour le moment.</td></tr> : products.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Aucun produit ne correspond à ces critères.</td></tr> : products.map((product) => <ProductRow key={product.id} product={product} categoryName={categoryNames.get(String(product.category_id))} unitName={unitNames.get(String(product.base_unit_id))} />)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground">
          <p aria-live="polite">{loading ? 'Mise à jour des résultats…' : `${firstItem}–${lastItem} sur ${total.toLocaleString('fr-FR')} produit${total === 1 ? '' : 's'}`}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</Button>
            <span className="min-w-20 text-center">Page {page} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={loading || page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Suivant</Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function ProductRow({ product, categoryName, unitName }: { product: CatalogProduct; categoryName?: string; unitName?: string }) {
  const isLow = Number(product.current_stock) <= Number(product.critical_threshold)
  return (
    <tr className={!product.is_active ? 'bg-muted/30' : undefined}>
      <th scope="row" className="px-4 py-3 font-medium">
        <span className="block">{product.name}</span>
        <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">{product.sku}</span>
        <Link aria-label={`Consulter le stock de ${product.name}`} className="mt-1 inline-block text-xs font-normal text-muted-foreground underline-offset-4 hover:text-primary hover:underline" to={`/app/stock/${encodeURIComponent(String(product.id))}`}>Voir le stock et les mouvements</Link>
      </th>
      <td className="px-4 py-3 text-muted-foreground">{categoryName || `Catégorie #${product.category_id}`}</td>
      <td className="px-4 py-3 text-right tabular-nums">{quantityFormat.format(Number(product.current_stock))} <span className="text-muted-foreground">{unitName || ''}</span></td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{quantityFormat.format(Number(product.critical_threshold))} {unitName || ''}</td>
      <td className="px-4 py-3">{product.is_active ? <Badge variant={isLow ? 'warning' : 'success'}>{isLow ? 'Stock faible' : 'Actif'}</Badge> : <Badge variant="outline">Désactivé</Badge>}</td>
      <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><Link className="text-sm text-primary underline-offset-4 hover:underline" to={`/app/catalogue/${encodeURIComponent(String(product.id))}/modifier`}>Modifier</Link><Link className="text-sm text-primary underline-offset-4 hover:underline" to={`/app/catalogue/${encodeURIComponent(String(product.id))}/tarifs`}>Tarifs</Link></div></td>
    </tr>
  )
}
