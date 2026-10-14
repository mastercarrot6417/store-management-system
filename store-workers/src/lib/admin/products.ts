import postgres from "postgres";
import type { Sql } from "../db";
import { displayImage, escapeLike } from "../products";
import type { ProductInput, ProductStatus } from "./product-form";

/**
 * Product queries for the admin panel, ported from admin/products.php,
 * add_product.php, edit_product.php and delete_product.php.
 *
 * Boss-only prices (cost price, online sell price) are only returned as
 * `bossPrices` when the caller says the admin is a boss.
 */

export type BossPrices = { cost: number; online: number };

export type AdminProductListItem = {
  id: number;
  itemCode: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  status: string;
  price: number;
  bossPrices: BossPrices | null;
  totalQuantity: number;
  image: string | null;
  archived: boolean;
};

export type AdminProductFilters = { search: string; category: string; subCategory: string; archived: boolean };

export async function listAdminProducts(sql: Sql, filters: AdminProductFilters, isBoss: boolean): Promise<AdminProductListItem[]> {
  const conditions = [filters.archived ? sql`p.archived_at IS NOT NULL` : sql`p.archived_at IS NULL`];
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(sql`(p.name ILIKE ${pattern} OR p.item_code ILIKE ${pattern} OR p.brand ILIKE ${pattern}
      OR p.category ILIKE ${pattern} OR p.sub_category ILIKE ${pattern})`);
  }
  if (filters.category) conditions.push(sql`p.category = ${filters.category}`);
  if (filters.subCategory) conditions.push(sql`p.sub_category = ${filters.subCategory}`);
  const where = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

  const rows = await sql<{
    id: string; item_code: string; name: string; brand: string; category: string; sub_category: string; status: string;
    price: string; cost_price: string | null; online_sell_price: string | null; total_quantity: string;
    display_image: string | null; archived: boolean;
  }[]>`
    SELECT p.id, p.item_code, p.name, p.brand, p.category, p.sub_category, p.status, p.price,
           p.cost_price, p.online_sell_price, p.archived_at IS NOT NULL AS archived,
           COALESCE(SUM(ps.quantity), 0) AS total_quantity,
           ${displayImage(sql)} AS display_image
    FROM products p
    LEFT JOIN product_sizes ps ON ps.product_id = p.id AND ps.color_id IS NOT NULL
    WHERE ${where}
    GROUP BY p.id
    ORDER BY p.created_at DESC NULLS LAST, p.id DESC`;

  return rows.map((r) => ({
    id: Number(r.id),
    itemCode: r.item_code,
    name: r.name,
    brand: r.brand,
    category: r.category,
    subCategory: r.sub_category,
    status: r.status,
    price: Number(r.price),
    bossPrices: isBoss ? { cost: Number(r.cost_price ?? 0), online: Number(r.online_sell_price ?? 0) } : null,
    totalQuantity: Number(r.total_quantity),
    image: r.display_image,
    archived: r.archived,
  }));
}

export type ProductStockRow = { sizeId: number; colourId: number | null; colourName: string; size: string; quantity: number };

export type AdminProductDetail = {
  id: number;
  itemCode: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  status: ProductStatus;
  price: string;
  costPrice: string;
  onlineSellPrice: string;
  description: string;
  arrivalDate: string;
  archived: boolean;
  colourCount: number;
  stock: ProductStockRow[];
};

/** Everything the Edit Product page needs, or null if there's no such product. */
export async function getAdminProduct(sql: Sql, id: number): Promise<AdminProductDetail | null> {
  const [product] = await sql<{
    id: string; item_code: string; name: string; brand: string; category: string; sub_category: string; status: string;
    price: string; cost_price: string | null; online_sell_price: string | null; description: string | null;
    arrival_date: string | null; archived: boolean; colour_count: string;
  }[]>`
    SELECT p.id, p.item_code, p.name, p.brand, p.category, p.sub_category, p.status,
           p.price::text AS price, p.cost_price::text AS cost_price, p.online_sell_price::text AS online_sell_price,
           p.description, p.arrival_date::text AS arrival_date, p.archived_at IS NOT NULL AS archived,
           (SELECT COUNT(*) FROM product_colors pc WHERE pc.product_id = p.id) AS colour_count
    FROM products p
    WHERE p.id = ${id}`;
  if (!product) return null;

  const stock = await sql<{ id: string; color_id: string | null; color_name: string; size: string; quantity: number }[]>`
    SELECT ps.id, ps.color_id, COALESCE(pc.color_name, 'No colour assigned') AS color_name, ps.size, ps.quantity
    FROM product_sizes ps
    LEFT JOIN product_colors pc ON pc.id = ps.color_id
    WHERE ps.product_id = ${id}
    ORDER BY pc.is_default DESC NULLS LAST, pc.color_name ASC, ps.size ASC`;

  return {
    id: Number(product.id),
    itemCode: product.item_code,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subCategory: product.sub_category,
    status: (product.status as ProductStatus) ?? "ACTIVE",
    price: product.price,
    costPrice: product.cost_price ?? "0.00",
    onlineSellPrice: product.online_sell_price ?? "0.00",
    description: product.description ?? "",
    arrivalDate: product.arrival_date ?? "",
    archived: product.archived,
    colourCount: Number(product.colour_count),
    stock: stock.map((s) => ({
      sizeId: Number(s.id),
      colourId: s.color_id === null ? null : Number(s.color_id),
      colourName: s.color_name,
      size: s.size,
      quantity: Number(s.quantity),
    })),
  };
}

export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return err instanceof postgres.PostgresError && err.code === UNIQUE_VIOLATION;
}

async function itemCodeTaken(sql: Sql, itemCode: string, exceptId: number | null): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM products WHERE item_code = ${itemCode} AND (${exceptId}::bigint IS NULL OR id <> ${exceptId}::bigint)`;
  return Boolean(row);
}

const duplicateCode = (itemCode: string): SaveResult => ({
  ok: false,
  error: `Item code "${itemCode}" already exists. Please use a unique code.`,
});

/** Adds a product. Cost and online prices are only saved for bosses (callers pass "0" otherwise). */
export async function createProduct(sql: Sql, input: ProductInput): Promise<SaveResult> {
  if (await itemCodeTaken(sql, input.itemCode, null)) return duplicateCode(input.itemCode);
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO products (item_code, name, brand, category, sub_category, status, price, cost_price, online_sell_price, description, arrival_date)
      VALUES (${input.itemCode}, ${input.name}, ${input.brand}, ${input.category}, ${input.subCategory}, ${input.status},
              ${input.price}, ${input.costPrice}, ${input.onlineSellPrice}, ${input.description}, ${input.arrivalDate})
      RETURNING id`;
    return { ok: true, id: Number(row!.id) };
  } catch (err) {
    // Two admins saving the same new code at once: the database's unique rule catches the second.
    if (isUniqueViolation(err)) return duplicateCode(input.itemCode);
    throw err;
  }
}

/**
 * Saves product details. Stock quantities are never changed here (that's Stock In / Out).
 * Staff admins can't change boss-only prices, even by editing the form by hand.
 * Archived products stay hidden until restored.
 */
export async function updateProduct(sql: Sql, id: number, input: ProductInput, isBoss: boolean): Promise<SaveResult> {
  if (await itemCodeTaken(sql, input.itemCode, id)) return duplicateCode(input.itemCode);
  const bossColumns = isBoss ? sql`, cost_price = ${input.costPrice}, online_sell_price = ${input.onlineSellPrice}` : sql``;
  try {
    const rows = await sql`
      UPDATE products
      SET item_code = ${input.itemCode}, name = ${input.name}, brand = ${input.brand},
          category = ${input.category}, sub_category = ${input.subCategory},
          status = CASE WHEN archived_at IS NULL THEN ${input.status} ELSE 'HIDDEN' END,
          price = ${input.price}, description = ${input.description}, arrival_date = ${input.arrivalDate}
          ${bossColumns}
      WHERE id = ${id}`;
    if (rows.count === 0) return { ok: false, error: "This product no longer exists." };
    return { ok: true, id };
  } catch (err) {
    if (isUniqueViolation(err)) return duplicateCode(input.itemCode);
    throw err;
  }
}

/**
 * Archives a product: hidden from the shop (status HIDDEN, which the PHP site
 * understands too) and from the admin lists. Its stock rows and stock history
 * are kept. Returns the product name, or null if it wasn't found or already archived.
 */
export async function archiveProduct(sql: Sql, id: number): Promise<string | null> {
  const [row] = await sql<{ name: string }[]>`
    UPDATE products SET archived_at = NOW(), status = 'HIDDEN'
    WHERE id = ${id} AND archived_at IS NULL
    RETURNING name`;
  return row?.name ?? null;
}

/** Brings an archived product back. It stays Hidden until an admin sets it to Active. */
export async function restoreProduct(sql: Sql, id: number): Promise<string | null> {
  const [row] = await sql<{ name: string }[]>`
    UPDATE products SET archived_at = NULL
    WHERE id = ${id} AND archived_at IS NOT NULL
    RETURNING name`;
  return row?.name ?? null;
}
