import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalogUnits } from "@/features/catalog/catalog-api";
import {
  createOpeningStock,
  createStockCount,
  getProductMovements,
  getProductStock,
  type ProductStock,
} from "@/features/inventory/inventory-api";

const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});
const moneyFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function StockCountPage({ mode }: { mode: "initial" | "count" }) {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductStock | null>(null);
  const [unitName, setUnitName] = useState("unité");
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getProductStock(productId, controller.signal),
      getProductMovements(productId, {}, controller.signal),
      getCatalogUnits(controller.signal),
    ])
      .then(([stock, movements, units]) => {
        setProduct(stock);
        setUnitName(
          units.find((unit) => String(unit.id) === String(stock.base_unit_id))
            ?.symbol || "unité",
        );
        if (
          mode === "initial" &&
          (Number(stock.current_stock) !== 0 || movements.length > 0)
        ) {
          setError(
            "Le stock initial est réservé aux produits sans aucun mouvement. Utilisez un comptage physique.",
          );
        }
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          failure instanceof Error
            ? failure.message
            : "Le produit ne peut pas être chargé.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [productId, mode]);

  const currentStock = Number(product?.current_stock || 0);
  const difference = Number(quantity || 0) - currentStock;
  const needsCost = mode === "initial" || difference > 0;
  const differenceLabel = useMemo(() => {
    if (mode === "initial") return "Création du stock de départ";
    if (!quantity)
      return "Saisissez la quantité réellement comptée pour calculer l’écart.";
    if (difference === 0) return "Aucun écart : le stock ne sera pas modifié.";
    return `${difference > 0 ? "Entrée" : "Sortie"} de ${quantityFormat.format(Math.abs(difference))} ${unitName}`;
  }, [difference, mode, quantity, unitName]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        product_id: Number(productId),
        quantity,
        reason: reason.trim(),
      };
      if (mode === "initial")
        await createOpeningStock({ ...payload, unit_cost: unitCost });
      else
        await createStockCount({
          ...payload,
          ...(needsCost ? { unit_cost: unitCost } : {}),
        });
      setSuccess(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "La mise à jour du stock a échoué.",
      );
    } finally {
      setSaving(false);
    }
  }

  const disabled =
    loading ||
    saving ||
    !product?.is_active ||
    !confirmed ||
    (difference === 0 && mode === "count") ||
    (mode === "initial" && Boolean(error));
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to={`/app/stock/${encodeURIComponent(productId)}`}>
            <ArrowLeft size={16} />
            Retour au stock
          </Link>
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">Inventaire</p>
        <h2 className="mt-1 text-2xl font-semibold">
          {mode === "initial" ? "Stock initial" : "Comptage physique"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "initial"
            ? "Enregistrez une seule fois le stock présent au démarrage, avec son coût de référence."
            : "Saisissez la quantité réellement comptée. L’écart et le mouvement seront enregistrés ensemble."}
        </p>
      </div>
      {loading && (
        <p
          role="status"
          className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin" size={18} />
          Chargement du produit…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle size={17} />
          {error}
        </div>
      )}
      {product && (
        <div className="rounded-lg border bg-card p-5">
          <p className="font-medium">{product.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {product.sku}
          </p>
          {mode === "count" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Stock enregistré :{" "}
              <strong className="text-foreground">
                {quantityFormat.format(currentStock)} {unitName}
              </strong>
            </p>
          )}
        </div>
      )}
      {success ? (
        <div
          role="status"
          className="space-y-4 rounded-lg border border-success/40 bg-success/5 p-5"
        >
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 size={18} />
            Stock enregistré avec succès.
          </p>
          <Button
            onClick={() =>
              navigate(`/app/stock/${encodeURIComponent(productId)}`, {
                replace: true,
              })
            }
          >
            Voir le stock et son mouvement
          </Button>
        </div>
      ) : (
        product && (
          <form
            className="space-y-5 rounded-lg border bg-card p-5"
            onSubmit={submit}
          >
            <div className="space-y-2">
              <label htmlFor="counted-quantity" className="text-sm font-medium">
                {mode === "initial"
                  ? `Quantité initiale (${unitName})`
                  : `Quantité réellement comptée (${unitName})`}
              </label>
              <Input
                id="counted-quantity"
                type="number"
                required
                min={mode === "initial" ? "0.001" : "0"}
                max="99999999999.999"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            {needsCost && (
              <div className="space-y-2">
                <label htmlFor="unit-cost" className="text-sm font-medium">
                  Coût d’achat par {unitName} (F CFA)
                </label>
                <Input
                  id="unit-cost"
                  type="number"
                  required
                  min="0"
                  max="999999999999"
                  step="1"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Montant entier en F CFA. Il sert à valoriser l’entrée et au
                  calcul du coût moyen.
                </p>
              </div>
            )}
            <div className="rounded-md bg-muted/50 p-4">
              <p className="text-sm font-medium">{differenceLabel}</p>
              {mode === "count" && quantity && difference !== 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Après validation, le stock sera de{" "}
                  {quantityFormat.format(Number(quantity))} {unitName}.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="count-reason" className="text-sm font-medium">
                Motif de l’opération
              </label>
              <textarea
                id="count-reason"
                required
                maxLength={5000}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={
                  mode === "initial"
                    ? "Ex. inventaire réalisé avant la mise en service"
                    : "Ex. inventaire du rayon boissons"
                }
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-0.5 size-4 accent-primary"
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                Je confirme la quantité comptée et comprends que le mouvement
                sera historisé.
              </span>
            </label>
            <div className="flex justify-end border-t pt-4">
              <Button type="submit" disabled={disabled}>
                {saving && <LoaderCircle size={16} className="animate-spin" />}
                {saving ? "Enregistrement…" : "Confirmer le mouvement"}
              </Button>
            </div>
          </form>
        )
      )}
      {product &&
        mode === "count" &&
        needsCost &&
        unitCost &&
        /^\d+$/.test(unitCost) && (
          <p className="text-right text-xs text-muted-foreground">
            Coût saisi : {moneyFormat.format(Number(unitCost))} F CFA /{" "}
            {unitName}
          </p>
        )}
    </div>
  );
}
