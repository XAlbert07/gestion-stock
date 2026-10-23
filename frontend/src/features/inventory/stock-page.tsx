import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ClipboardCheck, LoaderCircle, RotateCw, Truck, Warehouse } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getCatalogUnits } from "@/features/catalog/catalog-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductMovements, getProductStock, type ProductStock, type StockMovement } from "@/features/inventory/inventory-api";
import { MovementRow } from "@/features/inventory/components/movement-row";

const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});
const operationLabels: Record<string, string> = {
  RECEIPT: "Réception",
  OPENING_BALANCE: "Stock initial",
  SALE: "Vente",
  ADJUSTMENT: "Ajustement",
  CANCELLATION: "Annulation",
};

type StockView = { product: ProductStock; movements: StockMovement[] };

export function StockPage() {
  const { productId } = useParams();
  const [retry, setRetry] = useState(0);
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [operationType, setOperationType] = useState("");
  const [stockView, setStockView] = useState<{
    key: string;
    data: StockView;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [unitNames, setUnitNames] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [unitFailure, setUnitFailure] = useState("");
  const [unitRetry, setUnitRetry] = useState(0);
  const requestKey = JSON.stringify([
    productId,
    retry,
    movementFrom,
    movementTo,
    operationType,
  ]);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getProductStock(productId, controller.signal),
      getProductMovements(
        productId,
        { from: movementFrom, to: movementTo, operationType },
        controller.signal,
      ),
    ])
      .then(([product, movements]) => {
        if (active)
          setStockView({ key: requestKey, data: { product, movements } });
      })
      .catch((error: unknown) => {
        if (active)
          setFailure({
            key: requestKey,
            message:
              error instanceof Error
                ? error.message
                : "Les informations de stock ne sont pas disponibles.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [productId, retry, requestKey, movementFrom, movementTo, operationType]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getCatalogUnits(controller.signal)
      .then((units) => {
        if (active) {
          setUnitNames(
            new Map(
              units.map((unit) => [String(unit.id), unit.symbol || unit.name]),
            ),
          );
          setUnitFailure("");
        }
      })
      .catch(() => {
        if (active)
          setUnitFailure(
            "Le libellé de l’unité est temporairement indisponible.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [unitRetry]);

  const currentView = stockView?.key === requestKey ? stockView.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !currentView && !error;
  const unitName = useMemo(
    () =>
      currentView
        ? unitNames.get(String(currentView.product.base_unit_id)) ||
          `Unité #${currentView.product.base_unit_id}`
        : "",
    [currentView, unitNames],
  );

  if (!productId) {
    return (
      <div className="space-y-6">
        <section>
          <p className="text-sm text-muted-foreground">Inventaire</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Stock</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sélectionnez un produit depuis le catalogue pour consulter son stock et ses mouvements.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
          <Link to="/app/catalogue">
            <ArrowLeft size={16} />
            Retour au catalogue
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Inventaire</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Consultation du stock
        </h2>
      </div>

      {loading && (
        <div
          role="status"
          className="flex items-center gap-2 py-10 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" size={18} />
          Chargement du stock et des mouvements…
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
              <Link to="/app/catalogue">Catalogue</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
            >
              <RotateCw size={15} />
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {currentView && (
        <>
          <section className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">
                {currentView.product.name}
              </h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {currentView.product.sku}
              </p>
            </div>
            <Badge
              variant={currentView.product.is_active ? "success" : "outline"}
            >
              {currentView.product.is_active
                ? "Produit actif"
                : "Produit désactivé"}
            </Badge>
          </section>

          {currentView.product.is_active && (
            <section
              aria-label="Choisir une opération de stock"
              className="space-y-3"
            >
              <p className="text-sm font-medium">Que souhaitez-vous faire ?</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link
                    to={`/app/stock/${encodeURIComponent(String(currentView.product.id))}/comptage`}
                  >
                    <ClipboardCheck size={16} />
                    Corriger après un comptage
                  </Link>
                </Button>
                {Number(currentView.product.current_stock) === 0 &&
                  currentView.movements.length === 0 && (
                    <Button asChild>
                      <Link
                        to={`/app/stock/${encodeURIComponent(String(currentView.product.id))}/initial`}
                      >
                        <Warehouse size={16} />
                        Saisir le stock initial
                      </Link>
                    </Button>
                  )}
                <Button asChild variant="outline">
                  <Link to="/app/receptions">
                    <Truck size={16} />
                    Enregistrer une livraison
                  </Link>
                </Button>
              </div>
              <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
                Stock initial : quantité déjà présente lors du démarrage du
                logiciel. Livraison : nouvel approvisionnement avec son
                fournisseur. Comptage : correction du stock enregistré après
                vérification physique.
              </p>
            </section>
          )}

          <section
            aria-label="Niveau de stock"
            className="grid gap-4 sm:grid-cols-2"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Stock actuel</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {quantityFormat.format(
                    Number(currentView.product.current_stock),
                  )}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    {unitName}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    Number(currentView.product.current_stock) <=
                    Number(currentView.product.critical_threshold)
                      ? "warning"
                      : "success"
                  }
                >
                  {Number(currentView.product.current_stock) <=
                  Number(currentView.product.critical_threshold)
                    ? "Sous le seuil critique"
                    : "Niveau suffisant"}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Seuil critique</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {quantityFormat.format(
                    Number(currentView.product.critical_threshold),
                  )}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    {unitName}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </section>

          {unitFailure && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 text-sm text-warning"
            >
              <span>{unitFailure}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnitRetry((value) => value + 1)}
              >
                <RotateCw size={15} />
                Réessayer
              </Button>
            </div>
          )}
          <section
            aria-label="Historique des mouvements de stock"
            aria-busy={loading}
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">Mouvements récents</h3>
              <p className="text-sm text-muted-foreground">
                Jusqu’aux 50 dernières opérations
              </p>
            </div>
            <div className="mb-3 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="movement-from" className="text-sm font-medium">
                  Depuis
                </label>
                <input
                  id="movement-from"
                  type="date"
                  value={movementFrom}
                  onChange={(event) => setMovementFrom(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="movement-to" className="text-sm font-medium">
                  Jusqu’au
                </label>
                <input
                  id="movement-to"
                  type="date"
                  value={movementTo}
                  onChange={(event) => setMovementTo(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="movement-type" className="text-sm font-medium">
                  Type d’opération
                </label>
                <select
                  id="movement-type"
                  value={operationType}
                  onChange={(event) => setOperationType(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Tous les types</option>
                  {Object.entries(operationLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">
                  Historique des entrées et sorties de stock pour{" "}
                  {currentView.product.name}.
                </caption>
                <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Opération
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Sens
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Quantité
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentView.movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        Aucun mouvement enregistré pour ce produit.
                      </td>
                    </tr>
                  ) : (
                    currentView.movements.map((movement) => (
                      <MovementRow
                        key={movement.id}
                        movement={movement}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
