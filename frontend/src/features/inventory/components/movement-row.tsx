import { Badge } from "@/components/ui/badge";
import { type StockMovement } from "@/features/inventory/inventory-api";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

function MovementTypeBadge({ type }: { type: StockMovement["operation_type"] }) {
  if (type === "RECEIPT") return <Badge variant="success">Réception</Badge>;
  if (type === "SALE") return <Badge variant="warning">Vente</Badge>;
  if (type === "RETURN") return <Badge variant="success">Retour</Badge>;
  if (type === "LOSS") return <Badge variant="destructive">Perte</Badge>;
  if (type === "DAMAGE") return <Badge variant="destructive">Détérioration</Badge>;
  if (type === "ADJUSTMENT") return <Badge variant="outline">Ajustement</Badge>;
  if (type === "CANCELLATION") return <Badge variant="outline">Annulation</Badge>;
  if (type === "OPENING_BALANCE") return <Badge variant="outline">Solde initial</Badge>;
  return <Badge variant="outline">{type}</Badge>;
}

export function MovementRow({ movement }: { movement: StockMovement }) {
  const date = movement.created_at;
  const qty = Number(movement.base_quantity || 0);
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{dateFormat.format(new Date(date))}</td>
      <td className="px-4 py-3">
        <MovementTypeBadge type={movement.operation_type} />
      </td>
      <td className="px-4 py-3">{movement.product_name || "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">—</td>
      <td className="px-4 py-3 text-right tabular-nums">{qty >= 0 ? `+${quantityFormat.format(qty)}` : quantityFormat.format(qty)}</td>
      <td className="px-4 py-3 text-right tabular-nums">—</td>
    </tr>
  );
}
