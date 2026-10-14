-- ==========================================================
-- 0003 Turn on Row Level Security for every app table
--
-- Supabase exposes tables in the public schema through its REST API to
-- anyone holding the project's anon key. With RLS on and no policies, that
-- API can no longer read or write these tables.
--
-- The PHP site and the Worker connect as the `postgres` role, which owns
-- these tables. Table owners skip RLS, so both apps keep working.
-- (Do NOT add FORCE ROW LEVEL SECURITY, which would also block the owner.)
-- ==========================================================

ALTER TABLE admin          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history  ENABLE ROW LEVEL SECURITY;

-- To check afterwards (every row should show rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
