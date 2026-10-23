import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowLeft, Check, LoaderCircle, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { listProducts, getCatalogUnits, getProductUnits, type CatalogProduct, type CatalogProductUnit } from '@/features/catalog/catalog-api'
import { addReceiptItem, completeReceipt, getReceipt, listReceiptItems, type Receipt, type ReceiptItem } from '@/features/receipts/receipts-api'
import { ReceiptStatus } from '@/features/receipts/receipts-page'
import { calculateFcfaLineAmount, formatFcfa, formatFcfaUnitPrice } from '@/lib/money'

const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
type UnitOption = CatalogProductUnit & { isBase: boolean }
type ReceiptView = { receipt: Receipt; items: ReceiptItem[] }

export function ReceiptDetailPage() {
  const { receiptId = '' } = useParams()
  const { token } = useAuth()
  const [reload, setReload] = useState(0)
  const [receiptView, setReceiptView] = useState<{ key: string; data: ReceiptView } | null>(null)
  const [receiptFailure, setReceiptFailure] = useState<{ key: string; message: string } | null>(null)
  const requestKey = JSON.stringify([receiptId, reload])

  useEffect(() => {
    if (!receiptId) return
    const controller = new AbortController()
    let active = true
    Promise.all([getReceipt(receiptId, controller.signal), listReceiptItems(receiptId, controller.signal)])
      .then(([receipt, items]) => {
        if (active) setReceiptView({ key: requestKey, data: { receipt, items } })
      })
      .catch((error: unknown) => {
        if (active) setReceiptFailure({ key: requestKey, message: error instanceof Error ? error.message : 'La réception est indisponible.' })
      })
    return () => { active = false; controller.abort() }
  }, [receiptId, reload, requestKey])

  const currentView = receiptView?.key === requestKey ? receiptView.data : null
  const error = receiptFailure?.key === requestKey ? receiptFailure.message : ''
  const loading = !currentView && !error

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3"><Link to="/app/receptions"><ArrowLeft size={16} />Retour aux réceptions</Link></Button>
        <p className="text-sm text-muted-foreground">Approvisionnement</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Détail de la réception</h2>
      </div>
      {loading && <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={18} />Chargement de la réception…</div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to="/app/receptions">Liste</Link></Button><Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Réessayer</Button></div></div>}
      {currentView && <ReceiptWorkspace view={currentView} token={token} onChanged={() => setReload((value) => value + 1)} />}
    </div>
  )
}

function ReceiptWorkspace({ view, token, onChanged }: { view: ReceiptView; token: string | null; onChanged: () => void }) {
  const { receipt, items } = view
  const [completionConfirmation, setCompletionConfirmation] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const total = items.reduce((sum, item) => sum + calculateFcfaLineAmount(item.quantity, item.unit_purchase_price), 0n)
  const isDraft = receipt.status === 'DRAFT'

  async function handleComplete() {
    if (!token) {
      setCompletionError('Votre session a expiré. Reconnectez-vous avant de valider la réception.')
      return
    }
    setCompleting(true)
    setCompletionError('')
    try {
      await completeReceipt(token, String(receipt.id))
      setCompletionConfirmation(false)
      onChanged()
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'La réception n’a pas pu être validée.')
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1"><CardDescription>Référence</CardDescription><CardTitle>{receipt.reference}</CardTitle><p className="text-sm text-muted-foreground">Fournisseur : {receipt.supplier_name || `#${receipt.supplier_id}`}</p></div>
          <ReceiptStatus status={receipt.status} />
        </CardHeader>
        {receipt.notes && <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{receipt.notes}</p></CardContent>}
      </Card>

      {isDraft && <ReceiptItemForm receiptId={String(receipt.id)} token={token} onAdded={onChanged} />}

      <section aria-label="Articles de la réception">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-semibold">Articles reçus</h3><p className="text-sm text-muted-foreground">Total indicatif : {formatFcfa(total)}</p></div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[660px] text-left text-sm">
            <caption className="sr-only">Produits et prix d’achat de la réception {receipt.reference}.</caption>
            <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3">Produit</th><th scope="col" className="px-4 py-3 text-right">Quantité</th><th scope="col" className="px-4 py-3 text-right">Prix unitaire</th><th scope="col" className="px-4 py-3 text-right">Montant</th></tr></thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Aucun article dans cette réception.</td></tr> : items.map((item) => <ReceiptItemRow key={item.id} item={item} />)}
            </tbody>
            {items.length > 0 && <tfoot><tr><th scope="row" colSpan={3} className="px-4 py-3 text-right font-medium">Total indicatif</th><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatFcfa(total)}</td></tr></tfoot>}
          </table>
        </div>
      </section>

      {isDraft && <section className="space-y-3">
        {completionError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{completionError}</p>}
        {!completionConfirmation ? <Button disabled={items.length === 0} onClick={() => setCompletionConfirmation(true)}><Check size={17} />Valider la réception</Button> : <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-warning/10 p-4">
          <div><p className="font-medium">Confirmer la validation ?</p><p className="mt-1 text-sm text-muted-foreground">Les entrées seront enregistrées dans le stock. Une réception validée ne peut pas être annulée.</p></div>
          <div className="flex gap-2"><Button variant="outline" disabled={completing} onClick={() => setCompletionConfirmation(false)}>Revenir au brouillon</Button><Button disabled={completing || items.length === 0} onClick={handleComplete}>{completing ? <><LoaderCircle className="animate-spin" size={17} />Validation…</> : 'Confirmer et mettre à jour le stock'}</Button></div>
        </div>}
      </section>}
      {!isDraft && receipt.received_at && <p className="text-sm text-muted-foreground">Validée le {dateFormat.format(new Date(receipt.received_at))}</p>}
    </div>
  )
}

function ReceiptItemForm({ receiptId, token, onAdded }: { receiptId: string; token: string | null; onAdded: () => void }) {
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [products, setProducts] = useState<{ key: string; data: CatalogProduct[]; total: number } | null>(null)
  const [productFailure, setProductFailure] = useState<{ key: string; message: string } | null>(null)
  const [productId, setProductId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('0')
  const [units, setUnits] = useState<{ key: string; data: UnitOption[] } | null>(null)
  const [unitFailure, setUnitFailure] = useState<{ key: string; message: string } | null>(null)
  const [unitRetry, setUnitRetry] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [productRetry, setProductRetry] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setSubmittedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const productKey = JSON.stringify([submittedSearch, productRetry])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    listProducts({ page: 1, limit: 100, search: submittedSearch, categoryId: '', includeInactive: false }, controller.signal)
      .then((result) => {
        if (active) setProducts({ key: productKey, data: result.data, total: result.meta.total })
      })
      .catch((error: unknown) => {
        if (active) setProductFailure({ key: productKey, message: error instanceof Error ? error.message : 'La liste des produits est indisponible.' })
      })
    return () => { active = false; controller.abort() }
  }, [submittedSearch, productRetry, productKey])

  const unitKey = JSON.stringify([productId, unitRetry])
  useEffect(() => {
    if (!productId) return
    const selectedProduct = products?.data.find((product) => String(product.id) === productId)
    if (!selectedProduct) return
    const controller = new AbortController()
    let active = true
    Promise.all([
      getProductUnits(productId, controller.signal),
      getCatalogUnits(controller.signal),
    ])
      .then(([productUnits, allUnits]) => {
        if (!active) return
        const unitMap = new Map(allUnits.map((unit) => [String(unit.id), unit]))
        const options: UnitOption[] = productUnits.map((unit) => {
          const isBase = String(unit.unit_id) === String(selectedProduct.base_unit_id)
          return { ...unit, conversion_factor: isBase ? '1' : unit.conversion_factor, isBase }
        })
        if (!options.some((unit) => unit.isBase)) {
          const baseUnit = unitMap.get(String(selectedProduct.base_unit_id))
          if (baseUnit) options.unshift({ unit_id: baseUnit.id, conversion_factor: '1', name: baseUnit.name, symbol: baseUnit.symbol, is_default_sale_unit: false, isBase: true })
        }
        options.sort((left, right) => Number(right.isBase) - Number(left.isBase) || left.name.localeCompare(right.name, 'fr'))
        setUnits({ key: unitKey, data: options })
        setUnitFailure(null)
        setUnitId((current) => options.some((unit) => String(unit.unit_id) === current) ? current : String(options[0]?.unit_id || ''))
      })
      .catch((error: unknown) => {
        if (active) setUnitFailure({ key: unitKey, message: error instanceof Error ? error.message : 'Les unités de ce produit ne sont pas disponibles.' })
      })
    return () => { active = false; controller.abort() }
  }, [productId, unitRetry, unitKey, products])

  const currentProducts = products?.key === productKey ? products.data : []
  const productError = productFailure?.key === productKey ? productFailure.message : ''
  const productLoading = (!products || products.key !== productKey || search.trim() !== submittedSearch) && !productError
  const currentUnits = units?.key === unitKey ? units.data : []
  const unitError = unitFailure?.key === unitKey ? unitFailure.message : ''
  const unitLoading = Boolean(productId && !currentUnits.length && !unitError)
  const selectedUnit = currentUnits.find((unit) => String(unit.unit_id) === unitId)

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setFormError('Votre session a expiré. Reconnectez-vous pour modifier ce brouillon.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      await addReceiptItem(token, receiptId, { product_id: productId, unit_id: unitId, quantity: quantity.trim(), unit_purchase_price: price.trim() })
      setQuantity('1')
      setPrice('0')
      onAdded()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'L’article n’a pas pu être ajouté.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Ajouter un article</CardTitle><CardDescription>La quantité est convertie dans l’unité de base du produit à la validation.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={handleAdd}>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="receipt-product-search" className="text-sm font-medium">Rechercher un produit</label>
            <Input id="receipt-product-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setProductId(''); setUnitId('') }} placeholder="Nom ou SKU" disabled={submitting} />
            <label htmlFor="receipt-product" className="sr-only">Produit à ajouter</label>
            <select id="receipt-product" required value={productId} onChange={(event) => { setProductId(event.target.value); setUnitId('') }} disabled={submitting || productLoading || currentProducts.length === 0} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{productLoading ? 'Chargement des produits…' : 'Sélectionner un produit actif'}</option>
              {currentProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
            </select>
            {products?.key === productKey && products.total > products.data.length && <p className="text-xs text-muted-foreground">Affinez la recherche pour trouver un produit parmi les {products.total} résultats.</p>}
            {productError && <p role="alert" className="text-sm text-destructive">{productError} <button className="underline underline-offset-2" type="button" onClick={() => setProductRetry((value) => value + 1)}>Réessayer</button></p>}
            {!productLoading && !productError && currentProducts.length === 0 && <p className="text-xs text-muted-foreground">Aucun produit actif ne correspond à la recherche.</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="receipt-unit" className="text-sm font-medium">Unité de réception</label>
            <select id="receipt-unit" required value={unitId} onChange={(event) => setUnitId(event.target.value)} disabled={submitting || unitLoading || currentUnits.length === 0} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{unitLoading ? 'Chargement des unités…' : 'Sélectionner une unité'}</option>
              {currentUnits.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name} ({unit.symbol}){unit.isBase ? ' · unité de base' : ` · × ${quantityFormat.format(Number(unit.conversion_factor))}`}</option>)}
            </select>
            {unitError && <p role="alert" className="text-sm text-destructive">{unitError} <button className="underline underline-offset-2" type="button" onClick={() => setUnitRetry((value) => value + 1)}>Réessayer</button></p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="receipt-quantity" className="text-sm font-medium">Quantité</label>
            <Input id="receipt-quantity" required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={submitting || !selectedUnit} />
          </div>
          <div className="space-y-2">
            <label htmlFor="receipt-purchase-price" className="text-sm font-medium">Prix d’achat par unité (F CFA)</label>
            <Input id="receipt-purchase-price" required type="number" min="0" max="999999999999" step="1" value={price} onChange={(event) => setPrice(event.target.value)} disabled={submitting || !selectedUnit} />
          </div>
          {formError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2 xl:col-span-4">{formError}</p>}
          <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-4">
            <Button type="submit" disabled={submitting || !productId || !unitId || !selectedUnit}>{submitting ? <><LoaderCircle className="animate-spin" size={17} />Ajout…</> : <><Plus size={17} />Ajouter à la réception</>}</Button>
            {selectedUnit && <span className="text-xs text-muted-foreground">Conversion : 1 {selectedUnit.symbol} = {quantityFormat.format(Number(selectedUnit.conversion_factor))} unité(s) de base</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ReceiptItemRow({ item }: { item: ReceiptItem }) {
  const lineTotal = calculateFcfaLineAmount(item.quantity, item.unit_purchase_price)
  return <tr><th scope="row" className="px-4 py-3 font-medium">{item.product_name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{quantityFormat.format(Number(item.conversion_factor))} unité(s) de base par {item.unit_symbol}</span></th><td className="px-4 py-3 text-right tabular-nums">{quantityFormat.format(Number(item.quantity))} {item.unit_symbol}</td><td className="px-4 py-3 text-right tabular-nums">{formatFcfaUnitPrice(item.unit_purchase_price)}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{formatFcfa(lineTotal)}</td></tr>
}
