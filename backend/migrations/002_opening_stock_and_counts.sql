ALTER TABLE public.stock_operations
  DROP CONSTRAINT chk_stock_operations_type;

ALTER TABLE public.stock_operations
  ADD CONSTRAINT chk_stock_operations_type
  CHECK (operation_type IN ('RECEIPT', 'SALE', 'RETURN', 'LOSS', 'DAMAGE', 'ADJUSTMENT', 'CANCELLATION', 'OPENING_BALANCE'));

ALTER TABLE public.stock_adjustments
  ADD COLUMN adjustment_type character varying(30) NOT NULL DEFAULT 'COUNT',
  ADD COLUMN counted_quantity numeric(14,3),
  ADD COLUMN unit_cost numeric(14,2),
  ADD CONSTRAINT chk_stock_adjustments_type CHECK (adjustment_type IN ('COUNT', 'OPENING_STOCK')),
  ADD CONSTRAINT chk_stock_adjustments_counted_quantity CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
  ADD CONSTRAINT chk_stock_adjustments_unit_cost CHECK (unit_cost IS NULL OR unit_cost >= 0);
