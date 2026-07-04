-- My Dream Bike: Boss admin + boss-only pricing upgrade
-- Run this in Supabase SQL Editor if the app has not auto-created these columns yet.

ALTER TABLE admin
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';

UPDATE admin
SET role = 'admin'
WHERE role IS NULL OR role = '';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS online_sell_price NUMERIC(10,2) DEFAULT 0;

UPDATE products SET cost_price = 0 WHERE cost_price IS NULL;
UPDATE products SET online_sell_price = 0 WHERE online_sell_price IS NULL;

-- Make one existing admin become the boss.
-- Change the email below to your boss/company owner admin email.
-- UPDATE admin SET role = 'boss' WHERE email = 'boss@example.com';
