import { formatFcfaUnitPrice } from "@/lib/money";
import { type SaleReturnItem } from "@/features/sales/sales-api";

const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

export function ReturnItemRow({
  item,
  unitSymbol,
}: {
  item: SaleReturnItem;
  unitSymbol: string;
}) {
  return (
    <tr>
      <th scope="row" className="px-4 py-3 font-medium">
        {item.product_name}
      </th>
      <td className="px-4 py-3 text-right tabular-nums">
        {quantityFormat.format(Number(item.quantity))} {unitSymbol}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatFcfaUnitPrice(item.unit_price)}
      </td>
    </tr>
  );
}

export function ReturnStatus({ status: _status }: { status: any }) {
  void _status;
  return null;
}
