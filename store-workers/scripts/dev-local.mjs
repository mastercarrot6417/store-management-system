// Runs the Worker locally against a throwaway in-memory Postgres (PGlite),
// so you can work on pages without a Supabase project. Nothing is saved.
//
//   npm run dev:local
//
// Prints demo session cookies so you can view admin and customer pages
// before the login pages exist (Phase 3).
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
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
