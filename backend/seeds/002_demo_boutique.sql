-- =====================================================================
-- Données de démonstration : boutique générale (montants en FCFA)
--
-- Prérequis : tables métier vides et au moins un utilisateur existant
-- (les opérations sont attribuées au premier utilisateur).
-- Lancé par scripts/seed-demo.js, qui vérifie ces conditions.
--
-- Le fichier simule 35 jours d'activité en appliquant la même logique
-- que l'application : coût moyen pondéré à la réception, stock mis à
-- jour à chaque opération, un mouvement par ligne. Les dates sont
-- relatives à l'exécution : la démo paraît toujours récente.
-- Le tirage aléatoire est initialisé (setseed) : résultat reproductible.
-- =====================================================================

SELECT setseed(0.2026);

-- ---------------------------------------------------------------------
-- 1. Référentiels
-- ---------------------------------------------------------------------
INSERT INTO categories (name, description) VALUES
  ('Boissons', 'Eaux, jus et boissons gazeuses'),
  ('Épicerie', 'Produits alimentaires de base'),
  ('Hygiène & beauté', 'Soins du corps et hygiène'),
  ('Entretien ménager', 'Produits de nettoyage'),
  ('Fournitures', 'Papeterie et fournitures scolaires');

INSERT INTO units (name, symbol) VALUES
  ('Unité', 'u'),
  ('Bouteille', 'bt'),
  ('Paquet', 'pqt'),
  ('Sachet', 'sch'),
  ('Kilogramme', 'kg'),
  ('Carton', 'ctn'),
  ('Sac', 'sac'),
  ('Boîte', 'bte');

INSERT INTO customer_types (name) VALUES ('Particulier'), ('Revendeur');

INSERT INTO suppliers (name, phone, email, address) VALUES
  ('Sahel Boissons', '70 00 00 11', 'commandes@sahel-boissons.example', 'Zone industrielle, entrepôt 4'),
  ('Comptoir Général d''Alimentation', '70 00 00 22', 'ventes@comptoir-general.example', 'Marché central, bloc B'),
  ('Riz & Céréales Diallo', '70 00 00 33', 'contact@riz-diallo.example', 'Quartier des grossistes, lot 18'),
  ('Étoile Hygiène & Entretien', '70 00 00 44', 'pro@etoile-hygiene.example', 'Avenue du Commerce, n° 52'),
  ('Papeterie Moderne', '70 00 00 55', 'info@papeterie-moderne.example', 'Rue des Écoles, n° 7');

INSERT INTO customers (customer_type_id, name, phone, address)
SELECT t.id, v.name, v.phone, v.address
FROM (VALUES
  ('Revendeur',   'Alimentation Le Bonheur',   '70 10 20 01', 'Quartier Nord, rue 12'),
  ('Revendeur',   'Restaurant Le Sahel',       '70 10 20 02', 'Avenue principale, n° 3'),
  ('Revendeur',   'Maquis Chez Awa',           '70 10 20 03', 'Quartier Est, carrefour'),
  ('Revendeur',   'École Les Cèdres (cantine)', '70 10 20 04', 'Quartier des Écoles'),
  ('Revendeur',   'Kiosque Naaba',             '70 10 20 05', 'Marché de quartier, étal 12'),
  ('Revendeur',   'Boutique Wend-Panga',       '70 10 20 06', 'Quartier Sud, rue 8'),
  ('Particulier', 'Fatou Diallo',              '70 20 30 01', 'Quartier Nord'),
  ('Particulier', 'Ibrahim Traoré',            '70 20 30 02', 'Quartier Est'),
  ('Particulier', 'Aminata Koné',              '70 20 30 03', 'Quartier Sud'),
  ('Particulier', 'Moussa Sow',                '70 20 30 04', 'Centre-ville'),
  ('Particulier', 'Mariam Camara',             '70 20 30 05', 'Quartier Ouest'),
  ('Particulier', 'Paul Ndiaye',               '70 20 30 06', 'Quartier Nord')
) AS v(type_name, name, phone, address)
JOIN customer_types t ON t.name = v.type_name;

-- ---------------------------------------------------------------------
-- 2. Catalogue (table temporaire servant aussi à la simulation)
--    cost  = coût d'achat par unité de base
--    price = prix de vente Particulier par unité de base
--    alt_* = conditionnement supérieur (carton, sac...) ; popularity = poids des ventes
-- ---------------------------------------------------------------------
CREATE TEMP TABLE demo_catalog (
  sku text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  base_unit text NOT NULL,
  threshold numeric NOT NULL,
  cost numeric NOT NULL,
  price numeric NOT NULL,
  alt_unit text,
  alt_factor numeric,
  supplier text NOT NULL,
  popularity int NOT NULL,
  restock boolean NOT NULL DEFAULT true
);

INSERT INTO demo_catalog
  (sku, name, category, base_unit, threshold, cost, price, alt_unit, alt_factor, supplier, popularity, restock)
VALUES
  ('BOI-EAU-150', 'Eau minérale 1,5 L',           'Boissons', 'bt', 24, 280, 400, 'ctn', 6,  'Sahel Boissons', 10, true),
  ('BOI-EAU-050', 'Eau minérale 50 cl',           'Boissons', 'bt', 48, 120, 200, 'ctn', 12, 'Sahel Boissons', 9,  true),
  ('BOI-GAZ-COL', 'Boisson gazeuse cola 33 cl',   'Boissons', 'bt', 48, 220, 350, 'ctn', 24, 'Sahel Boissons', 8,  true),
  ('BOI-GAZ-ORA', 'Boisson gazeuse orange 33 cl', 'Boissons', 'bt', 48, 220, 350, 'ctn', 24, 'Sahel Boissons', 7,  true),
  ('BOI-JUS-BIS', 'Jus de bissap 50 cl',          'Boissons', 'bt', 24, 250, 400, 'ctn', 12, 'Sahel Boissons', 5,  true),
  ('BOI-JUS-ORA', 'Jus d''orange 1 L',            'Boissons', 'u',  12, 600, 850, 'ctn', 12, 'Sahel Boissons', 4,  true),

  ('EPI-HUI-1L',  'Huile végétale 1 L',           'Épicerie', 'bt',  24, 1100, 1400, 'ctn', 12, 'Comptoir Général d''Alimentation', 8, true),
  ('EPI-HUI-5L',  'Huile végétale 5 L',           'Épicerie', 'u',   6,  5200, 6500, NULL, NULL, 'Comptoir Général d''Alimentation', 4, true),
  ('EPI-PAT-500', 'Spaghetti 500 g',              'Épicerie', 'pqt', 30, 380,  500,  'ctn', 20, 'Comptoir Général d''Alimentation', 7, true),
  ('EPI-TOM-070', 'Concentré de tomate 70 g',     'Épicerie', 'sch', 60, 120,  175,  'ctn', 50, 'Comptoir Général d''Alimentation', 8, true),
  ('EPI-CUB-ASS', 'Cubes d''assaisonnement',      'Épicerie', 'pqt', 40, 400,  500,  'ctn', 24, 'Comptoir Général d''Alimentation', 9, true),
  ('EPI-SEL-1KG', 'Sel fin 1 kg',                 'Épicerie', 'pqt', 20, 150,  250,  'ctn', 20, 'Comptoir Général d''Alimentation', 5, true),
  ('EPI-LAI-CON', 'Lait concentré sucré 400 g',   'Épicerie', 'u',   24, 700,  900,  'ctn', 24, 'Comptoir Général d''Alimentation', 6, true),
  ('EPI-LAI-POU', 'Lait en poudre 400 g',         'Épicerie', 'u',   12, 2300, 2800, 'ctn', 12, 'Comptoir Général d''Alimentation', 4, true),
  ('EPI-SAR-125', 'Sardines à l''huile 125 g',    'Épicerie', 'u',   36, 450,  600,  'ctn', 50, 'Comptoir Général d''Alimentation', 6, true),
  ('EPI-CAF-100', 'Café soluble 100 g',           'Épicerie', 'u',   12, 1200, 1600, 'ctn', 24, 'Comptoir Général d''Alimentation', 3, true),
  ('EPI-THE-VER', 'Thé vert 25 sachets',          'Épicerie', 'u',   12, 500,  750,  'ctn', 24, 'Comptoir Général d''Alimentation', 4, true),
  ('EPI-BIS-LAI', 'Biscuits au lait',             'Épicerie', 'pqt', 48, 150,  250,  'ctn', 48, 'Comptoir Général d''Alimentation', 7, true),

  ('EPI-RIZ-KG',  'Riz parfumé (au kg)',          'Épicerie', 'kg', 100, 480, 600, 'sac', 25, 'Riz & Céréales Diallo', 9, true),
  ('EPI-SUC-KG',  'Sucre en poudre (au kg)',      'Épicerie', 'kg', 75,  560, 700, 'sac', 50, 'Riz & Céréales Diallo', 7, true),
  ('EPI-FAR-KG',  'Farine de blé (au kg)',        'Épicerie', 'kg', 50,  420, 550, 'sac', 50, 'Riz & Céréales Diallo', 4, true),

  ('HYG-SAV-TOI', 'Savon de toilette',            'Hygiène & beauté', 'u',   48, 250,  400,  'ctn', 48, 'Étoile Hygiène & Entretien', 8, true),
  ('HYG-DEN-075', 'Dentifrice 75 ml',             'Hygiène & beauté', 'u',   24, 600,  900,  'ctn', 24, 'Étoile Hygiène & Entretien', 5, true),
  ('HYG-PAP-4RL', 'Papier hygiénique (4 rouleaux)', 'Hygiène & beauté', 'pqt', 24, 700, 1000, 'ctn', 12, 'Étoile Hygiène & Entretien', 6, true),
  ('HYG-LOT-250', 'Lotion corporelle 250 ml',     'Hygiène & beauté', 'bt',  12, 1400, 2000, 'ctn', 12, 'Étoile Hygiène & Entretien', 3, true),
  ('ENT-LES-1KG', 'Lessive en poudre 1 kg',       'Entretien ménager', 'pqt', 24, 1100, 1500, 'ctn', 10, 'Étoile Hygiène & Entretien', 6, true),
  ('ENT-JAV-1L',  'Eau de javel 1 L',             'Entretien ménager', 'bt',  24, 350,  500,  'ctn', 12, 'Étoile Hygiène & Entretien', 5, true),
  ('ENT-VAI-500', 'Liquide vaisselle 500 ml',     'Entretien ménager', 'bt',  18, 600,  850,  'ctn', 12, 'Étoile Hygiène & Entretien', 4, true),
  ('ENT-SAV-MEN', 'Savon de ménage (barre)',      'Entretien ménager', 'u',   60, 150,  250,  'ctn', 72, 'Étoile Hygiène & Entretien', 7, true),
  ('ENT-EPO-3',   'Éponge de cuisine (lot de 3)', 'Entretien ménager', 'pqt', 24, 250,  400,  'ctn', 40, 'Étoile Hygiène & Entretien', 3, true),

  ('FOU-CAH-096', 'Cahier 96 pages',              'Fournitures', 'u', 48,  250,  400,  'pqt', 10, 'Papeterie Moderne', 6, true),
  ('FOU-STY-BLE', 'Stylo à bille bleu',           'Fournitures', 'u', 100, 60,   100,  'bte', 50, 'Papeterie Moderne', 8, true),
  ('FOU-STY-NOI', 'Stylo à bille noir',           'Fournitures', 'u', 100, 60,   100,  'bte', 50, 'Papeterie Moderne', 4, true),
  ('FOU-CRA-HB',  'Crayon HB',                    'Fournitures', 'u', 100, 50,   100,  'bte', 12, 'Papeterie Moderne', 5, true),
  ('FOU-RAM-A4',  'Ramette papier A4',            'Fournitures', 'u', 10,  2600, 3500, 'ctn', 5,  'Papeterie Moderne', 3, true);

INSERT INTO products (category_id, base_unit_id, name, sku, description, critical_threshold)
SELECT c.id, u.id, dc.name, dc.sku, NULL, dc.threshold
FROM demo_catalog dc
JOIN categories c ON c.name = dc.category
JOIN units u ON u.symbol = dc.base_unit
ORDER BY dc.sku;

-- Unités de vente : unité de base (par défaut) + conditionnement supérieur
INSERT INTO product_units (product_id, unit_id, conversion_factor, is_default_sale_unit)
SELECT p.id, u.id, 1, true
FROM demo_catalog dc
JOIN products p ON p.sku = dc.sku
JOIN units u ON u.symbol = dc.base_unit;

INSERT INTO product_units (product_id, unit_id, conversion_factor, is_default_sale_unit)
SELECT p.id, u.id, dc.alt_factor, false
FROM demo_catalog dc
JOIN products p ON p.sku = dc.sku
JOIN units u ON u.symbol = dc.alt_unit
WHERE dc.alt_unit IS NOT NULL;

-- Prix de vente en FCFA entiers (multiples de 25) :
--   Particulier = prix catalogue ; Revendeur = environ -8 % ;
--   conditionnement supérieur : remise de 5 % (Particulier) ou 10 % (Revendeur)
INSERT INTO product_prices (product_id, customer_type_id, unit_id, price)
SELECT p.id, ct.id, u.id,
       CASE WHEN ct.name = 'Particulier' THEN dc.price
            ELSE round(dc.price * 0.92 / 25) * 25 END
FROM demo_catalog dc
JOIN products p ON p.sku = dc.sku
JOIN units u ON u.symbol = dc.base_unit
CROSS JOIN customer_types ct
UNION ALL
SELECT p.id, ct.id, u.id,
       round(dc.price * dc.alt_factor
             * CASE WHEN ct.name = 'Particulier' THEN 0.95 ELSE 0.90 END / 25) * 25
FROM demo_catalog dc
JOIN products p ON p.sku = dc.sku
JOIN units u ON u.symbol = dc.alt_unit
CROSS JOIN customer_types ct
WHERE dc.alt_unit IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Fonctions de simulation (temporaires, supprimées à la fin de session)
-- ---------------------------------------------------------------------

-- Réception fournisseur complétée.
--   mode 'initial' : constitue le stock d'ouverture (4 x seuil critique)
--   mode 'restock' : réapprovisionne les produits proches du seuil
CREATE FUNCTION pg_temp.demo_receipt(
  p_user bigint, p_supplier text, p_ts timestamptz, p_ref text, p_mode text
) RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE
  v_sup bigint;
  v_op bigint;
  v_rec bigint;
  v_item bigint;
  v_opitem bigint;
  v_base numeric;
  v_unit bigint;
  v_qty numeric;
  v_factor numeric;
  v_price numeric;
  v_need numeric;
  r record;
BEGIN
  SELECT id INTO v_sup FROM suppliers WHERE name = p_supplier;

  FOR r IN
    SELECT p.id, p.current_stock, p.critical_threshold, p.base_unit_id,
           dc.cost, dc.alt_factor, au.id AS alt_unit_id
    FROM demo_catalog dc
    JOIN products p ON p.sku = dc.sku
    LEFT JOIN units au ON au.symbol = dc.alt_unit
    WHERE dc.supplier = p_supplier
      AND (p_mode = 'initial'
           OR (dc.restock AND p.current_stock <= p.critical_threshold * 2.5))
    ORDER BY p.id
  LOOP
    v_need := r.critical_threshold * 4 - r.current_stock;
    CONTINUE WHEN v_need <= 0;

    IF r.alt_unit_id IS NOT NULL AND v_need >= r.alt_factor * 0.5 THEN
      v_unit := r.alt_unit_id;
      v_factor := r.alt_factor;
      v_qty := ceil(v_need / r.alt_factor);
      v_price := round(r.cost * r.alt_factor * 0.97);
    ELSE
      v_unit := r.base_unit_id;
      v_factor := 1;
      v_qty := ceil(v_need);
      v_price := r.cost;
    END IF;

    IF v_op IS NULL THEN
      INSERT INTO stock_operations (operation_type, created_by, created_at, notes)
      VALUES ('RECEIPT', p_user, p_ts, 'Réception ' || p_ref)
      RETURNING id INTO v_op;

      INSERT INTO stock_receipts
        (operation_id, supplier_id, reference, status, received_at, created_by, notes, created_at)
      VALUES
        (v_op, v_sup, p_ref, 'COMPLETED', p_ts, p_user,
         CASE WHEN p_mode = 'initial' THEN 'Constitution du stock initial' ELSE 'Réapprovisionnement' END,
         p_ts - interval '40 minutes')
      RETURNING id INTO v_rec;
    END IF;

    INSERT INTO stock_receipt_items
      (receipt_id, product_id, unit_id, quantity, conversion_factor, unit_purchase_price)
    VALUES (v_rec, r.id, v_unit, v_qty, v_factor, v_price);

    INSERT INTO stock_operation_items
      (operation_id, product_id, unit_id, direction, quantity, conversion_factor)
    VALUES (v_op, r.id, v_unit, 'IN', v_qty, v_factor)
    RETURNING id, base_quantity INTO v_opitem, v_base;

    INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity, created_at)
    VALUES (v_opitem, r.id, 'IN', v_base, p_ts);

    -- Coût moyen pondéré (identique à l'application)
    UPDATE products
    SET current_stock = current_stock + v_base,
        average_cost = ((current_stock * average_cost) + (v_qty * v_price)) / (current_stock + v_base)
    WHERE id = r.id;

    INSERT INTO supplier_products (supplier_id, product_id, last_purchase_price, is_preferred)
    VALUES (v_sup, r.id, v_price, true)
    ON CONFLICT (supplier_id, product_id)
    DO UPDATE SET last_purchase_price = EXCLUDED.last_purchase_price;
  END LOOP;

  RETURN v_rec;
END
$fn$;

-- Vente complétée. Chaque ligne : {product_id, unit_id, qty}.
-- Les quantités sont plafonnées au stock disponible ; le prix vient de la
-- grille product_prices (comme dans l'application).
CREATE FUNCTION pg_temp.demo_sale(
  p_user bigint, p_ts timestamptz, p_ref text,
  p_customer bigint, p_type bigint, p_lines jsonb
) RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE
  v_op bigint;
  v_sale bigint;
  v_opitem bigint;
  v_base numeric;
  v_unit bigint;
  v_factor numeric;
  v_qty numeric;
  v_price numeric;
  l jsonb;
  p record;
BEGIN
  FOR l IN SELECT jsonb_array_elements(p_lines) LOOP
    SELECT id, base_unit_id, current_stock, average_cost INTO p
    FROM products WHERE id = (l->>'product_id')::bigint FOR UPDATE;

    v_unit := (l->>'unit_id')::bigint;
    IF v_unit = p.base_unit_id THEN
      v_factor := 1;
    ELSE
      SELECT conversion_factor INTO v_factor
      FROM product_units WHERE product_id = p.id AND unit_id = v_unit;
    END IF;
    CONTINUE WHEN v_factor IS NULL;

    v_qty := (l->>'qty')::numeric;
    IF v_qty * v_factor > p.current_stock THEN
      v_qty := floor(p.current_stock / v_factor);
    END IF;
    CONTINUE WHEN v_qty <= 0;

    SELECT price INTO v_price
    FROM product_prices
    WHERE product_id = p.id AND customer_type_id = p_type AND unit_id = v_unit AND is_active;
    CONTINUE WHEN v_price IS NULL;

    IF v_op IS NULL THEN
      INSERT INTO stock_operations (operation_type, created_by, created_at, notes)
      VALUES ('SALE', p_user, p_ts, 'Vente ' || p_ref)
      RETURNING id INTO v_op;

      INSERT INTO sales
        (operation_id, customer_id, customer_type_id, reference, status, sold_at, created_by, created_at)
      VALUES (v_op, p_customer, p_type, p_ref, 'COMPLETED', p_ts, p_user, p_ts)
      RETURNING id INTO v_sale;
    END IF;

    INSERT INTO sale_items
      (sale_id, product_id, unit_id, quantity, conversion_factor, unit_price, cost_at_sale)
    VALUES (v_sale, p.id, v_unit, v_qty, v_factor, v_price, p.average_cost);

    INSERT INTO stock_operation_items
      (operation_id, product_id, unit_id, direction, quantity, conversion_factor)
    VALUES (v_op, p.id, v_unit, 'OUT', v_qty, v_factor)
    RETURNING id, base_quantity INTO v_opitem, v_base;

    INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity, created_at)
    VALUES (v_opitem, p.id, 'OUT', v_base, p_ts);

    UPDATE products SET current_stock = current_stock - v_base WHERE id = p.id;
  END LOOP;

  IF v_sale IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE sales
  SET total_amount = (
    SELECT COALESCE(sum(round(quantity * unit_price, 0)), 0) FROM sale_items WHERE sale_id = v_sale
  )
  WHERE id = v_sale;

  RETURN v_sale;
END
$fn$;

-- Retour client (1 unité de la première ligne de la vente), remise en stock.
CREATE FUNCTION pg_temp.demo_return(
  p_user bigint, p_sale bigint, p_ts timestamptz, p_ref text, p_reason text
) RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE
  v_op bigint;
  v_ret bigint;
  v_opitem bigint;
  v_base numeric;
  line record;
BEGIN
  SELECT * INTO line FROM sale_items WHERE sale_id = p_sale ORDER BY id LIMIT 1;
  IF line.id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO stock_operations (operation_type, created_by, created_at, notes)
  VALUES ('RETURN', p_user, p_ts, 'Retour ' || p_ref)
  RETURNING id INTO v_op;

  INSERT INTO sales_returns
    (operation_id, sale_id, reference, status, returned_at, created_by, reason, created_at)
  VALUES (v_op, p_sale, p_ref, 'COMPLETED', p_ts, p_user, p_reason, p_ts)
  RETURNING id INTO v_ret;

  INSERT INTO sales_return_items
    (return_id, sale_item_id, product_id, unit_id, quantity, conversion_factor, unit_price, cost_at_return)
  VALUES
    (v_ret, line.id, line.product_id, line.unit_id, 1, line.conversion_factor,
     line.unit_price, line.cost_at_sale);

  INSERT INTO stock_operation_items
    (operation_id, product_id, unit_id, direction, quantity, conversion_factor)
  VALUES (v_op, line.product_id, line.unit_id, 'IN', 1, line.conversion_factor)
  RETURNING id, base_quantity INTO v_opitem, v_base;

  INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity, created_at)
  VALUES (v_opitem, line.product_id, 'IN', v_base, p_ts);

  UPDATE products SET current_stock = current_stock + v_base WHERE id = line.product_id;

  RETURN v_ret;
END
$fn$;

-- Sortie de stock par ajustement (casse, péremption...), en unité de base.
CREATE FUNCTION pg_temp.demo_adjust_out(
  p_user bigint, p_sku text, p_qty numeric, p_ts timestamptz, p_reason text
) RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE
  v_op bigint;
  v_opitem bigint;
  v_base numeric;
  p record;
BEGIN
  SELECT id, base_unit_id, current_stock INTO p FROM products WHERE sku = p_sku FOR UPDATE;
  p_qty := least(p_qty, p.current_stock);
  IF p_qty <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO stock_operations (operation_type, created_by, created_at, notes)
  VALUES ('ADJUSTMENT', p_user, p_ts, p_reason)
  RETURNING id INTO v_op;

  INSERT INTO stock_adjustments (operation_id, reason, counted_at, created_by)
  VALUES (v_op, p_reason, p_ts, p_user);

  INSERT INTO stock_operation_items
    (operation_id, product_id, unit_id, direction, quantity, conversion_factor)
  VALUES (v_op, p.id, p.base_unit_id, 'OUT', p_qty, 1)
  RETURNING id, base_quantity INTO v_opitem, v_base;

  INSERT INTO stock_movements (operation_item_id, product_id, direction, base_quantity, created_at)
  VALUES (v_opitem, p.id, 'OUT', v_base, p_ts);

  UPDATE products SET current_stock = current_stock - v_base WHERE id = p.id;

  RETURN v_op;
END
$fn$;

-- ---------------------------------------------------------------------
-- 4. Simulation : J-35 (stock d'ouverture) jusqu'à aujourd'hui
-- ---------------------------------------------------------------------
DO $sim$
DECLARE
  v_user bigint;
  v_part bigint;
  v_rev bigint;
  v_rev_cust bigint[];
  v_part_cust bigint[];
  v_day timestamptz;
  v_d int;
  i int;
  k int;
  n int;
  nl int;
  v_seq int;
  v_dow int;
  v_times double precision[];
  v_ts timestamptz;
  x double precision;
  v_cust bigint;
  v_type bigint;
  v_lines jsonb;
  v_pid bigint;
  v_ubase bigint;
  v_ualt bigint;
  v_unit bigint;
  v_qty numeric;
  v_sale bigint;
  v_recent bigint[] := '{}';
  v_len int;
  v_big_cust bigint;
  r record;
  -- Produits que l'on fait passer en rupture / stock faible la veille,
  -- pour que le tableau de bord montre des alertes.
  v_rupture text[] := ARRAY['BOI-JUS-ORA', 'EPI-CAF-100'];
  v_faible text[] := ARRAY['EPI-LAI-POU', 'HYG-LOT-250', 'EPI-THE-VER', 'ENT-EPO-3'];
BEGIN
  SELECT id INTO v_user FROM users ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Aucun utilisateur : créez d''abord l''administrateur (npm run bootstrap:admin).';
  END IF;

  SELECT id INTO v_part FROM customer_types WHERE name = 'Particulier';
  SELECT id INTO v_rev FROM customer_types WHERE name = 'Revendeur';
  SELECT array_agg(id ORDER BY id) INTO v_rev_cust FROM customers WHERE customer_type_id = v_rev;
  SELECT array_agg(id ORDER BY id) INTO v_part_cust FROM customers WHERE customer_type_id = v_part;
  SELECT id INTO v_big_cust FROM customers WHERE name = 'Restaurant Le Sahel';

  FOR v_d IN REVERSE 35..0 LOOP
    v_day := date_trunc('day', now()) - v_d * interval '1 day';
    v_seq := 0;

    -- Réceptions : stock d'ouverture, puis réapprovisionnements réguliers
    IF v_d = 35 OR v_d IN (28, 21, 14, 8, 3) THEN
      FOR r IN SELECT name FROM suppliers ORDER BY id LOOP
        v_seq := v_seq + 1;
        PERFORM pg_temp.demo_receipt(
          v_user, r.name,
          v_day + interval '8 hours' + v_seq * interval '35 minutes',
          'REC-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_seq::text, 2, '0'),
          CASE WHEN v_d = 35 THEN 'initial' ELSE 'restock' END
        );
      END LOOP;
    END IF;

    CONTINUE WHEN v_d = 35;  -- pas de vente le jour de l'ouverture du stock

    -- Nombre de ventes du jour (plus nombreuses le samedi, moins le dimanche)
    v_dow := extract(dow FROM v_day)::int;
    n := CASE
           WHEN v_dow = 0 THEN 4 + floor(random() * 4)::int
           WHEN v_dow = 6 THEN 13 + floor(random() * 7)::int
           ELSE 9 + floor(random() * 6)::int
         END;

    SELECT array_agg(t ORDER BY t) INTO v_times
    FROM (SELECT random() AS t FROM generate_series(1, n)) s;

    FOR i IN 1..n LOOP
      IF v_d = 0 THEN
        -- Aujourd'hui : uniquement des heures déjà passées
        v_ts := date_trunc('day', now())
                + v_times[i] * greatest(now() - date_trunc('day', now()) - interval '2 minutes', interval '0');
      ELSE
        v_ts := v_day + interval '8 hours' + v_times[i] * interval '11 hours 30 minutes';
      END IF;

      -- Client : revendeur enregistré, particulier enregistré ou passage
      x := random();
      IF x < 0.22 THEN
        v_type := v_rev;
        v_cust := v_rev_cust[1 + floor(random() * array_length(v_rev_cust, 1))::int];
      ELSIF x < 0.40 THEN
        v_type := v_part;
        v_cust := v_part_cust[1 + floor(random() * array_length(v_part_cust, 1))::int];
      ELSE
        v_type := v_part;
        v_cust := NULL;
      END IF;

      nl := CASE WHEN v_type = v_rev THEN 3 + floor(random() * 4)::int
                 ELSE 1 + floor(random() * 3)::int END;
      v_lines := '[]'::jsonb;

      FOR k IN 1..nl LOOP
        -- Tirage pondéré par la popularité
        SELECT p.id, p.base_unit_id, au.id INTO v_pid, v_ubase, v_ualt
        FROM demo_catalog dc
        JOIN products p ON p.sku = dc.sku
        LEFT JOIN units au ON au.symbol = dc.alt_unit
        WHERE v_d > 0 OR dc.sku <> ALL (v_rupture || v_faible)
        ORDER BY -ln(1 - random()) / dc.popularity
        LIMIT 1;

        IF v_type = v_rev AND v_ualt IS NOT NULL AND random() < 0.45 THEN
          v_unit := v_ualt;
          v_qty := 1 + floor(random() * 2)::int;
        ELSE
          v_unit := v_ubase;
          v_qty := CASE WHEN v_type = v_rev THEN 2 + floor(random() * 8)::int
                        ELSE 1 + floor(random() * 3)::int END;
        END IF;

        v_lines := v_lines || jsonb_build_object('product_id', v_pid, 'unit_id', v_unit, 'qty', v_qty);
      END LOOP;

      v_sale := pg_temp.demo_sale(
        v_user, v_ts,
        'VTE-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(i::text, 3, '0'),
        v_cust, v_type, v_lines
      );

      IF v_sale IS NOT NULL AND v_d BETWEEN 2 AND 14 THEN
        v_recent := v_recent || v_sale;
      END IF;
    END LOOP;

    -- Pertes constatées (casse, péremption...)
    IF v_d = 12 THEN
      PERFORM pg_temp.demo_adjust_out(v_user, 'BOI-GAZ-COL', 3, v_day + interval '18 hours',
        'Casse constatée lors du rangement');
    ELSIF v_d = 9 THEN
      PERFORM pg_temp.demo_adjust_out(v_user, 'EPI-SAR-125', 4, v_day + interval '18 hours',
        'Boîtes périmées retirées du rayon');
      PERFORM pg_temp.demo_adjust_out(v_user, 'EPI-LAI-CON', 2, v_day + interval '18 hours 10 minutes',
        'Boîtes cabossées retirées de la vente');
    ELSIF v_d = 5 THEN
      PERFORM pg_temp.demo_adjust_out(v_user, 'ENT-JAV-1L', 2, v_day + interval '18 hours',
        'Fuite constatée sur deux bouteilles');
    END IF;

    IF v_d = 1 THEN
      -- Trois retours clients sur des ventes des deux dernières semaines
      -- (avant les gros achats, pour ne pas remettre en stock un produit en rupture)
      v_len := coalesce(array_length(v_recent, 1), 0);
      IF v_len >= 3 THEN
        PERFORM pg_temp.demo_return(
          v_user, v_recent[ceil(v_len * 0.25)::int],
          (SELECT sold_at FROM sales WHERE id = v_recent[ceil(v_len * 0.25)::int]) + interval '1 day',
          'RET-' || to_char(now(), 'YYYYMMDD') || '-01', 'Emballage endommagé');
        PERFORM pg_temp.demo_return(
          v_user, v_recent[ceil(v_len * 0.5)::int],
          (SELECT sold_at FROM sales WHERE id = v_recent[ceil(v_len * 0.5)::int]) + interval '1 day',
          'RET-' || to_char(now(), 'YYYYMMDD') || '-02', 'Erreur de produit à la livraison');
        PERFORM pg_temp.demo_return(
          v_user, v_recent[ceil(v_len * 0.8)::int],
          (SELECT sold_at FROM sales WHERE id = v_recent[ceil(v_len * 0.8)::int]) + interval '1 day',
          'RET-' || to_char(now(), 'YYYYMMDD') || '-03', 'Produit non conforme');
      END IF;

      -- La veille : gros achats d'un restaurant qui vident certains produits
      v_lines := '[]'::jsonb;
      FOR r IN SELECT id, base_unit_id, current_stock FROM products WHERE sku = ANY (v_rupture) LOOP
        v_lines := v_lines || jsonb_build_object(
          'product_id', r.id, 'unit_id', r.base_unit_id, 'qty', r.current_stock);
      END LOOP;
      PERFORM pg_temp.demo_sale(
        v_user, v_day + interval '17 hours 20 minutes',
        'VTE-' || to_char(v_day, 'YYYYMMDD') || '-901', v_big_cust, v_rev, v_lines);

      v_lines := '[]'::jsonb;
      FOR r IN SELECT id, base_unit_id, current_stock, critical_threshold
               FROM products WHERE sku = ANY (v_faible) LOOP
        v_qty := r.current_stock - ceil(r.critical_threshold * 0.5);
        IF v_qty > 0 THEN
          v_lines := v_lines || jsonb_build_object(
            'product_id', r.id, 'unit_id', r.base_unit_id, 'qty', v_qty);
        END IF;
      END LOOP;
      PERFORM pg_temp.demo_sale(
        v_user, v_day + interval '17 hours 45 minutes',
        'VTE-' || to_char(v_day, 'YYYYMMDD') || '-902', v_big_cust, v_rev, v_lines);
    END IF;
  END LOOP;

  -- Un brouillon de réception (livraison attendue) et un brouillon de vente
  INSERT INTO stock_receipts (supplier_id, reference, created_by, notes)
  SELECT id, 'REC-BROUILLON-01', v_user, 'Commande en attente de livraison'
  FROM suppliers WHERE name = 'Sahel Boissons';

  INSERT INTO stock_receipt_items (receipt_id, product_id, unit_id, quantity, conversion_factor, unit_purchase_price)
  SELECT (SELECT id FROM stock_receipts WHERE reference = 'REC-BROUILLON-01'),
         p.id, u.id, 10, dc.alt_factor, round(dc.cost * dc.alt_factor * 0.97)
  FROM demo_catalog dc
  JOIN products p ON p.sku = dc.sku
  JOIN units u ON u.symbol = dc.alt_unit
  WHERE dc.sku IN ('BOI-EAU-150', 'BOI-GAZ-COL');

  INSERT INTO sales (customer_id, customer_type_id, reference, created_by)
  VALUES (v_big_cust, v_rev, 'VTE-BROUILLON-01', v_user);

  INSERT INTO sale_items (sale_id, product_id, unit_id, quantity, conversion_factor, unit_price, cost_at_sale)
  SELECT (SELECT id FROM sales WHERE reference = 'VTE-BROUILLON-01'),
         p.id, p.base_unit_id, 12, 1, pp.price, p.average_cost
  FROM products p
  JOIN product_prices pp
    ON pp.product_id = p.id AND pp.unit_id = p.base_unit_id
   AND pp.customer_type_id = v_rev AND pp.is_active
  WHERE p.sku IN ('BOI-EAU-050', 'EPI-SAR-125');
END
$sim$;

-- Les fiches référentielles datent de l'ouverture du stock
UPDATE categories SET created_at = now() - interval '36 days';
UPDATE suppliers  SET created_at = now() - interval '36 days';
UPDATE customers  SET created_at = now() - interval '36 days';
UPDATE products   SET created_at = now() - interval '36 days';

DROP TABLE demo_catalog;
