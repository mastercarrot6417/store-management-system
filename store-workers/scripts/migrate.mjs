// Applies SQL files in migrations/ in order, once each, and records them in
// public.schema_migrations.
//
//   npm run db:migrate              -> shows the target database and pending files (changes nothing)
//   npm run db:migrate -- --apply   -> applies pending files, each in its own transaction
//
// Reads DATABASE_URL from store-workers/.env.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const apply = process.argv.includes("--apply");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to store-workers/.env (see .env.example).");
  process.exit(1);
}

const { hostname, username } = new URL(url);
console.log(`Target database: ${hostname} (user ${username})`);

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY`;

  const applied = new Set((await sql`SELECT name FROM public.schema_migrations`).map((r) => r.name));
  const pending = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("Database is up to date.");
  } else if (!apply) {
    console.log("Pending migrations:");
    for (const f of pending) console.log(`  - ${f}`);
    console.log("\nNothing was changed. Run again with --apply to apply them.");
  } else {
    for (const f of pending) {
      const text = readFileSync(join(migrationsDir, f), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`INSERT INTO public.schema_migrations (name) VALUES (${f})`;
      });
      console.log(`Applied ${f}`);
    }
  }
} catch (err) {
  console.error("Migration failed, nothing from the failing file was saved:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
