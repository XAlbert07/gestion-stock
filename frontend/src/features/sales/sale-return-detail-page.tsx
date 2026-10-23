import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalogUnits, type CatalogUnit } from "@/features/catalog/catalog-api";
import {
  completeSaleReturn,
  getSale,
  getSaleReturn,
  listSaleItems,
  listSaleReturnItems,
  type Sale,
  type SaleItem,
  type SaleReturn,
  type SaleReturnItem,
} from "@/features/sales/sales-api";
import { ReturnItemForm } from "@/features/sales/components/return-item-form";
import { ReturnItemRow } from "@/features/sales/components/return-item-row";
import { ReturnStatus } from "@/features/sales/components/return-status";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
type ReturnView = { returned: SaleReturn; items: SaleReturnItem[] };

export function SaleReturnDetailPage() {
  const { returnId = "" } = useParams();
  const { token } = useAuth();
  const [reload, setReload] = useState(0);
  const [returnView, setReturnView] = useState<{
    key: string;
    data: ReturnView;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const requestKey = JSON.stringify([returnId, reload]);

  useEffect(() => {
    if (!returnId) return;
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getSaleReturn(returnId, controller.signal),
      listSaleReturnItems(returnId, controller.signal),
    ])
      .then(([returned, items]) => {
        if (active)
          setReturnView({ key: requestKey, data: { returned, items } });
      })
      .catch((error: unknown) => {
        if (active)
          setFailure({
            key: requestKey,
            message:
              error instanceof Error
                ? error.message
                : "Le retour est indisponible.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [returnId, reload, requestKey]);

  const currentView = returnView?.key === requestKey ? returnView.data : null;
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
        <p className="text-sm text-muted-foreground">Commerce · Retours</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Détail du retour de marchandises
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La validation réintègre les articles au stock. Aucun remboursement
          financier n’est enregistré ici.
        </p>
      </div>
      {loading && (
        <div
          role="status"
          className="flex items-center gap-2 py-10 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" size={18} />
          Chargement du retour…
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReload((value) => value + 1)}
          >
            Réessayer
          </Button>
        </div>
      )}
      {currentView && (
        <ReturnWorkspace
          key={currentView.returned.id}
          view={currentView}
          token={token}
          onChanged={() => setReload((value) => value + 1)}
        />
      )}
    </div>
  );
}

function ReturnWorkspace({
  view,
  token,
  onChanged,
}: {
  view: ReturnView;
  token: string | null;
  onChanged: () => void;
}) {
  const { returned, items } = view;
  const [reloadSale, setReloadSale] = useState(0);
  const saleRequestKey = JSON.stringify([returned.sale_id, reloadSale]);
  const [saleData, setSaleData] = useState<{
    key: string;
    sale: Sale;
    items: SaleItem[];
    units: CatalogUnit[];
  } | null>(null);
  const [saleFailure, setSaleFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const isDraft = returned.status === "DRAFT";

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getSale(String(returned.sale_id), controller.signal),
      listSaleItems(String(returned.sale_id), controller.signal),
      getCatalogUnits(controller.signal),
    ])
      .then(([saleData, saleLines, unitData]) => {
        if (!active) return;
        setSaleData({
          key: saleRequestKey,
          sale: saleData,
          items: saleLines,
          units: unitData,
        });
      })
      .catch((error: unknown) => {
        if (active)
          setSaleFailure({
            key: saleRequestKey,
            message:
              error instanceof Error
                ? error.message
                : "Les lignes de la vente d’origine sont indisponibles.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [returned.sale_id, reloadSale, saleRequestKey]);

  async function handleComplete() {
    if (!token) {
      setCompletionError(
        "Votre session a expiré. Reconnectez-vous avant de valider le retour.",
      );
      return;
    }
    setSubmitting(true);
    setCompletionError("");
    try {
      await completeSaleReturn(token, String(returned.id));
      setConfirmation(false);
      onChanged();
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : "Le retour n’a pas pu être validé.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const currentSaleData = saleData?.key === saleRequestKey ? saleData : null;
  const loading = !currentSaleData && saleFailure?.key !== saleRequestKey;
  const loadError =
    saleFailure?.key === saleRequestKey ? saleFailure.message : "";
  const sale = currentSaleData?.sale || null;
  const saleItems = currentSaleData?.items || [];
  const unitLabels = new Map(
    (currentSaleData?.units || []).map((unit) => [
      String(unit.id),
      unit.symbol,
    ]),
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>Référence du retour</CardDescription>
            <CardTitle>{returned.reference}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Vente d’origine :{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline"
                to={`/app/ventes/${returned.sale_id}`}
              >
                {sale?.reference || `#${returned.sale_id}`}
              </Link>
            </p>
            {returned.reason && (
              <p className="text-sm text-muted-foreground">
                Motif : {returned.reason}
              </p>
            )}
          </div>
          <ReturnStatus status={returned.status} />
        </CardHeader>
      </Card>
      {isDraft && (
        <ReturnItemForm
          returnId={String(returned.id)}
          saleItems={saleItems}
          currentItems={items}
          unitLabels={unitLabels}
          token={token}
          disabled={loading || Boolean(loadError)}
          onAdded={onChanged}
        />
      )}
      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{loadError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadSale((value) => value + 1)}
          >
            Réessayer
          </Button>
        </div>
      )}
      {loading && (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" size={17} />
          Chargement de la vente d’origine…
        </div>
      )}
      <section aria-label="Articles retournés">
        <h3 className="mb-3 text-lg font-semibold">Articles retournés</h3>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">
              Lignes du retour {returned.reference}.
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
                  Prix de vente
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Aucun article dans ce retour.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <ReturnItemRow
                    key={item.id}
                    item={item}
                    unitSymbol={unitLabels.get(String(item.unit_id)) || ""}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {isDraft && (
        <section className="space-y-3">
          {completionError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {completionError}
            </p>
          )}
          {!confirmation ? (
            <Button
              disabled={items.length === 0 || loading || Boolean(loadError)}
              onClick={() => setConfirmation(true)}
            >
              <Check size={17} />
              Valider le retour
            </Button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-warning/10 p-4">
              <div>
                <p className="font-medium">
                  Confirmer la validation du retour ?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les articles seront remis en stock. Le remboursement financier
                  n’est pas géré par ce parcours.
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
                    "Confirmer et remettre en stock"
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
      {!isDraft && returned.returned_at && (
        <p className="text-sm text-muted-foreground">
          Validé le {dateFormat.format(new Date(returned.returned_at))}
        </p>
      )}
    </div>
  );
}
