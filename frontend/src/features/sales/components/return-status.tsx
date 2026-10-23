import { Badge } from "@/components/ui/badge";
import { type SaleStatus } from "@/features/sales/sales-api";

export function ReturnStatus({ status }: { status: SaleStatus }) {
  if (status === "COMPLETED") return <Badge variant="success">Validé</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Annulé</Badge>;
  return <Badge variant="warning">Brouillon</Badge>;
}
