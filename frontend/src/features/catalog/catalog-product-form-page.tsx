import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCatalogReferences,
  getProduct,
  createProduct,
  updateProduct,
  type CatalogCategory,
  type CatalogUnit,
  type CatalogProduct,
} from "@/features/catalog/catalog-api";

type FormState = {
  name: string;
  sku: string;
  category_id: string;
  base_unit_id: string;
  description: string;
  critical_threshold: string;
  is_active: boolean;
};
const emptyForm: FormState = {
  name: "",
  sku: "",
  category_id: "",
  base_unit_id: "",
  description: "",
  critical_threshold: "0",
  is_active: true,
};

export function CatalogProductFormPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(productId);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getCatalogReferences(controller.signal),
      editing
        ? getProduct(productId!, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([references, product]) => {
        setCategories(references.categories);
        setUnits(references.units);
        if (product) setForm(toForm(product));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Impossible de charger le formulaire.",
        ),
      )
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [editing, productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category_id: Number(form.category_id),
        base_unit_id: Number(form.base_unit_id),
        description: form.description,
        critical_threshold: form.critical_threshold,
      };
      if (editing)
        await updateProduct(productId!, {
          ...payload,
          is_active: form.is_active,
        });
      else await createProduct(payload);
      navigate("/app/catalogue", { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Le produit ne peut pas être enregistré.",
      );
    } finally {
      setSaving(false);
    }
  }

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/app/catalogue"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          ← Retour au catalogue
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          Gestion des articles
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          {editing ? "Modifier le produit" : "Nouveau produit"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Le stock initial se saisit dans le parcours dédié afin de conserver
          son coût et son historique.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle size={17} />
          {error}
        </div>
      )}
      {!loading &&
        !error &&
        (categories.length === 0 || units.length === 0) && (
          <div
            role="status"
            className="rounded-md bg-warning/10 px-4 py-3 text-sm"
          >
            <p className="font-medium">
              Le catalogue doit être configuré avant d’enregistrer un produit.
            </p>
            <p className="mt-1 text-muted-foreground">
              Ajoutez au moins une catégorie et une unité de mesure.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/app/catalogue/referentiels">
                Gérer les catégories et unités
              </Link>
            </Button>
          </div>
        )}
      {loading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" size={18} />
          Chargement…
        </p>
      ) : (
        <form
          className="space-y-5 rounded-lg border bg-card p-5"
          onSubmit={submit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du produit" id="product-name">
              <Input
                id="product-name"
                required
                maxLength={150}
                value={form.name}
                onChange={(event) => change("name", event.target.value)}
              />
            </Field>
            <Field label="Référence SKU" id="product-sku">
              <Input
                id="product-sku"
                required
                maxLength={100}
                value={form.sku}
                onChange={(event) => change("sku", event.target.value)}
              />
            </Field>
            <Field label="Catégorie" id="product-category">
              <select
                id="product-category"
                required
                className={selectClass}
                value={form.category_id}
                onChange={(event) => change("category_id", event.target.value)}
              >
                <option value="">Choisir une catégorie</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unité de base" id="product-unit">
              <select
                id="product-unit"
                required
                className={selectClass}
                value={form.base_unit_id}
                onChange={(event) => change("base_unit_id", event.target.value)}
              >
                <option value="">Choisir une unité</option>
                {units.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.symbol})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seuil d'alerte (quantité)" id="product-threshold">
              <Input
                id="product-threshold"
                required
                type="number"
                min="0"
                step="0.001"
                value={form.critical_threshold}
                onChange={(event) =>
                  change("critical_threshold", event.target.value)
                }
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.is_active}
                onChange={(event) => change("is_active", event.target.checked)}
              />
              Produit actif pour{" "}
              {editing ? "les opérations" : "les ventes et réceptions"}
            </label>
          </div>
          <Field label="Description (facultative)" id="product-description">
            <textarea
              id="product-description"
              rows={4}
              maxLength={5000}
              className={`${selectClass} h-auto py-2`}
              value={form.description}
              onChange={(event) => change("description", event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button asChild variant="outline">
              <Link to="/app/catalogue">Annuler</Link>
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                loading ||
                categories.length === 0 ||
                units.length === 0
              }
            >
              {saving && <LoaderCircle className="animate-spin" size={16} />}
              {saving ? "Enregistrement…" : "Enregistrer le produit"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
function toForm(product: CatalogProduct): FormState {
  return {
    name: product.name,
    sku: product.sku,
    category_id: String(product.category_id),
    base_unit_id: String(product.base_unit_id),
    description: product.description || "",
    critical_threshold: String(product.critical_threshold),
    is_active: product.is_active,
  };
}
