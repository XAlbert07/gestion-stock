import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getStockSummary,
  type StockSummary,
} from "@/features/inventory/inventory-api";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});
const operationLabels: Record<string, string> = {
  RECEIPT: "Réception",
  OPENING_BALANCE: "Stock initial",
  SALE: "Vente",
  RETURN: "Retour",
  ADJUSTMENT: "Ajustement",
  LOSS: "Perte",
  DAMAGE: "Casse",
  CANCELLATION: "Annulation",
};

export function DashboardPage() {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getStockSummary(controller.signal)
      .then((data) => {
        if (active) {
          setSummary(data);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Le tableau de bord est indisponible.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [retry]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Espace de gestion</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Vue d’ensemble
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Indicateurs calculés à partir du stock et des mouvements
            enregistrés.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/stock">Consulter l’état du stock</Link>
        </Button>
      </section>
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
            onClick={() => setRetry((value) => value + 1)}
          >
            <RotateCw size={15} />
            Réessayer
          </Button>
        </div>
      )}
      <section
        aria-label="Indicateurs principaux"
        aria-busy={!summary && !error}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label="Produits actifs"
          value={summary?.active_products}
          hint="Articles activés dans le catalogue."
          href="/app/stock"
        />
        <Metric
          label="Ruptures"
          value={summary?.out_of_stock}
          hint="Produits actifs sans quantité disponible."
          href="/app/stock?status=OUT"
          status="danger"
        />
        <Metric
          label="Stock faible"
          value={summary?.low_stock}
          hint="Stock positif au seuil critique ou en dessous."
          href="/app/stock?status=LOW"
          status="warning"
        />
        <Metric
          label="Mouvements · 7 jours"
          value={summary?.movements_last_7_days}
          hint="Entrées et sorties enregistrées cette semaine."
          href="/app/stock"
        />
      </section>
      <section aria-label="Mouvements récents">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold">Mouvements récents</h3>
          <span className="text-sm text-muted-foreground">
            8 derniers mouvements
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[650px] text-left text-sm">
            <caption className="sr-only">
              Les huit derniers mouvements de stock.
            </caption>
            <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Opération</th>
                <th className="px-4 py-3 text-right">Quantité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!summary ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Chargement des mouvements…
                  </td>
                </tr>
              ) : summary.recent_movements.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              ) : (
                summary.recent_movements.map((movement) => {
                  const entry = movement.direction === "IN";
                  const Icon = entry ? ArrowDownLeft : ArrowUpRight;
                  return (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {dateFormat.format(new Date(movement.created_at))}
                      </td>
                      <th className="px-4 py-3 font-medium">
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          to={`/app/stock/${movement.product_id}`}
                        >
                          {movement.product_name}
                          <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">
                            {movement.sku}
                          </span>
                        </Link>
                      </th>
                      <td className="px-4 py-3">
                        {operationLabels[movement.operation_type] ||
                          movement.operation_type}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${entry ? "text-success" : ""}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Icon size={14} />
                          {entry ? "+" : "−"}
                          {quantityFormat.format(
                            Number(movement.base_quantity),
                          )}{" "}
                          {movement.unit_symbol}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  href,
  status = "default",
}: {
  label: string;
  value?: number;
  hint: string;
  href: string;
  status?: "default" | "warning" | "danger";
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardDescription className="font-medium text-card-foreground">
          {label}
        </CardDescription>
        <CardTitle
          className={`text-3xl tabular-nums ${status === "warning" ? "text-warning" : status === "danger" ? "text-destructive" : "text-foreground"}`}
        >
          {value === undefined ? "—" : value.toLocaleString("fr-FR")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
        <Button asChild size="sm" variant="ghost">
          <Link to={href}>Voir</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
