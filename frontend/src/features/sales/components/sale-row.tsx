import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatFcfaUnitPrice } from "@/lib/money";
import { type Sale } from "@/features/sales/sales-api";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Ouagadougou",
});

export function SaleRow({ sale }: { sale: Sale }) {
  const eventDate = sale.status === "COMPLETED" ? sale.sold_at : sale.created_at;
  return (
    <tr>
      <th scope="row" className="px-4 py-3 font-medium">
        <Link className="text-primary underline-offset-4 hover:underline" to={`/app/ventes/${sale.id}`}>
          {sale.reference}
        </Link>
      </th>
      <td className="px-4 py-3">{sale.customer_name || "Client non renseigné"}</td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {dateFormat.format(new Date(eventDate || sale.created_at))}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatFcfaUnitPrice(sale.total_amount || 0)}</td>
      <td className="px-4 py-3">
        {sale.status === "COMPLETED" ? (
          <Badge variant="success">Validée</Badge>
        ) : sale.status === "CANCELLED" ? (
          <Badge variant="outline">Annulée</Badge>
        ) : (
          <Badge variant="warning">Brouillon</Badge>
        )}
      </td>
    </tr>
  );
}
