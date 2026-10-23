--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customer_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_types (
    id bigint NOT NULL,
    name character varying(50) NOT NULL
);


--
-- Name: customer_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.customer_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.customer_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id bigint NOT NULL,
    customer_type_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    phone character varying(30),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.customers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_prices (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    customer_type_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    price numeric(14,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_product_prices_price CHECK ((price >= (0)::numeric))
);


--
-- Name: product_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.product_prices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.product_prices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_units (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    conversion_factor numeric(14,3) NOT NULL,
    is_default_sale_unit boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_product_units_conversion CHECK ((conversion_factor > (0)::numeric))
);


--
-- Name: product_units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.product_units ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.product_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    category_id bigint NOT NULL,
    base_unit_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    sku character varying(100) NOT NULL,
    description text,
    current_stock numeric(14,3) DEFAULT 0 NOT NULL,
    average_cost numeric(14,2) DEFAULT 0 NOT NULL,
    critical_threshold numeric(14,3) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_products_average_cost CHECK ((average_cost >= (0)::numeric)),
    CONSTRAINT chk_products_critical_threshold CHECK ((critical_threshold >= (0)::numeric)),
    CONSTRAINT chk_products_stock CHECK ((current_stock >= (0)::numeric))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.products ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    name character varying(50) NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id bigint NOT NULL,
    sale_id bigint NOT NULL,
    product_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    quantity numeric(14,3) NOT NULL,
    conversion_factor numeric(14,3) NOT NULL,
    base_quantity numeric(14,3) GENERATED ALWAYS AS ((quantity * conversion_factor)) STORED,
    unit_price numeric(14,2) NOT NULL,
    line_total numeric(14,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED,
    cost_at_sale numeric(14,2) NOT NULL,
    CONSTRAINT chk_sale_items_conversion CHECK ((conversion_factor > (0)::numeric)),
    CONSTRAINT chk_sale_items_cost CHECK ((cost_at_sale >= (0)::numeric)),
    CONSTRAINT chk_sale_items_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT chk_sale_items_quantity CHECK ((quantity > (0)::numeric))
);


--
-- Name: sale_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sale_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sale_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id bigint NOT NULL,
    operation_id bigint,
    customer_id bigint,
    reference character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    sold_at timestamp with time zone,
    created_by bigint NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_sales_completed_date CHECK ((((status)::text = 'DRAFT'::text) OR (sold_at IS NOT NULL))),
    CONSTRAINT chk_sales_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT chk_sales_total CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sales ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return_items (
    id bigint NOT NULL,
    return_id bigint NOT NULL,
    sale_item_id bigint NOT NULL,
    product_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    quantity numeric(14,3) NOT NULL,
    conversion_factor numeric(14,3) NOT NULL,
    base_quantity numeric(14,3) GENERATED ALWAYS AS ((quantity * conversion_factor)) STORED,
    unit_price numeric(14,2) NOT NULL,
    cost_at_return numeric(14,2) NOT NULL,
    CONSTRAINT chk_sales_return_items_conversion CHECK ((conversion_factor > (0)::numeric)),
    CONSTRAINT chk_sales_return_items_cost CHECK ((cost_at_return >= (0)::numeric)),
    CONSTRAINT chk_sales_return_items_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT chk_sales_return_items_quantity CHECK ((quantity > (0)::numeric))
);


--
-- Name: sales_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sales_return_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sales_return_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_returns (
    id bigint NOT NULL,
    operation_id bigint,
    sale_id bigint NOT NULL,
    reference character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    returned_at timestamp with time zone,
    created_by bigint NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_sales_returns_completed_date CHECK ((((status)::text = 'DRAFT'::text) OR (returned_at IS NOT NULL))),
    CONSTRAINT chk_sales_returns_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: sales_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sales_returns ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sales_returns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id bigint NOT NULL,
    operation_id bigint NOT NULL,
    reason text NOT NULL,
    counted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint NOT NULL
);


--
-- Name: stock_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_adjustments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_adjustments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    operation_item_id bigint NOT NULL,
    product_id bigint NOT NULL,
    direction character varying(3) NOT NULL,
    base_quantity numeric(14,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_stock_movements_direction CHECK (((direction)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying])::text[]))),
    CONSTRAINT chk_stock_movements_quantity CHECK ((base_quantity > (0)::numeric))
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_operation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_operation_items (
    id bigint NOT NULL,
    operation_id bigint NOT NULL,
    product_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    direction character varying(3) NOT NULL,
    quantity numeric(14,3) NOT NULL,
    conversion_factor numeric(14,3) NOT NULL,
    base_quantity numeric(14,3) GENERATED ALWAYS AS ((quantity * conversion_factor)) STORED,
    CONSTRAINT chk_stock_operation_items_conversion CHECK ((conversion_factor > (0)::numeric)),
    CONSTRAINT chk_stock_operation_items_direction CHECK (((direction)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying])::text[]))),
    CONSTRAINT chk_stock_operation_items_quantity CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_operation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_operation_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_operation_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_operations (
    id bigint NOT NULL,
    operation_type character varying(30) NOT NULL,
    reversal_of_operation_id bigint,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT chk_stock_operations_cancellation_reference CHECK (((((operation_type)::text = 'CANCELLATION'::text) AND (reversal_of_operation_id IS NOT NULL)) OR (((operation_type)::text <> 'CANCELLATION'::text) AND (reversal_of_operation_id IS NULL)))),
    CONSTRAINT chk_stock_operations_type CHECK (((operation_type)::text = ANY ((ARRAY['RECEIPT'::character varying, 'SALE'::character varying, 'RETURN'::character varying, 'LOSS'::character varying, 'DAMAGE'::character varying, 'ADJUSTMENT'::character varying, 'CANCELLATION'::character varying])::text[])))
);


--
-- Name: stock_operations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_operations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_operations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_receipt_items (
    id bigint NOT NULL,
    receipt_id bigint NOT NULL,
    product_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    quantity numeric(14,3) NOT NULL,
    conversion_factor numeric(14,3) NOT NULL,
    base_quantity numeric(14,3) GENERATED ALWAYS AS ((quantity * conversion_factor)) STORED,
    unit_purchase_price numeric(14,2) NOT NULL,
    CONSTRAINT chk_stock_receipt_items_conversion CHECK ((conversion_factor > (0)::numeric)),
    CONSTRAINT chk_stock_receipt_items_purchase_price CHECK ((unit_purchase_price >= (0)::numeric)),
    CONSTRAINT chk_stock_receipt_items_quantity CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_receipt_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_receipt_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_receipts (
    id bigint NOT NULL,
    operation_id bigint,
    supplier_id bigint NOT NULL,
    reference character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    received_at timestamp with time zone,
    created_by bigint NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_stock_receipts_completed_date CHECK ((((status)::text = 'DRAFT'::text) OR (received_at IS NOT NULL))),
    CONSTRAINT chk_stock_receipts_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: stock_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stock_receipts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_receipts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: supplier_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_products (
    supplier_id bigint NOT NULL,
    product_id bigint NOT NULL,
    supplier_reference character varying(100),
    last_purchase_price numeric(14,2),
    is_preferred boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_supplier_products_last_price CHECK (((last_purchase_price IS NULL) OR (last_purchase_price >= (0)::numeric)))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    phone character varying(30),
    email character varying(255),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.suppliers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id bigint NOT NULL,
    name character varying(50) NOT NULL,
    symbol character varying(20) NOT NULL
);


--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.units ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customer_types customer_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_types
    ADD CONSTRAINT customer_types_name_key UNIQUE (name);


--
-- Name: customer_types customer_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_types
    ADD CONSTRAINT customer_types_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: product_prices product_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT product_prices_pkey PRIMARY KEY (id);


--
-- Name: product_units product_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT product_units_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_operation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_operation_id_key UNIQUE (operation_id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales sales_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_reference_key UNIQUE (reference);


--
-- Name: sales_return_items sales_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_operation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_operation_id_key UNIQUE (operation_id);


--
-- Name: sales_returns sales_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_reference_key UNIQUE (reference);


--
-- Name: stock_adjustments stock_adjustments_operation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_operation_id_key UNIQUE (operation_id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_operation_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_operation_item_id_key UNIQUE (operation_item_id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_operation_items stock_operation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operation_items
    ADD CONSTRAINT stock_operation_items_pkey PRIMARY KEY (id);


--
-- Name: stock_operations stock_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operations
    ADD CONSTRAINT stock_operations_pkey PRIMARY KEY (id);


--
-- Name: stock_receipt_items stock_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT stock_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: stock_receipts stock_receipts_operation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_operation_id_key UNIQUE (operation_id);


--
-- Name: stock_receipts stock_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_pkey PRIMARY KEY (id);


--
-- Name: stock_receipts stock_receipts_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_reference_key UNIQUE (reference);


--
-- Name: supplier_products supplier_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_products
    ADD CONSTRAINT supplier_products_pkey PRIMARY KEY (supplier_id, product_id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: units units_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_name_key UNIQUE (name);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: units units_symbol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_symbol_key UNIQUE (symbol);


--
-- Name: product_units uq_product_units_product_unit; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT uq_product_units_product_unit UNIQUE (product_id, unit_id);


--
-- Name: products uq_products_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT uq_products_name UNIQUE (name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_product_prices_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_prices_lookup ON public.product_prices USING btree (product_id, customer_type_id, unit_id) WHERE (is_active = true);


--
-- Name: idx_product_prices_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_prices_product_id ON public.product_prices USING btree (product_id);


--
-- Name: idx_product_units_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_units_product_id ON public.product_units USING btree (product_id);


--
-- Name: idx_products_base_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_base_unit_id ON public.products USING btree (base_unit_id);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_sale_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_product_id ON public.sale_items USING btree (product_id);


--
-- Name: idx_sales_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id);


--
-- Name: idx_sales_return_items_sale_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_return_items_sale_item_id ON public.sales_return_items USING btree (sale_item_id);


--
-- Name: idx_sales_return_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_return_sale_id ON public.sales_returns USING btree (sale_id);


--
-- Name: idx_sales_sold_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_sold_at ON public.sales USING btree (sold_at);


--
-- Name: idx_stock_movements_product_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_product_created_at ON public.stock_movements USING btree (product_id, created_at);


--
-- Name: idx_stock_operations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_operations_created_at ON public.stock_operations USING btree (created_at);


--
-- Name: idx_stock_operations_product_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_operations_product_lookup ON public.stock_operation_items USING btree (product_id);


--
-- Name: idx_stock_receipt_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_receipt_items_product_id ON public.stock_receipt_items USING btree (product_id);


--
-- Name: idx_stock_receipts_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_receipts_supplier_id ON public.stock_receipts USING btree (supplier_id);


--
-- Name: idx_supplier_products_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_products_product_id ON public.supplier_products USING btree (product_id);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- Name: uq_product_prices_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_prices_active ON public.product_prices USING btree (product_id, customer_type_id, unit_id) WHERE (is_active = true);


--
-- Name: customers trg_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_prices trg_product_prices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_prices_updated_at BEFORE UPDATE ON public.product_prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: suppliers trg_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers fk_customers_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_type FOREIGN KEY (customer_type_id) REFERENCES public.customer_types(id);


--
-- Name: product_prices fk_product_prices_customer_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT fk_product_prices_customer_type FOREIGN KEY (customer_type_id) REFERENCES public.customer_types(id);


--
-- Name: product_prices fk_product_prices_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT fk_product_prices_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_prices fk_product_prices_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT fk_product_prices_unit FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: product_units fk_product_units_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT fk_product_units_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_units fk_product_units_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT fk_product_units_unit FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: products fk_products_base_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_base_unit FOREIGN KEY (base_unit_id) REFERENCES public.units(id);


--
-- Name: products fk_products_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: sale_items fk_sale_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sale_items fk_sale_items_sale; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: sale_items fk_sale_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT fk_sale_items_unit FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: sales fk_sales_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales fk_sales_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales fk_sales_operation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_operation FOREIGN KEY (operation_id) REFERENCES public.stock_operations(id);


--
-- Name: sales_return_items fk_sales_return_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_items_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales_return_items fk_sales_return_items_return; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_items_return FOREIGN KEY (return_id) REFERENCES public.sales_returns(id);


--
-- Name: sales_return_items fk_sales_return_items_sale_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_items_sale_item FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id);


--
-- Name: sales_return_items fk_sales_return_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_items_unit FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: sales_returns fk_sales_returns_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_returns_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales_returns fk_sales_returns_operation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_returns_operation FOREIGN KEY (operation_id) REFERENCES public.stock_operations(id);


--
-- Name: sales_returns fk_sales_returns_sale; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_returns_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: stock_adjustments fk_stock_adjustments_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT fk_stock_adjustments_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_adjustments fk_stock_adjustments_operation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT fk_stock_adjustments_operation FOREIGN KEY (operation_id) REFERENCES public.stock_operations(id);


--
-- Name: stock_movements fk_stock_movements_operation_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_operation_item FOREIGN KEY (operation_item_id) REFERENCES public.stock_operation_items(id);


--
-- Name: stock_movements fk_stock_movements_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_operation_items fk_stock_operation_items_operation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operation_items
    ADD CONSTRAINT fk_stock_operation_items_operation FOREIGN KEY (operation_id) REFERENCES public.stock_operations(id);


--
-- Name: stock_operation_items fk_stock_operation_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operation_items
    ADD CONSTRAINT fk_stock_operation_items_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_operation_items fk_stock_operation_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operation_items
    ADD CONSTRAINT fk_stock_operation_items_unit FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: stock_operations fk_stock_operations_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operations
    ADD CONSTRAINT fk_stock_operations_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_operations fk_stock_operations_reversal; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_operations
    ADD CONSTRAINT fk_stock_operations_reversal FOREIGN KEY (reversal_of_operation_id) REFERENCES public.stock_operations(id);


--
-- Name: stock_receipt_items fk_stock_receipt_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT fk_stock_receipt_items_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_receipt_items fk_stock_receipt_items_receipt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT fk_stock_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES public.stock_receipts(id);


--
-- Name: stock_receipt_items fk_stock_receipt_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT fk_stock_receipt_items_unit FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: stock_receipts fk_stock_receipts_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT fk_stock_receipts_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_receipts fk_stock_receipts_operation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT fk_stock_receipts_operation FOREIGN KEY (operation_id) REFERENCES public.stock_operations(id);


--
-- Name: stock_receipts fk_stock_receipts_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT fk_stock_receipts_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: supplier_products fk_supplier_products_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_products
    ADD CONSTRAINT fk_supplier_products_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: supplier_products fk_supplier_products_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_products
    ADD CONSTRAINT fk_supplier_products_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: users fk_users_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--


