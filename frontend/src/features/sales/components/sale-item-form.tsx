import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addSaleItem } from "@/features/sales/sales-api";

const quantityFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

export function SaleItemForm({
  saleId,
  products,
  token,
  disabled,
  onAdded,
}: {
  saleId: string;
  products: any[];
  token: string | null;
  disabled: boolean;
  onAdded: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedProduct = Array.isArray(products) ? products.find((product) => String(product.id) === productId) : undefined;
  const units = selectedProduct?.units || [];

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("Votre session a expiré. Reconnectez-vous pour modifier ce brouillon.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await addSaleItem(token, saleId, { product_id: productId, unit_id: unitId, quantity: quantity.trim() });
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
        <CardTitle>Ajouter un article</CardTitle>
        <CardDescription>Sélectionnez un produit et une unité disponible. Le prix est déterminé par le catalogue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px_160px_auto]" onSubmit={handleAdd}>
          <div className="space-y-2">
            <label htmlFor="sale-product" className="text-sm font-medium">Produit</label>
            <select
              id="sale-product"
              required
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                const product = (Array.isArray(products) ? products : []).find((item: any) => String(item.id) === event.target.value);
                const unitsArr = Array.isArray(product?.units) ? (product.units as any[]) : [];
                const defaultUnit = unitsArr.find((unit: any) => unit.is_default_sale_unit) || unitsArr[0];
                setUnitId(defaultUnit ? String(defaultUnit.id) : "");
              }}
              disabled={disabled || submitting}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>Sélectionner un produit</option>
              {(Array.isArray(products) ? products : []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.sku ? `(${product.sku})` : ""} — stock {quantityFormat.format(Number(product.current_stock || 0))}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="sale-unit" className="text-sm font-medium">Unité</label>
            <select
              id="sale-unit"
              required
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              disabled={disabled || submitting || !productId || (Array.isArray(units) ? units.length === 0 : true)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>Sélectionner une unité</option>
              {Array.isArray(units)
                ? ((units as unknown[]) as Array<{ id: string | number; name: string; symbol?: string }>).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} {unit.symbol ? `(${unit.symbol})` : ""}
                    </option>
                  ))
                : null}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="sale-quantity" className="text-sm font-medium">Quantité</label>
            <Input id="sale-quantity" required type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={disabled || submitting || !unitId} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={disabled || submitting || !productId || !unitId}>
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
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
