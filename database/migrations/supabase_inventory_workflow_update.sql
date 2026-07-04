-- My Dream Bike: Inventory Stock In / Stock Out workflow upgrade
-- Run this once in Supabase SQL Editor before using the new Stock In and Stock Out pages.

ALTER TABLE stock_history
ADD COLUMN IF NOT EXISTS quantity_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_after INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS edited_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS edited_by_admin_name TEXT;

-- Make old records safer to display in the new Stock Movement History table.
UPDATE stock_history
SET quantity_before = 0
WHERE quantity_before IS NULL;

UPDATE stock_history
SET quantity_after = quantity
WHERE quantity_after IS NULL;

UPDATE stock_history
SET edited_by_admin_name = 'Not recorded'
WHERE edited_by_admin_name IS NULL OR edited_by_admin_name = '';
