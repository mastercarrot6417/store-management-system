import type postgres from "postgres";
import type { Sql } from "../db";
import type { AdminUser } from "../session";
import { sizeOrder } from "../products";

/**
 * Stock In / Stock Out, ported from admin/stock_in.php and stock_out.php.
 *
 * Each movement runs in one transaction that locks the product row and the
 * size row (FOR UPDATE), changes the quantity and writes a stock_history row
 * with the before/after quantities and who did it. Two admins moving stock at
 * the same moment are handled one after the other, so no change is lost and
 * stock can never go below zero.
 *
 * Always call these with the uncached client (`c.var.db`).
 */

export const STOCK_IN_REASONS = [
  "New supplier stock",
  "Restock",
  "Returned item added back",
  "Stock correction",
  "Opening stock",
  "Other",
];

export const STOCK_OUT_REASONS = [
  "Damaged item",
  "Lost item",
  "Used for display/demo",
  "Supplier defect",
  "Sold outside system",
  "Stock correction",
  "Other",
];

/** Below this many units a variant counts as low stock (same as the PHP pages). */
export const LOW_STOCK_LIMIT = 5;
/** Largest single movement, and the most one variant can hold. Stops typos like 10000000. */
export const MAX_MOVEMENT = 100_000;
const MAX_STOCK = 1_000_000;
export const MAX_SIZE_LENGTH = 30;
export const MAX_NOTE_LENGTH = 500;

export type StockLevel = "out" | "low" | "in";

export function stockLevel(quantity: number): StockLevel {
  if (quantity <= 0) return "out";
  if (quantity < LOW_STOCK_LIMIT) return "low";
  return "in";
}

export type StockFormData = {
  /** Products that can take stock movements (archived ones can't). */
  products: { id: number; itemCode: string; name: string }[];
  product: { id: number; name: string } | null;
  colours: { id: number; name: string }[];
  /** The chosen colour, defaulting to the product's first colour. */
  colourId: number | null;
  sizes: { id: number; size: string; quantity: number }[];
};

/** Dropdown contents for the Stock In / Stock Out forms. */
export async function getStockFormData(sql: Sql, productId: number | null, colourId: number | null): Promise<StockFormData> {
  const products = await sql<{ id: string; item_code: string; name: string }[]>`
    SELECT id, item_code, name FROM products WHERE archived_at IS NULL ORDER BY name ASC, id ASC`;
  const data: StockFormData = {
    products: products.map((p) => ({ id: Number(p.id), itemCode: p.item_code, name: p.name })),
    product: null,
    colours: [],
    colourId: null,
    sizes: [],
  };

  const product = productId === null ? undefined : data.products.find((p) => p.id === productId);
  if (!product) return data;
  data.product = { id: product.id, name: product.name };

  const colours = await sql<{ id: string; color_name: string }[]>`
    SELECT id, color_name FROM product_colors
    WHERE product_id = ${product.id}
    ORDER BY is_default DESC, color_name ASC, id ASC`;
  data.colours = colours.map((c) => ({ id: Number(c.id), name: c.color_name }));
  data.colourId = data.colours.find((c) => c.id === colourId)?.id ?? data.colours[0]?.id ?? null;
  if (data.colourId === null) return data;

  const sizes = await sql<{ id: string; size: string; quantity: number }[]>`
    SELECT id, size, quantity FROM product_sizes
    WHERE product_id = ${product.id} AND color_id = ${data.colourId}
    ORDER BY ${sizeOrder(sql)}`;
  data.sizes = sizes.map((s) => ({ id: Number(s.id), size: s.size, quantity: Number(s.quantity) }));
  return data;
}

export type MovementResult = { ok: true; size: string; before: number; after: number } | { ok: false; error: string };

type MovementBase = { productId: number; colourId: number; quantity: number; reason: string; note: string };
export type StockInInput = MovementBase & { size: string };
export type StockOutInput = MovementBase & { sizeId: number };

function checkCommon(input: MovementBase, reasons: string[], label: "Stock In" | "Stock Out"): string | null {
  if (input.productId <= 0) return "Please select a product.";
  if (input.colourId <= 0) return "Please select a colour.";
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) return `${label} quantity must be more than 0.`;
  if (input.quantity > MAX_MOVEMENT) return `${label} quantity can't be more than ${MAX_MOVEMENT.toLocaleString("en-US")} at once.`;
  if (!reasons.includes(input.reason)) return `Please select a reason for the ${label}.`;
  return null;
}

type Tx = postgres.TransactionSql;

/** Locks the product and checks it can take stock movements and owns the colour. */
async function lockProductAndColour(tx: Tx, productId: number, colourId: number): Promise<string | null> {
  const [product] = await tx<{ archived: boolean }[]>`
    SELECT archived_at IS NOT NULL AS archived FROM products WHERE id = ${productId} FOR UPDATE`;
  if (!product) return "Selected product does not exist.";
  if (product.archived) return "This product is archived. Restore it before changing its stock.";
  const [colour] = await tx`SELECT 1 FROM product_colors WHERE id = ${colourId} AND product_id = ${productId}`;
  if (!colour) return "Selected colour does not belong to this product.";
  return null;
}

async function recordHistory(
  tx: Tx,
  type: "IN" | "OUT",
  input: MovementBase,
  size: string,
  before: number,
  after: number,
  admin: AdminUser,
): Promise<void> {
  await tx`
    INSERT INTO stock_history
      (product_id, color_id, size, type, quantity, reason, quantity_before, quantity_after, note, edited_by_admin_id, edited_by_admin_name)
    VALUES
      (${input.productId}, ${input.colourId}, ${size}, ${type}, ${input.quantity}, ${input.reason},
       ${before}, ${after}, ${input.note}, ${admin.id}, ${admin.displayName})`;
}

/**
 * Adds stock to a size of one colour. A size that doesn't exist yet for the
 * colour is created. An existing size matches regardless of case and spaces
 * ("xl" adds to "XL").
 */
export async function stockIn(sql: Sql, input: StockInInput, admin: AdminUser): Promise<MovementResult> {
  const size = input.size.trim().replace(/\s+/g, " ");
  const invalid = checkCommon(input, STOCK_IN_REASONS, "Stock In");
  if (invalid) return { ok: false, error: invalid };
  if (!size) return { ok: false, error: "Please select an existing size or enter a new size." };
  if (size.length > MAX_SIZE_LENGTH) return { ok: false, error: `Size can be at most ${MAX_SIZE_LENGTH} characters.` };

  return sql.begin(async (tx): Promise<MovementResult> => {
    const problem = await lockProductAndColour(tx, input.productId, input.colourId);
    if (problem) return { ok: false, error: problem };

    const [row] = await tx<{ id: string; size: string; quantity: number }[]>`
      SELECT id, size, quantity FROM product_sizes
      WHERE product_id = ${input.productId} AND color_id = ${input.colourId} AND LOWER(TRIM(size)) = LOWER(${size})
      ORDER BY id
      LIMIT 1
      FOR UPDATE`;
    const before = row ? Number(row.quantity) : 0;
    const after = before + input.quantity;
    if (after > MAX_STOCK) return { ok: false, error: `A size can hold at most ${MAX_STOCK.toLocaleString("en-US")} units.` };

    const savedSize = row ? row.size : size;
    if (row) {
      await tx`UPDATE product_sizes SET quantity = ${after} WHERE id = ${row.id}`;
    } else {
      await tx`
        INSERT INTO product_sizes (product_id, color_id, size, quantity)
        VALUES (${input.productId}, ${input.colourId}, ${size}, ${after})`;
    }
    await recordHistory(tx, "IN", input, savedSize, before, after, admin);
    return { ok: true, size: savedSize, before, after };
  });
}

/** Removes stock from an existing size. Refused if it would go below zero. */
export async function stockOut(sql: Sql, input: StockOutInput, admin: AdminUser): Promise<MovementResult> {
  const invalid = checkCommon(input, STOCK_OUT_REASONS, "Stock Out");
  if (invalid) return { ok: false, error: invalid };
  if (input.sizeId <= 0) return { ok: false, error: "Please select a size." };

  return sql.begin(async (tx): Promise<MovementResult> => {
    const problem = await lockProductAndColour(tx, input.productId, input.colourId);
    if (problem) return { ok: false, error: problem };

    const [row] = await tx<{ id: string; size: string; quantity: number }[]>`
      SELECT id, size, quantity FROM product_sizes
      WHERE id = ${input.sizeId} AND product_id = ${input.productId} AND color_id = ${input.colourId}
      FOR UPDATE`;
    if (!row) return { ok: false, error: "Selected size does not exist for this colour." };

    const before = Number(row.quantity);
    if (input.quantity > before) {
      return {
        ok: false,
        error: `Cannot remove ${input.quantity} unit(s). Only ${before} unit(s) are available for this colour and size.`,
      };
    }
    const after = before - input.quantity;
    await tx`UPDATE product_sizes SET quantity = ${after} WHERE id = ${row.id}`;
    await recordHistory(tx, "OUT", input, row.size, before, after, admin);
    return { ok: true, size: row.size, before, after };
  });
}
