import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, LoaderCircle, Plus, RotateCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getCatalogUnits,
  getProduct,
  getProductUnits,
  listCustomerTypes,
  listProductPrices,
  saveProductPrice,
  type CatalogUnit,
  type CatalogProduct,
  type CatalogProductUnit,
  type CustomerType,
  type ProductPrice,
} from '@/features/catalog/catalog-api'

const moneyFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ProductPricesPage() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [types, setTypes] = useState<CustomerType[]>([])
  const [units, setUnits] = useState<CatalogProductUnit[]>([])
  const [unitRefs, setUnitRefs] = useState<CatalogUnit[]>([])
  const [prices, setPrices] = useState<ProductPrice[]>([])
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customerTypeId, setCustomerTypeId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getProduct(productId, controller.signal),
      listCustomerTypes(controller.signal),
      getProductUnits(productId, controller.signal),
      getCatalogUnits(controller.signal),
      listProductPrices(productId, controller.signal),
    ])
      .then(([p, t, productUnits, allUnits, history]) => {
        setProduct(p)
        setTypes(t)
        setUnits(productUnits)
        setUnitRefs(allUnits)
        setPrices(history)
        setCustomerTypeId((current) => current || String(t[0]?.id || ''))
        setUnitId((current) => current || String(p.base_unit_id))
        setError('')
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Les tarifs ne sont pas disponibles.'),
      )
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [productId, reload])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setSuccess('')
    try {
      await saveProductPrice(productId, {
        customer_type_id: Number(customerTypeId),
        unit_id: Number(unitId),
        price: price.trim(),
      })
      setPrice('')
      setSuccess('Le nouveau tarif est enregistré. Le tarif précédent reste dans l’historique.')
      setReload((value) => value + 1)
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : 'Le tarif ne peut pas être enregistré.',
      )
    } finally {
      setSaving(false)
    }
  }

  const activeKeys = new Set(
    prices
      .filter((item) => item.is_active)
      .map((item) => `${item.customer_type_id}:${item.unit_id}`),
  )
  const unitOptions = [...units]
  if (
    product &&
    !unitOptions.some((unit) => String(unit.unit_id) === String(product.base_unit_id))
  ) {
    const base = unitRefs.find((unit) => String(unit.id) === String(product.base_unit_id))
    if (base)
      unitOptions.unshift({
        unit_id: base.id,
        conversion_factor: '1',
        name: base.name,
        symbol: base.symbol,
        is_default_sale_unit: false,
      })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link to="/app/catalogue">
            <ArrowLeft size={16} />
            Retour au catalogue
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Catalogue · Tarification</p>
        <h2 className="mt-1 text-2xl font-semibold">Tarifs de vente</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {product
            ? `${product.name} · ${product.sku}`
            : 'Tarifs définis par type de client et unité de vente.'}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              setReload((value) => value + 1)
            }}
          >
            <RotateCw size={15} />
            Réessayer
          </Button>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter ou modifier un tarif</CardTitle>
          <CardDescription>
            Modifier un tarif archive l’ancien et crée une nouvelle version. Les ventes déjà
            enregistrées gardent leur prix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
            <Field label="Type de client" id="price-customer-type">
              <select
                id="price-customer-type"
                required
                className={selectClass}
                value={customerTypeId}
                onChange={(e) => setCustomerTypeId(e.target.value)}
              >
                <option value="">Choisir</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unité de vente" id="price-unit">
              <select
                id="price-unit"
                required
                className={selectClass}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">Choisir</option>
                {unitOptions.map((unit) => (
                  <option key={unit.unit_id} value={unit.unit_id}>
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prix (F CFA)" id="price-amount">
              <Input
                id="price-amount"
                required
                type="number"
                min="0"
                max="999999999999"
                step="1"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={saving || loading || !customerTypeId || !unitId}>
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
                {saving
                  ? 'Enregistrement…'
                  : activeKeys.has(`${customerTypeId}:${unitId}`)
                    ? 'Remplacer le tarif'
                    : 'Ajouter le tarif'}
              </Button>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
                {formError}
              </p>
            )}
            {success && (
              <p role="status" className="text-sm text-success sm:col-span-2 lg:col-span-4">
                {success}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <section>
        <h3 className="mb-3 text-lg font-semibold">Tarifs et historique</h3>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Type de client</th>
                <th className="px-4 py-3">Unité</th>
                <th className="px-4 py-3 text-right">Prix</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <LoaderCircle className="mr-2 inline animate-spin" size={16} />
                    Chargement…
                  </td>
                </tr>
              ) : prices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun tarif défini pour ce produit.
                  </td>
                </tr>
              ) : (
                prices.map((item) => (
                  <tr key={item.id}>
                    <th className="px-4 py-3 font-medium">{item.customer_type_name}</th>
                    <td className="px-4 py-3">
                      {item.unit_name} ({item.unit_symbol})
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {moneyFormat.format(Number(item.price))} F CFA
                    </td>
                    <td className="px-4 py-3">{item.is_active ? 'Actif' : 'Historique'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                        new Date(item.created_at),
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
