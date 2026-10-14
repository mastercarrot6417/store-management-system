-- ==========================================================
-- 0006 Archive products instead of deleting them
--
-- The PHP site's "Delete" removed a product together with its stock rows
-- and its whole stock history. The new admin archives instead: the product
-- and its history stay, it just disappears from the shop and the admin
-- lists until it's restored.
--
-- Archiving also sets status = 'HIDDEN', so the PHP site (which doesn't
-- know about this column) hides archived products from the shop too.
--
-- Safe on production: adds one empty column and changes no rows.
-- ==========================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITHOUT TIME ZONE;
