import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Building2, LoaderCircle, Pencil, Plus, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listSuppliers, saveSupplier, type SupplierRecord } from '@/features/suppliers/suppliers-api'

const fieldClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [editing, setEditing] = useState<SupplierRecord | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [loadedRetry, setLoadedRetry] = useState(-1)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listSuppliers(true, controller.signal)
      .then((records) => { setSuppliers(records); setError(''); setLoadedRetry(retry) })
      .catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : 'Les fournisseurs ne peuvent pas être chargés.'); setLoadedRetry(retry) })
    return () => controller.abort()
  }, [retry])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      await saveSupplier(editing?.id ?? null, {
        name: String(data.get('name')).trim(), phone: String(data.get('phone')).trim(),
        email: String(data.get('email')).trim(), address: String(data.get('address')).trim(),
        is_active: data.get('is_active') === 'on',
      })
      setEditing(null)
      setFormKey((value) => value + 1)
      setRetry((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le fournisseur n’a pas pu être enregistré.')
    } finally {
      setSaving(false)
    }
  }

  function edit(supplier: SupplierRecord) {
    setEditing(supplier)
    setFormKey((value) => value + 1)
  }

  const visible = suppliers.filter((supplier) => showInactive || supplier.is_active)
  const loading = loadedRetry !== retry
  return <div className="space-y-6">
    <div><Link to="/app/receptions" className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline">← Retour aux réceptions</Link><p className="mt-4 text-sm text-muted-foreground">Approvisionnement</p><h2 className="mt-1 text-2xl font-semibold">Fournisseurs</h2><p className="mt-2 text-sm text-muted-foreground">Enregistrez les coordonnées utiles. Un fournisseur désactivé est conservé dans l’historique et ne peut plus être sélectionné pour une nouvelle réception.</p></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}><RotateCw size={15} />Réessayer</Button></div>}
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div><h3 className="font-semibold">{editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3><p className="mt-1 text-sm text-muted-foreground">Le nom est requis; les coordonnées restent facultatives.</p></div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} key={formKey}>
        <Field label="Nom du fournisseur" id="supplier-name"><Input id="supplier-name" name="name" required maxLength={150} defaultValue={editing?.name || ''} /></Field>
        <Field label="Téléphone" id="supplier-phone"><Input id="supplier-phone" name="phone" maxLength={30} defaultValue={editing?.phone || ''} /></Field>
        <Field label="Adresse e-mail" id="supplier-email"><Input id="supplier-email" name="email" type="email" maxLength={255} defaultValue={editing?.email || ''} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" className="size-4 accent-primary" defaultChecked={editing?.is_active ?? true} />Fournisseur actif pour les nouvelles réceptions</label>
        <Field label="Adresse" id="supplier-address"><textarea id="supplier-address" name="address" rows={3} maxLength={5000} className={`${fieldClass} h-auto py-2`} defaultValue={editing?.address || ''} /></Field>
        <div className="flex items-end justify-end gap-2 pb-1">{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setFormKey((value) => value + 1) }}>Annuler</Button>}<Button disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={16} />}<Plus size={16} />{editing ? 'Enregistrer' : 'Créer le fournisseur'}</Button></div>
      </form>
    </section>
    <section aria-label="Répertoire des fournisseurs" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Répertoire</h3><p className="text-sm text-muted-foreground">{visible.length} fournisseur{visible.length === 1 ? '' : 's'}</p></div><div className="flex gap-2"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="size-4 accent-primary" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Afficher les désactivés</label><Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)} disabled={loading}><RotateCw size={15} />Actualiser</Button></div></div>
      {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle size={18} className="animate-spin" />Chargement…</p> : <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Répertoire des fournisseurs et leur état.</caption><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3">Fournisseur</th><th scope="col" className="px-4 py-3">Contact</th><th scope="col" className="px-4 py-3">État</th><th scope="col" className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-border">{visible.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">{showInactive ? 'Aucun fournisseur enregistré.' : 'Aucun fournisseur actif. Créez-en un pour enregistrer une réception.'}</td></tr> : visible.map((supplier) => <tr key={supplier.id} className={!supplier.is_active ? 'bg-muted/30' : undefined}><th scope="row" className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-2"><Building2 size={16} className="text-muted-foreground" />{supplier.name}</span>{supplier.address && <span className="mt-1 block whitespace-pre-wrap text-xs font-normal text-muted-foreground">{supplier.address}</span>}</th><td className="px-4 py-3 text-muted-foreground">{supplier.phone || '—'}{supplier.email && <span className="mt-1 block">{supplier.email}</span>}</td><td className="px-4 py-3"><Badge variant={supplier.is_active ? 'success' : 'outline'}>{supplier.is_active ? 'Actif' : 'Désactivé'}</Badge></td><td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => edit(supplier)}><Pencil size={15} />Modifier</Button></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}</div> }
