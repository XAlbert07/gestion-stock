import { Badge } from "@/components/ui/badge";
import { type SaleStatus } from "@/features/sales/sales-api";

export function SaleStatus({ status }: { status: SaleStatus }) {
  if (status === "COMPLETED") return <Badge variant="success">Validée</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Annulée</Badge>;
  return <Badge variant="warning">Brouillon</Badge>;
}
