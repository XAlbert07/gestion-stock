import { formatFcfaUnitPrice } from "@/lib/money";
import { type SaleItem } from "@/features/sales/sales-api";

const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

export function SaleItemRow({ item }: { item: SaleItem }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-3 font-medium">
        {item.product_name}
      </th>
      <td className="px-4 py-3 text-right tabular-nums">
        {quantityFormat.format(Number(item.quantity))} {(item as any).unit_symbol || ""}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatFcfaUnitPrice(item.unit_price)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatFcfaUnitPrice(item.line_total)}
      </td>
    </tr>
  );
}
