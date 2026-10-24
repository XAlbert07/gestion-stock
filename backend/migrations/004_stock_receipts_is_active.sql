-- Le code de liste des réceptions filtre sur stock_receipts.is_active,
-- mais aucune migration ne créait cette colonne (erreur 500 sur GET /api/receipts
-- avec une base construite uniquement à partir des migrations).
-- IF NOT EXISTS : sans effet sur une base qui possède déjà la colonne.
ALTER TABLE public.stock_receipts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
