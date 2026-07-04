-- My Dream Bike: stock history audit columns
-- Run this once in Supabase SQL Editor before using the new "Edited by" stock history feature.

ALTER TABLE admin
ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE stock_history
ADD COLUMN IF NOT EXISTS edited_by_admin_id BIGINT,
ADD COLUMN IF NOT EXISTS edited_by_admin_name TEXT;

-- Optional: label old stock records as not recorded because they were created before this feature existed.
UPDATE stock_history
SET edited_by_admin_name = 'Not recorded'
WHERE edited_by_admin_name IS NULL OR edited_by_admin_name = '';
