import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Check, LoaderCircle, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateFcfaLineAmount, formatFcfa } from "@/lib/money";
import { completeSale, createSaleReturn, getSale, listSaleItems, type Sale, type SaleItem } from "@/features/sales/sales-api";
import { SaleItemForm } from "@/features/sales/components/sale-item-form";
import { SaleItemRow } from "@/features/sales/components/sale-item-row";
import { SaleStatus } from "@/features/sales/components/sale-status";

const _quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});
void _quantityFormat;
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
type SaleView = { sale: Sale; items: SaleItem[] };

export function SaleDetailPage() {
  const { saleId = "" } = useParams();
  const { token } = useAuth();
  const [reload, setReload] = useState(0);
  const [saleView, setSaleView] = useState<{
    key: string;
    data: SaleView;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const requestKey = JSON.stringify([saleId, reload]);

  useEffect(() => {
    if (!saleId) return;
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getSale(saleId, controller.signal),
      listSaleItems(saleId, controller.signal),
    ])
      .then(([sale, items]) => {
        if (active) setSaleView({ key: requestKey, data: { sale, items } });
      })
      .catch((error: unknown) => {
        if (active)
          setFailure({
            key: requestKey,
            message:
              error instanceof Error
                ? error.message
                : "La vente est indisponible.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [saleId, reload, requestKey]);

  const currentView = saleView?.key === requestKey ? saleView.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !currentView && !error;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
          <Link to="/app/ventes">
            <ArrowLeft size={16} />
            Retour aux ventes
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Commerce</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Détail de la vente
        </h2>
      </div>
      {loading && (
        <div
          role="status"
          className="flex items-center gap-2 py-10 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" size={18} />
          Chargement de la vente…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={17} />
            {error}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/ventes">Liste</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReload((value) => value + 1)}
            >
              Réessayer
            </Button>
          </div>
        </div>
      )}
      {currentView && (
        <SaleWorkspace
          view={currentView}
          token={token}
          onChanged={() => setReload((value) => value + 1)}
        />
      )}
    </div>
  );
}

function SaleWorkspace({
  view,
  token,
  onChanged,
}: {
  view: SaleView;
  token: string | null;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { sale, items } = view;
  const [confirmation, setConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [returnReference, setReturnReference] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnError, setReturnError] = useState("");
  const [creatingReturn, setCreatingReturn] = useState(false);
  const total = items.reduce(
    (sum, item) =>
      sum + calculateFcfaLineAmount(item.quantity, item.unit_price),
    0n,
  );
  const isDraft = sale.status === "DRAFT";

  async function handleComplete() {
    if (!token) {
      setError(
        "Votre session a expiré. Reconnectez-vous avant de valider la vente.",
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await completeSale(token, String(sale.id));
      setConfirmation(false);
      onChanged();
    } catch (completionError) {
      setError(
        completionError instanceof Error
          ? completionError.message
          : "La vente n’a pas pu être validée.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setReturnError(
        "Votre session a expiré. Reconnectez-vous pour créer un retour.",
      );
      return;
    }
    setCreatingReturn(true);
    setReturnError("");
    try {
      const returned = await createSaleReturn(token, String(sale.id), {
        reference: returnReference.trim(),
        reason: returnReason.trim() || undefined,
      });
      navigate(`/app/ventes/retours/${returned.id}`);
    } catch (createError) {
      setReturnError(
        createError instanceof Error
          ? createError.message
          : "La création du retour a échoué.",
      );
    } finally {
      setCreatingReturn(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>Référence</CardDescription>
            <CardTitle>{sale.reference}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Client : {sale.customer_name || "Non renseigné"}
            </p>
            <p className="text-sm text-muted-foreground">
              Tarif :{" "}
              {sale.customer_type_name || "Type historique non renseigné"}
            </p>
          </div>
          <SaleStatus status={sale.status} />
        </CardHeader>
      </Card>
      {isDraft && (
        <SaleItemForm
          saleId={String(sale.id)}
          products={[]}
          token={token}
          onAdded={onChanged}
          disabled={false}
        />
      )}
      <section aria-label="Articles de la vente">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">Articles vendus</h3>
          <p className="text-sm text-muted-foreground">
            Total indicatif : {formatFcfa(total)}
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[660px] text-left text-sm">
            <caption className="sr-only">
              Produits, quantités et prix de la vente {sale.reference}.
            </caption>
            <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Produit
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Quantité
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Prix unitaire
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Aucun article dans cette vente.
                  </td>
                </tr>
              ) : (
                items.map((item) => <SaleItemRow key={item.id} item={item} />)
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    colSpan={3}
                    className="px-4 py-3 text-right font-medium"
                  >
                    Total indicatif
                  </th>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatFcfa(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      {isDraft && (
        <section className="space-y-3">
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {!confirmation ? (
            <Button
              disabled={items.length === 0}
              onClick={() => setConfirmation(true)}
            >
              <Check size={17} />
              Valider la vente
            </Button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-warning/10 p-4">
              <div>
                <p className="font-medium">Confirmer la validation ?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Le stock disponible sera contrôlé et diminué. Cette vente ne
                  peut pas être annulée.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setConfirmation(false)}
                >
                  Revenir au brouillon
                </Button>
                <Button
                  disabled={submitting || items.length === 0}
                  onClick={handleComplete}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="animate-spin" size={17} />
                      Validation…
                    </>
                  ) : (
                    "Confirmer et mettre à jour le stock"
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
      {!isDraft && sale.sold_at && (
        <p className="text-sm text-muted-foreground">
          Validée le {dateFormat.format(new Date(sale.sold_at))}
        </p>
      )}
      {sale.status === "COMPLETED" && (
        <Card>
          <CardHeader>
            <CardTitle>Enregistrer un retour de marchandises</CardTitle>
            <CardDescription>
              Cette opération réintègre les articles au stock et n’enregistre
              pas de remboursement d’argent. Les quantités déjà retournées
              seront contrôlées par le serveur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={handleCreateReturn}
            >
              <div className="space-y-2">
                <label
                  htmlFor="return-reference"
                  className="text-sm font-medium"
                >
                  Référence du retour
                </label>
                <Input
                  id="return-reference"
                  required
                  maxLength={100}
                  value={returnReference}
                  onChange={(event) => setReturnReference(event.target.value)}
                  placeholder="Référence ou numéro de document"
                  disabled={creatingReturn}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="return-reason" className="text-sm font-medium">
                  Motif{" "}
                  <span className="font-normal text-muted-foreground">
                    (facultatif)
                  </span>
                </label>
                <Input
                  id="return-reason"
                  value={returnReason}
                  onChange={(event) => setReturnReason(event.target.value)}
                  placeholder="Ex. produit endommagé"
                  disabled={creatingReturn}
                />
              </div>
              {returnError && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
                >
                  {returnError}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={creatingReturn || items.length === 0}
                >
                  {creatingReturn ? (
                    <>
                      <LoaderCircle className="animate-spin" size={17} />
                      Création…
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Créer le brouillon de retour
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
