import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, LoaderCircle, Plus, RotateCw, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatFcfaUnitPrice } from "@/lib/money";
import {
  createSale,
  getSalesReport,
  listCustomers,
  listCustomerTypes,
  listSales,
  type Customer,
  type CustomerType,
  type Sale,
} from "@/features/sales/sales-api";
import { MetricCard } from "@/features/sales/components/metric-card";
import { SaleRow } from "@/features/sales/components/sale-row";

const _dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Ouagadougou",
});
void _dateFormat;
const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

function quantityBreakdown(
  items: Array<{
    unit_id: string | number;
    unit_name: string;
    unit_symbol: string;
    quantity: string;
  }>,
) {
  return items.length
    ? items
        .map(
          (item) =>
            `${quantityFormat.format(Number(item.quantity))} ${item.unit_symbol || item.unit_name}`,
        )
        .join(" · ")
    : "Aucune quantité sur la période";
}

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Ouagadougou",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function initialRange() {
  const today = localDate(new Date());
  return { from: today, to: today };
}

export function SalesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState<{
    key: string;
    data: Sale[];
    total: number;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [range, setRange] = useState(initialRange);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof getSalesReport>>;
  } | null>(null);
  const [reportError, setReportError] = useState("");
  const [reportRetry, setReportRetry] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [customerFailure, setCustomerFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const [customerRetry, setCustomerRetry] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSubmittedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const key = JSON.stringify([
      range.from,
      range.to,
      statusFilter,
      submittedSearch,
      page,
      retry,
    ]);
    listSales(
      {
        from: range.from,
        to: range.to,
        status: statusFilter,
        search: submittedSearch,
        page,
        limit: 20,
      },
      controller.signal,
    )
      .then((data) => {
        if (active) setSales({ key, data: data.data, total: data.total });
      })
      .catch((error: unknown) => {
        if (active)
          setFailure({
            key,
            message:
              error instanceof Error
                ? error.message
                : "La liste des ventes est indisponible.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [range.from, range.to, statusFilter, submittedSearch, page, retry]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const key = `${range.from}:${range.to}`;
    getSalesReport(range.from, range.to, controller.signal)
      .then((data) => {
        if (active) {
          setReport({ key, data });
          setReportError("");
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setReportError(
            reason instanceof Error
              ? reason.message
              : "Le rapport est indisponible.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [range.from, range.to, reportRetry]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      listCustomers(controller.signal),
      listCustomerTypes(controller.signal),
    ])
      .then(([data, types]) => {
        if (!active) return;
        setCustomers(data);
        setCustomerTypes(types);
        setCustomerTypeId((current) =>
          types.some((type) => String(type.id) === current) ? current : "",
        );
        setCustomerId((current) =>
          data.some((customer) => String(customer.id) === current)
            ? current
            : "",
        );
        setCustomerFailure("");
      })
      .catch((error: unknown) => {
        if (active)
          setCustomerFailure(
            error instanceof Error
              ? error.message
              : "La liste des clients est indisponible.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [customerRetry]);

  const currentKey = JSON.stringify([
    range.from,
    range.to,
    statusFilter,
    submittedSearch,
    page,
    retry,
  ]);
  const currentSales = sales?.key === currentKey ? sales.data : null;
  const currentTotal = sales?.key === currentKey ? sales.total : 0;
  const error = failure?.key === currentKey ? failure.message : "";
  const loading = !currentSales && !error;
  const reportKey = `${range.from}:${range.to}`;
  const currentReport = report?.key === reportKey ? report.data : null;

  function setQuickRange(period: "today" | "week" | "month") {
    const now = new Date();
    const today = localDate(now);
    let from = today;
    if (period === "week") {
      const day = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
      const monday = new Date(`${today}T00:00:00Z`);
      monday.setUTCDate(monday.getUTCDate() - day + 1);
      from = localDate(monday);
    } else if (period === "month") {
      from = `${today.slice(0, 7)}-01`;
    }
    setRange({ from, to: today });
    setPage(1);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setFormError(
        "Votre session a expiré. Reconnectez-vous pour créer une vente.",
      );
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const sale = await createSale(token, {
        customer_id: customerId || null,
        customer_type_id: customerId
          ? String(
              customers.find((customer) => String(customer.id) === customerId)
                ?.customer_type_id || "",
            )
          : customerTypeId,
        reference: reference.trim(),
      });
      navigate(`/app/ventes/${sale.id}`);
    } catch (createError) {
      setFormError(
        createError instanceof Error
          ? createError.message
          : "La création de la vente a échoué.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-muted-foreground">Commerce</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Ventes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Préparez un brouillon puis validez-le pour enregistrer les sorties de
          stock.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle vente</CardTitle>
          <CardDescription>
            Le type de client fixe les prix; le client reste facultatif. Le
            stock sera contrôlé à la validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label htmlFor="sale-customer" className="text-sm font-medium">
                Client{" "}
                <span className="font-normal text-muted-foreground">
                  (facultatif)
                </span>
              </label>
              <select
                id="sale-customer"
                value={customerId}
                onChange={(event) => {
                  const id = event.target.value;
                  setCustomerId(id);
                  const customer = customers.find(
                    (item) => String(item.id) === id,
                  );
                  if (customer)
                    setCustomerTypeId(String(customer.customer_type_id));
                }}
                disabled={submitting}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Vente sans client</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              {customerFailure && (
                <p role="alert" className="text-sm text-destructive">
                  {customerFailure}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setCustomerRetry((value) => value + 1)}
                  >
                    Réessayer
                  </button>
                </p>
              )}
            </div>
            {!customerId && (
              <div className="space-y-2">
                <label
                  htmlFor="sale-customer-type"
                  className="text-sm font-medium"
                >
                  Type de client pour le tarif
                </label>
                <select
                  id="sale-customer-type"
                  required
                  value={customerTypeId}
                  onChange={(event) => setCustomerTypeId(event.target.value)}
                  disabled={submitting || customerTypes.length === 0}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Choisir un type de client</option>
                  {customerTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {customerTypes.length === 0 && (
                  <p className="text-xs text-destructive">
                    Aucun type tarifaire n’est configuré.{" "}
                    <Link className="font-medium underline" to="/app/clients">
                      Créer un type de client
                    </Link>{" "}
                    avant de poursuivre.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="sale-reference" className="text-sm font-medium">
                Référence du ticket ou référence interne
              </label>
              <Input
                id="sale-reference"
                required
                maxLength={100}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ex. ticket de caisse ou numéro interne"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Cette référence est saisie par votre équipe; elle n’est pas
                générée automatiquement.
              </p>
            </div>
            {formError && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
              >
                {formError}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || !customerTypeId}>
                {submitting ? (
                  <>
                    <LoaderCircle className="animate-spin" size={17} />
                    Création…
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    Créer le brouillon
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ventes de la période</CardTitle>
          <CardDescription>
            Ventes validées et retours physiques, selon le fuseau
            Africa/Ouagadougou. Le montant des ventes n’est pas un montant
            encaissé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" aria-label="Périodes rapides">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickRange("today")}
            >
              Aujourd’hui
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickRange("week")}
            >
              Cette semaine
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickRange("month")}
            >
              Ce mois
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="sales-from" className="text-sm font-medium">
                Du
              </label>
              <Input
                id="sales-from"
                type="date"
                value={range.from}
                max={range.to}
                onChange={(event) => {
                  setRange((current) => ({
                    ...current,
                    from: event.target.value,
                  }));
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sales-to" className="text-sm font-medium">
                Au
              </label>
              <Input
                id="sales-to"
                type="date"
                value={range.to}
                min={range.from}
                onChange={(event) => {
                  setRange((current) => ({
                    ...current,
                    to: event.target.value,
                  }));
                  setPage(1);
                }}
              />
            </div>
          </div>
          {reportError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 text-sm text-destructive"
            >
              <span>{reportError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReportRetry((value) => value + 1)}
              >
                <RotateCw size={15} />
                Réessayer
              </Button>
            </div>
          )}
          {!currentReport && !reportError && (
            <p role="status" className="text-sm text-muted-foreground">
              Calcul du rapport…
            </p>
          )}
          {currentReport && (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Ventes validées"
                value={String(currentReport.sales.sale_count)}
                detail={formatFcfaUnitPrice(
                  currentReport.sales.sales_total_fcfa,
                )}
              />
              <MetricCard
                label="Quantités vendues"
                value={quantityBreakdown(currentReport.sold_by_unit)}
                detail="Regroupées par unité de vente"
              />
              <MetricCard
                label="Retours physiques"
                value={String(currentReport.returns.return_count)}
                detail={`${quantityBreakdown(currentReport.returned_by_unit)} · valeur articles ${formatFcfaUnitPrice(currentReport.returns.returned_items_value_fcfa)} — pas un remboursement`}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <section aria-label="Historique des ventes">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Historique des ventes</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetry((value) => value + 1)}
            disabled={loading}
          >
            <RotateCw size={15} />
            Actualiser
          </Button>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span className="flex items-center gap-2">
              <AlertCircle size={17} />
              {error}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
            >
              Réessayer
            </Button>
          </div>
        )}
        <div className="mb-3 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Rechercher une référence ou un client"
              className="pl-9"
              placeholder="Référence ou client"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Tous les statuts</option>
            <option value="COMPLETED">Validées</option>
            <option value="DRAFT">Brouillons</option>
            <option value="CANCELLED">Annulées</option>
          </select>
        </div>
        <div
          className="overflow-x-auto rounded-lg border bg-card"
          aria-busy={loading}
        >
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              Ventes récentes, client et état.
            </caption>
            <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Référence
                </th>
                <th scope="col" className="px-4 py-3">
                  Client
                </th>
                <th scope="col" className="px-4 py-3">
                  Date
                </th>
                <th scope="col" className="px-4 py-3">
                  Total
                </th>
                <th scope="col" className="px-4 py-3">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="animate-spin" size={18} />
                      Chargement des ventes…
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    La liste ne peut pas être affichée.
                  </td>
                </tr>
              ) : currentSales?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Aucune vente enregistrée.
                  </td>
                </tr>
              ) : (
                currentSales?.map((sale) => (
                  <SaleRow key={sale.id} sale={sale} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {currentTotal} vente(s) · page {page} sur{" "}
            {Math.max(1, Math.ceil(currentTotal / 20))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(currentTotal / 20) || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
