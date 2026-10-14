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

export type TestColour = {
  name: string;
  code?: string;
  isDefault?: boolean;
  sizes?: { size: string; quantity: number }[];
  images?: string[];
};

export type TestProduct = {
  name?: string;
  itemCode?: string;
  brand?: string;
  category?: string;
  subCategory?: string;
  status?: "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK";
  price?: number;
  costPrice?: number;
  onlineSellPrice?: number;
  description?: string;
  arrivalDate?: string;
  legacyImage?: string;
  colours?: TestColour[];
};

/** Creates a product with its colours, sizes and images. Returns the product ID and its unique name. */
export async function createProduct(sql: postgres.Sql, p: TestProduct = {}) {
  const name = p.name ?? unique("Test Helmet");
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO products (item_code, name, brand, category, sub_category, status, price, cost_price, online_sell_price, description, image, arrival_date)
    VALUES (
      ${p.itemCode ?? unique("ITEM")}, ${name}, ${p.brand ?? "KYT"}, ${p.category ?? "Helmet"}, ${p.subCategory ?? "Full Face Helmet"},
      ${p.status ?? "ACTIVE"}, ${p.price ?? 199}, ${p.costPrice ?? 0}, ${p.onlineSellPrice ?? 0}, ${p.description ?? ""},
      ${p.legacyImage ?? ""}, ${p.arrivalDate ?? null}
    )
    RETURNING id`;
  const productId = Number(row!.id);

  for (const colour of p.colours ?? []) {
    const [c] = await sql<{ id: string }[]>`
      INSERT INTO product_colors (product_id, color_name, color_code, is_default)
      VALUES (${productId}, ${colour.name}, ${colour.code ?? "#000000"}, ${colour.isDefault ?? false})
      RETURNING id`;
    const colourId = Number(c!.id);
    for (const s of colour.sizes ?? []) {
      await sql`INSERT INTO product_sizes (product_id, color_id, size, quantity) VALUES (${productId}, ${colourId}, ${s.size}, ${s.quantity})`;
    }
    for (const [index, path] of (colour.images ?? []).entries()) {
      await sql`
        INSERT INTO product_images (product_id, color_id, image_path, sort_order, is_main)
        VALUES (${productId}, ${colourId}, ${path}, ${index}, ${index === 0})`;
    }
  }
  return { id: productId, name };
}

/** A product with one colour and stock, which is what most tests need. */
export function inStockProduct(overrides: TestProduct = {}): TestProduct {
  return {
    colours: [{ name: "Black", isDefault: true, sizes: [{ size: "M", quantity: 3 }], images: ["uploads/test-black.jpg"] }],
    ...overrides,
  };
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
