INSERT INTO categories (name, description)
VALUES ('Fournitures', 'Articles de démonstration')
ON CONFLICT (name) DO NOTHING;

INSERT INTO units (name, symbol)
VALUES ('Unité', 'u')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (category_id, base_unit_id, name, sku)
SELECT categories.id, units.id, 'Stylo bleu', 'DEMO-STY-001'
FROM categories
CROSS JOIN units
WHERE categories.name = 'Fournitures'
  AND units.name = 'Unité'
ON CONFLICT (sku) DO NOTHING;
