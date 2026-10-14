-- ==========================================================
-- 0005 Use Malaysia time as the database default
--
-- Existing tables use TIMESTAMP WITHOUT TIME ZONE with DEFAULT NOW().
-- The PHP site runs `SET TIME ZONE 'Asia/Kuala_Lumpur'` on every
-- connection, so those columns hold Malaysia wall-clock time.
--
-- Hyperdrive pools connections, so a per-connection SET can't be relied
-- on. Setting the database default makes rows written by the Worker use
-- the same Malaysia time as rows written by PHP. PHP's own SET still
-- works and matches, so nothing changes for the PHP site.
--
-- Only new connections pick this up.
-- ==========================================================

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Kuala_Lumpur');
END $$;
