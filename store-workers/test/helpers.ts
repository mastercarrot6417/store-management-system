import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import postgres from "postgres";
import { createSessionRow, type UserType } from "../src/lib/session";
import { TEST_DB_MARKER_TABLE } from "./test-db";

export const ORIGIN = "https://store.test";

let shared: postgres.Sql | undefined;

/**
 * Database client for setting up test data, shared by all tests in a file.
 * Throws unless it's connected to the PGlite test database, so tests can
 * never write to Supabase.
 */
export async function testSql(): Promise<postgres.Sql> {
  if (!shared) {
    const sql = postgres(env.HYPERDRIVE_NOCACHE.connectionString, { max: 1, fetch_types: false, onnotice: () => {} });
    const [row] = await sql<{ marker: string | null }[]>`SELECT to_regclass(${TEST_DB_MARKER_TABLE})::text AS marker`;
    if (!row?.marker) throw new Error("Refusing to run: not connected to the PGlite test database.");
    shared = sql;
  }
  return shared;
}

/** Sends a request to the Worker. Redirects are returned, not followed. */
export function fetchApp(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual", ...init }));
}

/** A form POST from the shop's own pages (same-origin), as a browser would send it. */
export function postForm(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: ORIGIN,
  };
  if (cookie) headers.Cookie = cookie;
  return fetchApp(path, { method: "POST", headers, body: new URLSearchParams(fields).toString() });
}

/** Test files run in separate isolates, so use random IDs rather than a counter. */
function unique(label: string): string {
  return `${label}-${crypto.randomUUID()}`;
}

export async function createAdmin(sql: postgres.Sql, opts: { role?: "boss" | "admin"; displayName?: string } = {}) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO admin (email, password, role, display_name)
    VALUES (${unique("admin") + "@test.my"}, 'not-a-real-hash', ${opts.role ?? "admin"}, ${opts.displayName ?? "Test Admin"})
    RETURNING id`;
  return Number(row!.id);
}

export async function createCustomer(sql: postgres.Sql, fullName = "Test Customer") {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO customers (full_name, email, password)
    VALUES (${fullName}, ${unique("customer") + "@test.my"}, 'not-a-real-hash')
    RETURNING id`;
  return Number(row!.id);
}

export async function login(sql: postgres.Sql, type: UserType, userId: number) {
  const token = await createSessionRow(sql, type, userId);
  const cookieName = type === "admin" ? "mdb_admin" : "mdb_customer";
  return { token, cookie: `${cookieName}=${token}` };
}

export async function csrfTokenFor(sql: postgres.Sql, sessionToken: string): Promise<string> {
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionToken)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const [row] = await sql<{ csrf_token: string }[]>`SELECT csrf_token FROM sessions WHERE id_hash = ${hash}`;
  return row!.csrf_token;
}
