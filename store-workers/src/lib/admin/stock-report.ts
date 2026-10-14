import type { Sql } from "../db";
import { escapeLike } from "../products";
import { LOW_STOCK_LIMIT } from "./inventory";

/**
 * The stock report, ported from admin/stock_report.php,
 * includes/stock_report_queries.php, export_stock_report.php and
 * print_stock_report.php. The page, the CSV export and the print view all
 * read the same filters from the address, so they always show the same rows.
 *
 * The address keeps the PHP page's parameter names (current_search,
 * history_type, date_from, ...) so old bookmarks still work after redirect.
 */

export const PAGE_SIZE = 10;
/** Export and print show every matching row, up to this many. */
export const EXPORT_LIMIT = 20_000;

const STATUS_VALUES = ["", "low", "out", "in"] as const;
export type StatusFilter = (typeof STATUS_VALUES)[number];

export const CURRENT_SORTS = {
  name_asc: "Name A-Z",
  item_code_asc: "Item Code A-Z",
  category_asc: "Category",
  qty_asc: "Quantity Low to High",
  qty_desc: "Quantity High to Low",
  arrival_desc: "Newest Arrival",
} as const;
export type CurrentSort = keyof typeof CURRENT_SORTS;

export type CurrentFilters = {
  search: string;
  productId: number;
  colourId: number;
  size: string;
  category: string;
  subCategory: string;
  status: StatusFilter;
  sort: CurrentSort;
};

export type HistoryFilters = {
  search: string;
  productId: number;
  colourId: number;
  size: string;
  type: "" | "IN" | "OUT";
  category: string;
  subCategory: string;
  dateFrom: string;
  dateTo: string;
};

function param(q: URLSearchParams, name: string, maxLength = 100): string {
  return (q.get(name) ?? "").trim().slice(0, maxLength);
}

function idParam(q: URLSearchParams, name: string): number {
  const value = param(q, name, 15);
  return /^\d+$/.test(value) ? Number(value) : 0;
}

function dateParam(q: URLSearchParams, name: string): string {
  const value = param(q, name, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : "";
}

export function pageParam(q: URLSearchParams, name: string): number {
  const value = param(q, name, 6);
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : 1;
}

export function readCurrentFilters(q: URLSearchParams): CurrentFilters {
  const status = param(q, "current_status");
  const sort = param(q, "current_sort");
  return {
    search: param(q, "current_search"),
    productId: idParam(q, "current_product_id"),
    colourId: idParam(q, "current_color_id"),
    size: param(q, "current_size"),
    category: param(q, "current_category"),
    subCategory: param(q, "current_subcategory"),
    status: (STATUS_VALUES as readonly string[]).includes(status) ? (status as StatusFilter) : "",
    sort: sort in CURRENT_SORTS ? (sort as CurrentSort) : "name_asc",
  };
}

export function readHistoryFilters(q: URLSearchParams): HistoryFilters {
  const type = param(q, "history_type").toUpperCase();
  return {
    search: param(q, "history_search"),
    productId: idParam(q, "history_product_id"),
    colourId: idParam(q, "history_color_id"),
    size: param(q, "history_size"),
    type: type === "IN" || type === "OUT" ? type : "",
    category: param(q, "history_category"),
    subCategory: param(q, "history_subcategory"),
    dateFrom: dateParam(q, "date_from"),
    dateTo: dateParam(q, "date_to"),
  };
}

function currentWhere(sql: Sql, f: CurrentFilters) {
  // Archived products have left the shop, so they're not part of current stock (their history stays).
  const conditions = [sql`p.archived_at IS NULL`];
  if (f.search) {
    const like = `%${escapeLike(f.search)}%`;
    conditions.push(sql`(p.item_code ILIKE ${like} OR p.name ILIKE ${like} OR p.brand ILIKE ${like} OR p.category ILIKE ${like}
      OR p.sub_category ILIKE ${like} OR ps.size ILIKE ${like} OR pc.color_name ILIKE ${like})`);
  }
  if (f.productId) conditions.push(sql`p.id = ${f.productId}`);
  if (f.colourId) conditions.push(sql`ps.color_id = ${f.colourId}`);
  if (f.size) conditions.push(sql`LOWER(TRIM(ps.size)) = LOWER(TRIM(${f.size}))`);
  if (f.category) conditions.push(sql`p.category = ${f.category}`);
  if (f.subCategory) conditions.push(sql`p.sub_category = ${f.subCategory}`);
  if (f.status === "out") conditions.push(sql`ps.quantity <= 0`);
  if (f.status === "low") conditions.push(sql`ps.quantity > 0 AND ps.quantity < ${LOW_STOCK_LIMIT}`);
  if (f.status === "in") conditions.push(sql`ps.quantity >= ${LOW_STOCK_LIMIT}`);
  return conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);
}

function currentOrder(sql: Sql, sort: CurrentSort) {
  switch (sort) {
    case "item_code_asc": return sql`p.item_code ASC, pc.color_name ASC, ps.size ASC`;
    case "category_asc": return sql`p.category ASC, p.sub_category ASC, p.name ASC, pc.color_name ASC`;
    case "qty_asc": return sql`ps.quantity ASC, p.name ASC, pc.color_name ASC`;
    case "qty_desc": return sql`ps.quantity DESC, p.name ASC, pc.color_name ASC`;
    case "arrival_desc": return sql`p.arrival_date DESC NULLS LAST, p.name ASC, pc.color_name ASC`;
    default: return sql`p.name ASC, pc.color_name ASC, ps.size ASC`;
  }
}

function historyWhere(sql: Sql, f: HistoryFilters) {
  const conditions = [sql`TRUE`];
  if (f.search) {
    const like = `%${escapeLike(f.search)}%`;
    conditions.push(sql`(p.item_code ILIKE ${like} OR p.name ILIKE ${like} OR p.category ILIKE ${like} OR p.sub_category ILIKE ${like}
      OR sh.size ILIKE ${like} OR pc.color_name ILIKE ${like} OR sh.reason ILIKE ${like} OR sh.note ILIKE ${like}
      OR sh.edited_by_admin_name ILIKE ${like})`);
  }
  if (f.productId) conditions.push(sql`p.id = ${f.productId}`);
  if (f.colourId) conditions.push(sql`sh.color_id = ${f.colourId}`);
  if (f.size) conditions.push(sql`LOWER(TRIM(sh.size)) = LOWER(TRIM(${f.size}))`);
  if (f.type) conditions.push(sql`sh.type = ${f.type}`);
  if (f.category) conditions.push(sql`p.category = ${f.category}`);
  if (f.subCategory) conditions.push(sql`p.sub_category = ${f.subCategory}`);
  // created_at holds Malaysia wall-clock time, so comparing dates directly matches the shop's days.
  if (f.dateFrom) conditions.push(sql`sh.created_at >= ${f.dateFrom}::date`);
  if (f.dateTo) conditions.push(sql`sh.created_at < ${f.dateTo}::date + 1`);
  return conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);
}

const CURRENT_FROM = (sql: Sql) => sql`
  FROM products p
  JOIN product_sizes ps ON ps.product_id = p.id
  LEFT JOIN product_colors pc ON pc.id = ps.color_id`;

const HISTORY_FROM = (sql: Sql) => sql`
  FROM stock_history sh
  JOIN products p ON p.id = sh.product_id
  LEFT JOIN product_colors pc ON pc.id = sh.color_id`;

export type CurrentStockRow = {
  productId: number;
  itemCode: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  price: number;
  onlinePrice: number;
  arrivalDate: string;
  sizeId: number;
  colourId: number | null;
  colourName: string;
  size: string;
  quantity: number;
  image: string | null;
};

type CurrentRowDb = {
  id: string; item_code: string; name: string; brand: string; category: string; sub_category: string;
  price: string; online_sell_price: string | null; arrival_date: string | null;
  size_id: string; color_id: string | null; color_name: string; size: string; quantity: number; display_image: string | null;
};

function toCurrentRow(r: CurrentRowDb): CurrentStockRow {
  return {
    productId: Number(r.id),
    itemCode: r.item_code,
    name: r.name,
    brand: r.brand,
    category: r.category,
    subCategory: r.sub_category,
    price: Number(r.price),
    onlinePrice: Number(r.online_sell_price ?? 0),
    arrivalDate: r.arrival_date ?? "",
    sizeId: Number(r.size_id),
    colourId: r.color_id === null ? null : Number(r.color_id),
    colourName: r.color_name,
    size: r.size,
    quantity: Number(r.quantity),
    image: r.display_image,
  };
}

/** The variant's own colour photo first, then the product's default photo, then the legacy image. */
function variantImage(sql: Sql) {
  return sql`COALESCE(
    (SELECT pi.image_path FROM product_images pi
     WHERE pi.product_id = p.id AND pi.color_id = ps.color_id
     ORDER BY pi.is_main DESC, pi.sort_order ASC, pi.id ASC LIMIT 1),
    (SELECT pi2.image_path FROM product_images pi2
     LEFT JOIN product_colors pc2 ON pc2.id = pi2.color_id
     WHERE pi2.product_id = p.id
     ORDER BY COALESCE(pc2.is_default, FALSE) DESC, pi2.is_main DESC, pi2.sort_order ASC, pi2.id ASC LIMIT 1),
    NULLIF(p.image, ''))`;
}

async function selectCurrent(sql: Sql, f: CurrentFilters, limit: number, offset: number, withImages: boolean) {
  const rows = await sql<CurrentRowDb[]>`
    SELECT p.id, p.item_code, p.name, p.brand, p.category, p.sub_category, p.price, p.online_sell_price,
           p.arrival_date::text AS arrival_date, ps.id AS size_id, ps.color_id,
           COALESCE(pc.color_name, 'No colour assigned') AS color_name, ps.size, ps.quantity,
           ${withImages ? variantImage(sql) : sql`NULL`} AS display_image
    ${CURRENT_FROM(sql)}
    WHERE ${currentWhere(sql, f)}
    ORDER BY ${currentOrder(sql, f.sort)}, ps.id ASC
    LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(toCurrentRow);
}

export type Paged<T> = { rows: T[]; total: number; page: number; totalPages: number };

export async function currentStockPage(sql: Sql, f: CurrentFilters, requestedPage: number): Promise<Paged<CurrentStockRow>> {
  const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count ${CURRENT_FROM(sql)} WHERE ${currentWhere(sql, f)}`;
  const total = Number(countRow!.count);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const rows = await selectCurrent(sql, f, PAGE_SIZE, (page - 1) * PAGE_SIZE, true);
  return { rows, total, page, totalPages };
}

export function allCurrentStock(sql: Sql, f: CurrentFilters): Promise<CurrentStockRow[]> {
  return selectCurrent(sql, f, EXPORT_LIMIT, 0, false);
}

export type MovementRow = {
  createdAt: string;
  itemCode: string;
  productName: string;
  category: string;
  subCategory: string;
  colourName: string;
  size: string;
  type: "IN" | "OUT";
  before: number;
  quantity: number;
  after: number;
  reason: string;
  note: string;
  editedBy: string;
};

async function selectHistory(sql: Sql, f: HistoryFilters, limit: number, offset: number): Promise<MovementRow[]> {
  const rows = await sql<{
    created_at: string; item_code: string; product_name: string; category: string; sub_category: string; color_name: string;
    size: string; type: string; quantity_before: number | null; quantity: number; quantity_after: number | null;
    reason: string | null; note: string | null; edited_by_admin_name: string | null;
  }[]>`
    SELECT sh.created_at, p.item_code, p.name AS product_name, p.category, p.sub_category,
           COALESCE(pc.color_name, 'No colour recorded') AS color_name, sh.size, sh.type,
           sh.quantity_before, sh.quantity, sh.quantity_after, sh.reason, sh.note, sh.edited_by_admin_name
    ${HISTORY_FROM(sql)}
    WHERE ${historyWhere(sql, f)}
    ORDER BY sh.created_at DESC, sh.id DESC
    LIMIT ${limit} OFFSET ${offset}`;
  return rows.map((r) => ({
    createdAt: r.created_at,
    itemCode: r.item_code,
    productName: r.product_name,
    category: r.category,
    subCategory: r.sub_category,
    colourName: r.color_name,
    size: r.size,
    type: r.type === "IN" ? "IN" : "OUT",
    before: Number(r.quantity_before ?? 0),
    quantity: Number(r.quantity),
    after: Number(r.quantity_after ?? 0),
    reason: r.reason ?? "",
    note: r.note ?? "",
    editedBy: r.edited_by_admin_name || "Not recorded",
  }));
}

export async function historyPage(sql: Sql, f: HistoryFilters, requestedPage: number): Promise<Paged<MovementRow>> {
  const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count ${HISTORY_FROM(sql)} WHERE ${historyWhere(sql, f)}`;
  const total = Number(countRow!.count);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  return { rows: await selectHistory(sql, f, PAGE_SIZE, (page - 1) * PAGE_SIZE), total, page, totalPages };
}

export function allHistory(sql: Sql, f: HistoryFilters): Promise<MovementRow[]> {
  return selectHistory(sql, f, EXPORT_LIMIT, 0);
}

export type ReportSummary = {
  totalProducts: number;
  totalUnits: number;
  goodVariants: number;
  lowVariants: number;
  outVariants: number;
  /** Boss only: units x online price (or store price when no online price is set). */
  stockValue: number | null;
  legacyStockRows: number;
  legacyHistoryRows: number;
};

export async function reportSummary(sql: Sql, isBoss: boolean): Promise<ReportSummary> {
  const [row] = await sql<{
    products: string; units: string; good: string; low: string; out: string; value: string | null; legacy_stock: string; legacy_history: string;
  }[]>`
    SELECT
      (SELECT COUNT(*) FROM products WHERE archived_at IS NULL) AS products,
      COALESCE(SUM(ps.quantity), 0) AS units,
      COUNT(*) FILTER (WHERE ps.quantity >= ${LOW_STOCK_LIMIT}) AS good,
      COUNT(*) FILTER (WHERE ps.quantity > 0 AND ps.quantity < ${LOW_STOCK_LIMIT}) AS low,
      COUNT(*) FILTER (WHERE ps.quantity <= 0) AS out,
      ${isBoss
        ? sql`COALESCE(SUM(ps.quantity * CASE WHEN COALESCE(p.online_sell_price, 0) > 0 THEN p.online_sell_price ELSE p.price END), 0)`
        : sql`NULL`} AS value,
      COUNT(*) FILTER (WHERE ps.color_id IS NULL) AS legacy_stock,
      (SELECT COUNT(*) FROM stock_history WHERE color_id IS NULL) AS legacy_history
    FROM product_sizes ps
    JOIN products p ON p.id = ps.product_id AND p.archived_at IS NULL`;
  return {
    totalProducts: Number(row!.products),
    totalUnits: Number(row!.units),
    goodVariants: Number(row!.good),
    lowVariants: Number(row!.low),
    outVariants: Number(row!.out),
    stockValue: isBoss ? Number(row!.value ?? 0) : null,
    legacyStockRows: Number(row!.legacy_stock),
    legacyHistoryRows: Number(row!.legacy_history),
  };
}

export type FilterOptions = {
  categories: string[];
  subCategories: string[];
  products: { id: number; label: string }[];
  colours: { id: number; name: string }[];
  sizes: string[];
};

/** Dropdown choices, taken from what's actually in the database (as the PHP page did). */
export async function reportFilterOptions(sql: Sql): Promise<FilterOptions> {
  const [categories, subCategories, products, colours, sizes] = await Promise.all([
    sql<{ v: string }[]>`SELECT DISTINCT category AS v FROM products WHERE category <> '' ORDER BY v`,
    sql<{ v: string }[]>`SELECT DISTINCT sub_category AS v FROM products WHERE sub_category <> '' ORDER BY v`,
    sql<{ id: string; item_code: string; name: string }[]>`SELECT id, item_code, name FROM products ORDER BY name ASC, id ASC`,
    sql<{ id: string; color_name: string }[]>`
      SELECT DISTINCT pc.id, pc.color_name FROM product_colors pc
      JOIN product_sizes ps ON ps.color_id = pc.id
      ORDER BY pc.color_name ASC, pc.id ASC`,
    sql<{ v: string }[]>`SELECT DISTINCT TRIM(size) AS v FROM product_sizes WHERE TRIM(size) <> '' ORDER BY v`,
  ]);
  return {
    categories: categories.map((r) => r.v),
    subCategories: subCategories.map((r) => r.v),
    products: products.map((p) => ({ id: Number(p.id), label: p.item_code ? `${p.item_code} - ${p.name}` : p.name })),
    colours: colours.map((c) => ({ id: Number(c.id), name: c.color_name })),
    sizes: sizes.map((r) => r.v),
  };
}
