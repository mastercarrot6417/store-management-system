# Database Folder

This folder keeps database backup and migration SQL files.

## Important files

- `latest_database_schema.sql` — latest schema backup for the current project version.
- `migrations/` — older incremental Supabase SQL update files kept for reference.

## For real data backup

This project ZIP cannot directly include your live Supabase data unless you export it from Supabase.
For a full backup, use Supabase Dashboard export or `pg_dump`.
