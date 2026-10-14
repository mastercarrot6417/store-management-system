import type { Sql } from "./db";

/**
 * Product queries for the public shop, ported from index.php and
 * product_detail.php. They select only the columns the pages show, so
 * boss-only prices (cost_price, online_sell_price) never leave the database.
 *
 * Public pages call these with the cached client (`c.var.dbCached`), so stock
 * shown here can be up to a minute old. Checkout must re-check stock uncached.
 */

export type ProductCard = {
  id: number;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  status: string;
  price: number;
  totalQuantity: number;
  /** Path as stored in the database, e.g. "uploads/pimg_1_2_abc.jpg". */
  image: string | null;
};

type ProductCardRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  sub_category: string;
  status: string;
  price: string;
  total_quantity: string;
  display_image: string | null;
};

function toCard(row: ProductCardRow): ProductCard {
  return {
    id: Number(row.id),
    name: row.name,
    brand: row.brand,
    category: row.category,
    subCategory: row.sub_category,
    status: row.status,
    price: Number(row.price),
    totalQuantity: Number(row.total_quantity),
    image: row.display_image,
  };
}

/** Same rule as the PHP pages: only ACTIVE products with stock count as in stock. */
export function isInStock(p: { status: string; totalQuantity: number }): boolean {
  return p.status === "ACTIVE" && p.totalQuantity > 0;
}

/** The product's card image: default colour's main image first, then the legacy products.image column. */
function displayImage(sql: Sql) {
  return sql`COALESCE(
    (SELECT pi.image_path
     FROM product_images pi
     INNER JOIN product_colors pc ON pc.id = pi.color_id
     WHERE pi.product_id = p.id
     ORDER BY pc.is_default DESC, pi.is_main DESC, pi.sort_order ASC, pi.id ASC
     LIMIT 1),
    NULLIF(p.image, '')
  )`;
}

/** SELECT ... FROM ... for product cards; callers add WHERE / GROUP BY / ORDER BY. */
function cardSelect(sql: Sql) {
  return sql`
    SELECT p.id, p.name, p.brand, p.category, p.sub_category, p.status, p.price,
           COALESCE(SUM(ps.quantity), 0) AS total_quantity,
           ${displayImage(sql)} AS display_image
    FROM products p
    LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL`;
}

/** Makes % and _ in the search text match literally instead of acting as wildcards. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

export type ProductFilters = { search: string; category: string; subCategory: string };

/** Search / category results. Hidden products are excluded; out-of-stock ones are shown. */
export async function listProducts(sql: Sql, filters: ProductFilters): Promise<ProductCard[]> {
  const conditions = [sql`p.status <> 'HIDDEN'`];
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(sql`(p.name ILIKE ${pattern} OR p.item_code ILIKE ${pattern} OR p.brand ILIKE ${pattern})`);
  }
  if (filters.category) conditions.push(sql`p.category = ${filters.category}`);
  if (filters.subCategory) conditions.push(sql`p.sub_category = ${filters.subCategory}`);

  const where = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);
  const rows = await sql<ProductCardRow[]>`
    ${cardSelect(sql)}
    WHERE ${where}
    GROUP BY p.id
    ORDER BY p.created_at DESC`;
  return rows.map(toCard);
}

/** Homepage "Featured Helmet Collection": the 4 newest active products that have stock. */
export async function featuredProducts(sql: Sql): Promise<ProductCard[]> {
  const rows = await sql<ProductCardRow[]>`
    ${cardSelect(sql)}
    WHERE p.status = 'ACTIVE'
    GROUP BY p.id
    HAVING COALESCE(SUM(ps.quantity), 0) > 0
    ORDER BY p.created_at DESC
    LIMIT 4`;
  return rows.map(toCard);
}

/** Homepage "New Arrivals": the 2 most recently arrived active products. */
export async function newArrivals(sql: Sql): Promise<ProductCard[]> {
  const rows = await sql<ProductCardRow[]>`
    ${cardSelect(sql)}
    WHERE p.status = 'ACTIVE'
    GROUP BY p.id
    ORDER BY p.arrival_date DESC NULLS LAST, p.created_at DESC
    LIMIT 2`;
  return rows.map(toCard);
}

// ---------------------------------------------------------------------------
// Product page
// ---------------------------------------------------------------------------

export type ProductColour = { id: number; name: string; code: string; isDefault: boolean };
export type ProductImage = { colorKey: string; path: string; colorName: string | null };
export type SizeOption = { label: string; quantity: number };

export type ProductPageData = {
  id: number;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  status: string;
  price: number;
  description: string;
  legacyImage: string | null;
  totalQuantity: number;
  colours: ProductColour[];
  /** Images grouped by colour ID (as a string), or "default" for images without a colour. */
  imagesByColour: Record<string, ProductImage[]>;
  /** Sizes grouped the same way, in shop order (XS, S, M, L, XL, ...). */
  sizesByColour: Record<string, SizeOption[]>;
  /** Every size label across all colours, without duplicates. */
  allSizeLabels: string[];
  discoverMore: ProductCard[];
};

/** Only real hex colours reach the page's inline style. */
export function safeColourCode(code: string): string {
  return /^#[0-9a-f]{6}$/i.test(code) ? code : "#000000";
}

/** Product page data, or null if the product doesn't exist or is hidden. */
export async function getProductPage(sql: Sql, id: number): Promise<ProductPageData | null> {
  const [product] = await sql<{
    id: string; name: string; brand: string; category: string; sub_category: string; status: string;
    price: string; description: string | null; image: string | null; total_quantity: string;
  }[]>`
    SELECT p.id, p.name, p.brand, p.category, p.sub_category, p.status, p.price, p.description, p.image,
           COALESCE(SUM(ps.quantity), 0) AS total_quantity
    FROM products p
    LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
    WHERE p.id = ${id} AND p.status <> 'HIDDEN'
    GROUP BY p.id`;
  if (!product) return null;

  const [colourRows, imageRows, sizeRows, discoverMore] = await Promise.all([
    sql<{ id: string; color_name: string; color_code: string; is_default: boolean }[]>`
      SELECT id, color_name, color_code, is_default
      FROM product_colors
      WHERE product_id = ${id}
      ORDER BY is_default DESC, id ASC`,
    sql<{ color_id: string | null; image_path: string; color_name: string | null }[]>`
      SELECT pi.color_id, pi.image_path, pc.color_name
      FROM product_images pi
      LEFT JOIN product_colors pc ON pi.color_id = pc.id
      WHERE pi.product_id = ${id}
      ORDER BY COALESCE(pc.is_default, FALSE) DESC, COALESCE(pi.is_main, FALSE) DESC, pi.sort_order ASC, pi.id ASC`,
    sql<{ color_id: string | null; size: string; quantity: number }[]>`
      SELECT color_id, TRIM(size) AS size, COALESCE(quantity, 0) AS quantity
      FROM product_sizes
      WHERE product_id = ${id} AND NULLIF(TRIM(size), '') IS NOT NULL
      ORDER BY
        CASE UPPER(TRIM(size))
          WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
          WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN 'XXXL' THEN 7 WHEN 'FREE SIZE' THEN 8
          ELSE 99
        END,
        size ASC`,
    discoverMoreProducts(sql, id, product.category, product.sub_category),
  ]);

  const imagesByColour: Record<string, ProductImage[]> = {};
  for (const row of imageRows) {
    const key = row.color_id ?? "default";
    (imagesByColour[key] ??= []).push({ colorKey: key, path: row.image_path, colorName: row.color_name });
  }

  const sizesByColour: Record<string, SizeOption[]> = {};
  const allSizeLabels = new Set<string>();
  for (const row of sizeRows) {
    const key = row.color_id ?? "default";
    (sizesByColour[key] ??= []).push({ label: row.size, quantity: Number(row.quantity) });
    allSizeLabels.add(row.size);
  }

  return {
    id: Number(product.id),
    name: product.name,
    brand: product.brand,
    category: product.category,
    subCategory: product.sub_category,
    status: product.status,
    price: Number(product.price),
    description: product.description ?? "",
    legacyImage: product.image || null,
    totalQuantity: Number(product.total_quantity),
    colours: colourRows.map((c) => ({
      id: Number(c.id),
      name: c.color_name,
      code: safeColourCode(c.color_code),
      isDefault: c.is_default,
    })),
    imagesByColour,
    sizesByColour,
    allSizeLabels: [...allSizeLabels],
    discoverMore,
  };
}

/** Up to 6 other active products: same sub-category first, then the same category. */
async function discoverMoreProducts(sql: Sql, productId: number, category: string, subCategory: string): Promise<ProductCard[]> {
  const found: ProductCard[] = [];
  if (subCategory) {
    const rows = await sql<ProductCardRow[]>`
      ${cardSelect(sql)}
      WHERE p.id <> ${productId} AND p.status = 'ACTIVE' AND p.category = ${category} AND p.sub_category = ${subCategory}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 6`;
    found.push(...rows.map(toCard));
  }
  if (found.length < 6 && category) {
    const excluded = [productId, ...found.map((p) => p.id)];
    const rows = await sql<ProductCardRow[]>`
      ${cardSelect(sql)}
      WHERE p.status = 'ACTIVE' AND p.category = ${category} AND p.id NOT IN ${sql(excluded)}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ${6 - found.length}`;
    found.push(...rows.map(toCard));
  }
  return found;
}
