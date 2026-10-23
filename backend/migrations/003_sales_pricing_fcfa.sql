ALTER TABLE public.sales
  ADD COLUMN customer_type_id bigint;

ALTER TABLE public.sales
  ADD CONSTRAINT fk_sales_customer_type
  FOREIGN KEY (customer_type_id) REFERENCES public.customer_types(id);

