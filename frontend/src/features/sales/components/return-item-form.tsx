import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addSaleReturnItem, type SaleItem, type SaleReturnItem } from "@/features/sales/sales-api";

const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

export function ReturnItemForm({
  returnId,
  saleItems,
  currentItems,
  unitLabels,
  token,
  disabled,
  onAdded,
}: {
  returnId: string;
  saleItems: SaleItem[];
  currentItems: SaleReturnItem[];
  unitLabels: Map<string, string>;
  token: string | null;
  disabled: boolean;
  onAdded: () => void;
}) {
  const [saleItemId, setSaleItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const alreadyInDraft = new Set(currentItems.map((item) => String(item.sale_item_id)));
  const selectableItems = saleItems.filter((item) => !alreadyInDraft.has(String(item.id)));
  const selectedSaleItem = saleItems.find((item) => String(item.id) === saleItemId);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("Votre session a expiré. Reconnectez-vous pour modifier ce retour.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await addSaleReturnItem(token, returnId, {
        sale_item_id: saleItemId,
        quantity: quantity.trim(),
      });
      setQuantity("1");
      onAdded();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "La ligne n’a pas pu être ajoutée.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter un article retourné</CardTitle>
        <CardDescription>
          Choisissez une ligne de la vente. Le serveur vérifie la quantité encore retournable, y compris les retours antérieurs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleAdd}>
          <div className="space-y-2">
            <label htmlFor="return-sale-item" className="text-sm font-medium">
              Article de la vente d’origine
            </label>
            <select
              id="return-sale-item"
              required
              value={saleItemId}
              onChange={(event) => setSaleItemId(event.target.value)}
              disabled={disabled || submitting || selectableItems.length === 0}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">
                {selectableItems.length ? "Sélectionner une ligne vendue" : "Aucune ligne disponible dans ce brouillon"}
              </option>
              {selectableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.product_name} · {quantityFormat.format(Number(item.quantity))}{" "}
                  {unitLabels.get(String(item.unit_id)) || ""} vendus
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="return-quantity" className="text-sm font-medium">
              Quantité à retourner
            </label>
            <Input
              id="return-quantity"
              required
              type="number"
              min="0.001"
              max={selectedSaleItem?.quantity}
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={disabled || submitting || !saleItemId}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={disabled || submitting || !saleItemId}>
              {submitting ? (
                <>
                  <LoaderCircle className="animate-spin" size={17} />
                  Ajout…
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Ajouter
                </>
              )}
            </Button>
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-3">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
