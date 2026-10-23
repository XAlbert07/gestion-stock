import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Building2, LoaderCircle, Plus, RotateCw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { listReceipts, listSuppliers, createReceipt, type Receipt, type Supplier, type PaginatedReceipts } from '@/features/receipts/receipts-api'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export function ReceiptsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [receipts, setReceipts] = useState<{ key: number; data: PaginatedReceipts } | null>(null)
  const [receiptFailure, setReceiptFailure] = useState<{ key: number; message: string } | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierFailure, setSupplierFailure] = useState('')
  const [retry, setRetry] = useState(0)
  const [supplierRetry, setSupplierRetry] = useState(0)
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    listReceipts({ page, limit }, controller.signal)
      .then((data) => { if (active) setReceipts({ key: retry, data }) })
      .catch((error: unknown) => {
        if (active) setReceiptFailure({ key: retry, message: error instanceof Error ? error.message : 'La liste des réceptions est indisponible.' })
      })
    return () => { active = false; controller.abort() }
  }, [retry, page, limit])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    listSuppliers(controller.signal)
      .then((data) => {
        if (!active) return
        setSuppliers(data)
        setSupplierId((current) => data.some((supplier) => String(supplier.id) === current) ? current : String(data[0]?.id || ''))
        setSupplierFailure('')
      })
      .catch((error: unknown) => {
        if (active) setSupplierFailure(error instanceof Error ? error.message : 'La liste des fournisseurs est indisponible.')
      })
    return () => { active = false; controller.abort() }
  }, [supplierRetry])

  const currentResponse = receipts?.key === retry ? receipts.data : null
  const receiptError = receiptFailure?.key === retry ? receiptFailure.message : ''
  const loading = !currentResponse && !receiptError
  const currentReceipts = currentResponse?.items || []
  const total = currentResponse?.total || 0
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1
  const lastItem = total === 0 ? 0 : Math.min(page * limit, total)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setFormError('Votre session a expiré. Reconnectez-vous pour créer une réception.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const receipt = await createReceipt(token, { supplier_id: supplierId, reference: reference.trim(), notes: notes.trim() || undefined })
      navigate(`/app/receptions/${receipt.id}`)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'La création de la réception a échoué.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-muted-foreground">Approvisionnement</p>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="mt-1 text-2xl font-semibold tracking-tight">Réceptions</h2><p className="mt-2 text-sm text-muted-foreground">Préparez une réception en brouillon, puis validez-la pour enregistrer les entrées de stock.</p></div><Button asChild variant="outline"><Link to="/app/fournisseurs"><Building2 size={16} />Gérer les fournisseurs</Link></Button></div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle réception</CardTitle>
          <CardDescription>La réception restera en brouillon tant que vous ne l’aurez pas validée.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label htmlFor="receipt-supplier" className="text-sm font-medium">Fournisseur</label>
              <select id="receipt-supplier" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={submitting || suppliers.length === 0} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="" disabled>Sélectionner un fournisseur</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="receipt-reference" className="text-sm font-medium">Référence</label>
              <Input id="receipt-reference" required maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bon de livraison ou référence interne" disabled={submitting} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="receipt-notes" className="text-sm font-medium">Note <span className="font-normal text-muted-foreground">(facultatif)</span></label>
              <textarea id="receipt-notes" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={submitting} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            {supplierFailure && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive sm:col-span-2"><span>{supplierFailure}</span><Button variant="outline" size="sm" type="button" onClick={() => setSupplierRetry((value) => value + 1)}><RotateCw size={15} />Réessayer</Button></div>}
            {suppliers.length === 0 && !supplierFailure && <p className="text-sm text-muted-foreground sm:col-span-2">Aucun fournisseur actif n’est disponible pour une nouvelle réception.</p>}
            {formError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{formError}</p>}
            <div className="sm:col-span-2"><Button type="submit" disabled={submitting || suppliers.length === 0 || !supplierId}>{submitting ? <><LoaderCircle className="animate-spin" size={17} />Création…</> : <><Plus size={17} />Créer le brouillon</>}</Button></div>
          </form>
        </CardContent>
      </Card>

      <section aria-label="Liste des réceptions">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Historique des réceptions</h3>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)} disabled={loading}><RotateCw size={15} />Actualiser</Button>
        </div>
        {receiptError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"><span className="flex items-center gap-2"><AlertCircle size={17} />{receiptError}</span><Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></div>}
        <div className="overflow-x-auto rounded-lg border bg-card" aria-busy={loading}>
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Réceptions récentes et leur statut.</caption>
            <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3">Référence</th><th scope="col" className="px-4 py-3">Fournisseur</th><th scope="col" className="px-4 py-3">Créée le</th><th scope="col" className="px-4 py-3">Statut</th><th scope="col" className="px-4 py-3"><span className="sr-only">Détail</span></th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground"><span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={18} />Chargement des réceptions…</span></td></tr> : receiptError ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">La liste ne peut pas être affichée.</td></tr> : currentReceipts.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Aucune réception enregistrée.</td></tr> : currentReceipts.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} />)}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Affichage {firstItem}-{lastItem} sur {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || page <= 1}>
                Précédent
              </Button>
              <span className="min-w-20 text-center">
                Page {page} / {pageCount}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={loading || page >= pageCount}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-3 font-medium"><Link className="text-primary underline-offset-4 hover:underline" to={`/app/receptions/${receipt.id}`}>{receipt.reference}</Link></th>
      <td className="px-4 py-3">{receipt.supplier_name}</td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{dateFormat.format(new Date(receipt.created_at))}</td>
      <td className="px-4 py-3"><ReceiptStatus status={receipt.status} /></td>
      <td className="px-4 py-3 text-right"><Link className="text-sm text-primary underline-offset-4 hover:underline" to={`/app/receptions/${receipt.id}`}>Ouvrir</Link></td>
    </tr>
  )
}

export function ReceiptStatus({ status }: { status: Receipt['status'] }) {
  if (status === 'COMPLETED') return <Badge variant="success">Validée</Badge>
  if (status === 'CANCELLED') return <Badge variant="outline">Annulée</Badge>
  return <Badge variant="warning">Brouillon</Badge>
}
