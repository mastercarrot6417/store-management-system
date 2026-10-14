// Runs the Worker locally against a throwaway in-memory Postgres (PGlite),
// so you can work on pages without a Supabase project. Nothing is saved.
//
//   npm run dev:local
//
// Prints demo session cookies so you can view admin and customer pages
// before the login pages exist (Phase 3).
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PORT = 54330;
const DB_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;

const db = await PGlite.create();
for (const file of readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(root, "migrations", file), "utf8"));
}

async function demoSession(userType, userId) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await db.query(
    `INSERT INTO sessions (id_hash, user_type, user_id, csrf_token, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '12 hours')`,
    [hash, userType, userId, randomBytes(32).toString("base64url")],
  );
  return token;
}

const { rows: [admin] } = await db.query(
  `INSERT INTO admin (email, password, role, display_name) VALUES ('demo-boss@local.test', '-', 'boss', 'Demo Boss') RETURNING id`,
);
const { rows: [customer] } = await db.query(
  `INSERT INTO customers (full_name, email, password) VALUES ('Demo Customer', 'demo-customer@local.test', '-') RETURNING id`,
);
const adminToken = await demoSession("admin", admin.id);
const customerToken = await demoSession("customer", customer.id);

// ---- Demo products, using sample photos from the PHP site's uploads/ folder ----
const phpUploads = join(root, "..", "uploads");
const DEMO_IMAGES = [
  "sample_10_1_1778694817979_8890.jpg",
  "sample_11_1_1778694817983_1300.jpg",
  "sample_12_1_1778694817987_1940.jpg",
  "sample_13_1_1778694817991_2762.jpg",
].filter((file) => existsSync(join(phpUploads, file)));
const img = (i) => (DEMO_IMAGES[i] ? `uploads/${DEMO_IMAGES[i]}` : null);

const DEMO_PRODUCTS = [
  { code: "DEMO-KYT-TT", name: "KYT TT-Course Full Face", brand: "KYT", cat: "Helmet", sub: "Full Face Helmet", price: 899, arrival: "2026-10-01",
    description: "Track-ready full face helmet.\nLightweight composite shell with wide visor.",
    colours: [
      { name: "Matt Black", code: "#1a1a1a", sizes: { S: 0, M: 3, L: 2, XL: 1 }, images: [img(0), img(1)] },
      { name: "Racing Red", code: "#c0392b", sizes: { M: 2, L: 0 }, images: [img(2)] },
    ] },
  { code: "DEMO-LS2-RAPID", name: "LS2 Rapid II", brand: "LS2", cat: "Helmet", sub: "Full Face Helmet", price: 459, arrival: "2026-09-20",
    description: "Everyday full face helmet.", colours: [{ name: "Gloss White", code: "#f5f5f5", sizes: { M: 4, L: 4 }, images: [img(3)] }] },
  { code: "DEMO-GRAC-KID", name: "Gracshaw Kid Helmet", brand: "Gracshaw", cat: "Helmet", sub: "Kid Helmet", price: 129, arrival: "2026-08-01",
    description: "", colours: [{ name: "Blue", code: "#2e86de", sizes: { XS: 0, S: 0 }, images: [img(1)] }] },
  { code: "DEMO-RAIN", name: "Rider Rain Suit", brand: "Grayfosh", cat: "Apparel", sub: "Rain Gear", price: 120, arrival: "2026-07-15",
    description: "Two-piece waterproof rain suit.", colours: [{ name: "Black", code: "#000000", sizes: { M: 5, L: 5, XL: 2 }, images: [] }] },
  { code: "DEMO-HIDDEN", name: "Hidden Demo Product", brand: "KYT", cat: "Helmet", sub: "Full Face Helmet", price: 1, arrival: "2026-10-02",
    description: "Should never appear on the shop.", status: "HIDDEN", colours: [{ name: "Grey", code: "#888888", sizes: { M: 1 }, images: [img(0)] }] },
];

for (const p of DEMO_PRODUCTS) {
  const { rows: [product] } = await db.query(
    `INSERT INTO products (item_code, name, brand, category, sub_category, status, price, description, arrival_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [p.code, p.name, p.brand, p.cat, p.sub, p.status ?? "ACTIVE", p.price, p.description, p.arrival],
  );
  for (const [ci, colour] of p.colours.entries()) {
    const { rows: [c] } = await db.query(
      `INSERT INTO product_colors (product_id, color_name, color_code, is_default) VALUES ($1, $2, $3, $4) RETURNING id`,
      [product.id, colour.name, colour.code, ci === 0],
    );
    for (const [size, quantity] of Object.entries(colour.sizes)) {
      await db.query(`INSERT INTO product_sizes (product_id, color_id, size, quantity) VALUES ($1, $2, $3, $4)`, [product.id, c.id, size, quantity]);
    }
    for (const [ii, path] of colour.images.filter(Boolean).entries()) {
      await db.query(
        `INSERT INTO product_images (product_id, color_id, image_path, sort_order, is_main) VALUES ($1, $2, $3, $4, $5)`,
        [product.id, c.id, path, ii, ii === 0],
      );
    }
  }
}

// Copy the sample photos into the local R2 bucket so /uploads/... can serve them.
// Local dev uses the preview bucket (preview_bucket_name in wrangler.jsonc).
for (const file of DEMO_IMAGES) {
  const result = spawnSync(
    "npx",
    ["wrangler", "r2", "object", "put", `store-images-dev/uploads/${file}`, "--file", join(phpUploads, file), "--local"],
    { cwd: root, shell: process.platform === "win32", stdio: "ignore" },
  );
  if (result.status !== 0) console.warn(`Could not copy ${file} into local R2.`);
}

const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: DB_PORT, maxConnections: 20 });
await server.start();

console.log(`
Local database ready (in memory, nothing is saved).
To view pages as a logged-in user, set one of these cookies on http://localhost:8787
(browser dev tools > Application > Cookies), then reload:
  Admin    (path /admin):  mdb_admin=${adminToken}
  Customer (path /):       mdb_customer=${customerToken}
`);

const wrangler = spawn(
  "npx",
  ["wrangler", "dev", "--port", "8787", "--var", `COOKIE_SECRET:${randomBytes(32).toString("base64url")}`],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: DB_URL,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_NOCACHE: DB_URL,
    },
  },
);

async function shutdown(code = 0) {
  wrangler.kill();
  await server.stop();
  await db.close();
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
wrangler.on("exit", (code) => shutdown(code ?? 0));
