-- ==========================================================
-- 0002 Legacy stock clean-up + "product + colour + size is unique" rule
--
-- Same logic the PHP site runs on every admin page load in
-- ensureInventoryMovementSchema(). On the production database these steps
-- have most likely already happened, so this file should change nothing
-- there. It only touches rows if legacy data is still present.
-- ==========================================================

-- Products with stock rows but no colours get a 'Default' colour.
INSERT INTO product_colors (product_id, color_name, color_code, is_default)
SELECT p.id, 'Default', '#000000', TRUE
FROM products p
WHERE EXISTS (SELECT 1 FROM product_sizes ps WHERE ps.product_id = p.id AND ps.color_id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM product_colors pc WHERE pc.product_id = p.id);

-- If a product has exactly one colour, assign its old no-colour stock and
-- history rows to that colour. Products with several colours are left alone
-- so an admin can review them by hand (same as the PHP behaviour).
WITH single_colour AS (
  SELECT product_id, MIN(id) AS color_id
  FROM product_colors
  GROUP BY product_id
  HAVING COUNT(*) = 1
)
UPDATE product_sizes ps
SET color_id = sc.color_id
FROM single_colour sc
WHERE ps.product_id = sc.product_id
  AND ps.color_id IS NULL;

WITH single_colour AS (
  SELECT product_id, MIN(id) AS color_id
  FROM product_colors
  GROUP BY product_id
  HAVING COUNT(*) = 1
)
UPDATE stock_history sh
SET color_id = sc.color_id
FROM single_colour sc
WHERE sh.product_id = sc.product_id
  AND sh.color_id IS NULL;

-- Merge duplicate stock rows (same product + colour + size) by adding their
-- quantities into the oldest row, so the unique rule below can be added.
WITH duplicate_groups AS (
  SELECT product_id, color_id, size,
         MIN(id) AS keep_id,
         SUM(COALESCE(quantity, 0)) AS total_quantity
  FROM product_sizes
  WHERE color_id IS NOT NULL
  GROUP BY product_id, color_id, size
  HAVING COUNT(*) > 1
), update_kept AS (
  UPDATE product_sizes ps
  SET quantity = dg.total_quantity
  FROM duplicate_groups dg
  WHERE ps.id = dg.keep_id
  RETURNING ps.id
)
DELETE FROM product_sizes ps
USING duplicate_groups dg
WHERE ps.product_id = dg.product_id
  AND ps.color_id = dg.color_id
  AND ps.size = dg.size
  AND ps.id <> dg.keep_id;

-- Replace the old "product + size" rule with "product + colour + size".
ALTER TABLE product_sizes DROP CONSTRAINT IF EXISTS product_sizes_product_id_size_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_sizes_product_color_size_key'
  ) THEN
    ALTER TABLE product_sizes
      ADD CONSTRAINT product_sizes_product_color_size_key UNIQUE (product_id, color_id, size);
  END IF;
END $$;
