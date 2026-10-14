// Copies the product catalogue from production into the dev database:
// products, colours, images, sizes (stock) and stock history, keeping IDs so
// product links and uploaded image names match. Customers, admins and
// sessions are NOT copied.
//
//   npm run db:copy-catalogue                      -> shows what would be copied (changes nothing)
//   npm run db:copy-catalogue -- --apply           -> copies into an empty dev catalogue
//   npm run db:copy-catalogue -- --apply --replace -> empties the dev catalogue first, then copies
//
// Source: the PHP site's ../.env (DB_HOST, DB_USER, ...), read in a READ ONLY transaction.
// Target: DATABASE_URL in store-workers/.env.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const replace = process.argv.includes("--replace");
const TABLES = ["products", "product_colors", "product_images", "product_sizes", "stock_history"];

function readEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const php = readEnvFile(join(root, "..", ".env"));
const targetUrl = process.env.DATABASE_URL;
if (!php.DB_HOST || !php.DB_USER || !php.DB_PASSWORD) throw new Error("Production settings missing from ../.env");
if (!targetUrl) throw new Error("DATABASE_URL missing from store-workers/.env");

const target = new URL(targetUrl);
const targetUser = decodeURIComponent(target.username);
console.log(`From (production, read-only): ${php.DB_HOST} (user ${php.DB_USER})`);
console.log(`To   (dev):                   ${target.hostname} (user ${targetUser})`);
if (targetUser === php.DB_USER) {
  console.error("Refusing: source and target are the same database.");
  process.exit(1);
}

const source = postgres({
  host: php.DB_HOST, port: Number(php.DB_PORT || 5432), database: php.DB_NAME || "postgres",
  username: php.DB_USER, password: php.DB_PASSWORD, ssl: "require", max: 1, fetch_types: false,
});
const dest = postgres(targetUrl, { max: 1, fetch_types: false, onnotice: () => {} });

try {
  // Read everything inside a READ ONLY transaction: the database rejects any write.
  const rows = await source.begin("read only", async (tx) => {
    const out = {};
    for (const table of TABLES) out[table] = await tx`SELECT * FROM ${tx(table)} ORDER BY id`;
    return out;
  });
  for (const table of TABLES) console.log(`  ${table.padEnd(15)} ${rows[table].length} rows`);

  const existing = await dest`SELECT count(*)::int AS n FROM products`;
  if (existing[0].n > 0 && !replace) {
    console.log(`\nThe dev database already has ${existing[0].n} products. Add --replace to empty the dev catalogue first.`);
    process.exit(apply ? 1 : 0);
  }
  if (!apply) {
    console.log("\nNothing was changed. Run again with --apply to copy.");
    process.exit(0);
  }

  await dest.begin(async (tx) => {
    if (replace) await tx`TRUNCATE stock_history, product_sizes, product_images, product_colors, products RESTART IDENTITY CASCADE`;
    for (const table of TABLES) {
      if (rows[table].length === 0) continue;
      const columns = Object.keys(rows[table][0]);
      await tx`INSERT INTO ${tx(table)} ${tx(rows[table], columns)}`;
      // Move each ID counter past the copied IDs so new rows don't clash.
      await tx`SELECT setval(pg_get_serial_sequence(${table}, 'id'), (SELECT MAX(id) FROM ${tx(table)}))`;
    }
  });
  console.log("\nCopied.");
} finally {
  await source.end();
  await dest.end();
}
