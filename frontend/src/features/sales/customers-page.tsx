import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, Plus, RotateCw } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  createCustomer,
  createCustomerType,
  listCustomers,
  listCustomerTypes,
  type Customer,
  type CustomerType,
} from '@/features/sales/sales-api'

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function CustomersPage() {
  const { token } = useAuth()
  const [types, setTypes] = useState<CustomerType[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [typeName, setTypeName] = useState('')
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)

  const load = useCallback(() => Promise.all([listCustomerTypes(), listCustomers()]), [])
  function applyData([nextTypes, nextCustomers]: [CustomerType[], Customer[]]) {
    setTypes(nextTypes)
    setCustomers(nextCustomers)
    setTypeId((current) =>
      nextTypes.some((item) => String(item.id) === current)
        ? current
        : String(nextTypes[0]?.id || ''),
    )
  }
  async function reload() {
    applyData(await load())
  }
  useEffect(() => {
    let active = true
    load()
      .then((data) => {
        if (active) applyData(data)
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Les clients ne sont pas disponibles.',
          )
      })
    return () => {
      active = false
    }
  }, [load, retry])

  async function submitType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return setError('Votre session a expiré.')
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createCustomerType(token, typeName.trim())
      setTypeName('')
      await reload()
      setNotice('Type de client créé.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le type n’a pas pu être créé.')
    } finally {
      setSaving(false)
    }
  }
  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return setError('Votre session a expiré.')
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createCustomer(token, {
        customer_type_id: Number(typeId),
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      })
      setName('')
      setPhone('')
      setAddress('')
      await reload()
      setNotice('Client enregistré.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le client n’a pas pu être créé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-muted-foreground">Commerce</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Clients et types de clients</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Les types de clients déterminent les tarifs applicables lors des ventes.
        </p>
      </section>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
            <RotateCw size={15} />
            Réessayer
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouveau type de client</CardTitle>
            <CardDescription>Exemples : Particulier, Revendeur, Grossiste.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitType}>
              <Input
                aria-label="Nom du type de client"
                required
                maxLength={50}
                value={typeName}
                onChange={(event) => setTypeName(event.target.value)}
                placeholder="Nom du type"
              />
              <Button disabled={saving} type="submit">
                <Plus size={16} />
                Créer le type
              </Button>
            </form>
            <ul className="mt-4 flex flex-wrap gap-2">
              {types.map((type) => (
                <li key={type.id} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {type.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nouveau client</CardTitle>
            <CardDescription>
              Le type choisi sera utilisé automatiquement dans ses ventes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitCustomer}>
              <Input
                aria-label="Nom du client"
                required
                maxLength={150}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom"
              />
              <select
                aria-label="Type du client"
                required
                className={selectClass}
                value={typeId}
                onChange={(event) => setTypeId(event.target.value)}
              >
                <option value="">Choisir un type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Téléphone du client"
                maxLength={30}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Téléphone (facultatif)"
              />
              <Input
                aria-label="Adresse du client"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Adresse (facultative)"
              />
              <Button
                className="sm:col-span-2"
                disabled={saving || types.length === 0}
                type="submit"
              >
                {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
                Enregistrer le client
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <section>
        <h3 className="mb-3 text-lg font-semibold">Clients actifs</h3>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type de tarif</th>
                <th className="px-4 py-3">Téléphone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun client enregistré.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <th className="px-4 py-3 font-medium">{customer.name}</th>
                    <td className="px-4 py-3">{customer.customer_type_name}</td>
                    <td className="px-4 py-3">{customer.phone || '—'}</td>
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
