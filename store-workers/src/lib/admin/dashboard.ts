import type { Sql } from "../db";
import { LOW_STOCK_LIMIT } from "./inventory";
import type { BossPrices } from "./products";

/**
 * Dashboard figures, ported from admin/dashboard.php. "Variants" are
 * product + colour + size rows. Hidden (and archived) products are left out
 * of the stock figures, as on the PHP dashboard.
 */

export type LowStockVariant = {
  productId: number;
  colourId: number;
  size: string;
  quantity: number;
  name: string;
  category: string;
  colourName: string;
};

export type RecentMovement = {
  createdAt: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
  size: string;
  productName: string;
  colourName: string;
};

export type BossOverview = {
  totalCost: number;
  totalStore: number;
  totalOnline: number;
  products: { id: number; itemCode: string; name: string; price: number; prices: BossPrices; totalQuantity: number }[];
};

export type DashboardData = {
  totalProducts: number;
  activeProducts: number;
  totalStockUnits: number;
  totalVariants: number;
  goodStock: number;
  lowStock: number;
  outOfStock: number;
  productsWithoutStockRows: number;
  totalCustomers: number;
  lowStockVariants: LowStockVariant[];
  recentMovements: RecentMovement[];
  boss: BossOverview | null;
};

export async function getDashboard(sql: Sql, isBoss: boolean): Promise<DashboardData> {
  const [[counts], [variants], lowRows, historyRows, boss] = await Promise.all([
    sql<{ total_products: string; active_products: string; total_units: string; no_stock_rows: string; customers: string }[]>`
      SELECT
        (SELECT COUNT(*) FROM products WHERE status <> 'HIDDEN') AS total_products,
        (SELECT COUNT(*) FROM products WHERE status = 'ACTIVE') AS active_products,
        (SELECT COALESCE(SUM(ps.quantity), 0) FROM product_sizes ps
           JOIN products p ON p.id = ps.product_id
           WHERE ps.color_id IS NOT NULL AND p.archived_at IS NULL) AS total_units,
        (SELECT COUNT(*) FROM products p
           WHERE p.status <> 'HIDDEN'
             AND NOT EXISTS (SELECT 1 FROM product_sizes ps WHERE ps.product_id = p.id AND ps.color_id IS NOT NULL)) AS no_stock_rows,
        (SELECT COUNT(*) FROM customers) AS customers`,
    sql<{ total: string; good: string; low: string; out: string }[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE ps.quantity >= ${LOW_STOCK_LIMIT}) AS good,
             COUNT(*) FILTER (WHERE ps.quantity > 0 AND ps.quantity < ${LOW_STOCK_LIMIT}) AS low,
             COUNT(*) FILTER (WHERE ps.quantity <= 0) AS out
      FROM product_sizes ps
      JOIN products p ON p.id = ps.product_id
      WHERE ps.color_id IS NOT NULL AND p.status <> 'HIDDEN'`,
    sql<{ product_id: string; color_id: string; size: string; quantity: number; name: string; category: string; color_name: string }[]>`
      SELECT ps.product_id, ps.color_id, ps.size, ps.quantity, p.name, p.category,
             COALESCE(pc.color_name, 'N/A') AS color_name
      FROM product_sizes ps
      JOIN products p ON p.id = ps.product_id
      LEFT JOIN product_colors pc ON pc.id = ps.color_id
      WHERE ps.color_id IS NOT NULL AND p.status <> 'HIDDEN' AND ps.quantity < ${LOW_STOCK_LIMIT}
      ORDER BY ps.quantity ASC, p.name ASC, pc.color_name ASC, ps.size ASC
      LIMIT 8`,
    sql<{ created_at: string; type: string; quantity: number; reason: string | null; size: string; product_name: string; color_name: string }[]>`
      SELECT sh.created_at, sh.type, sh.quantity, sh.reason, sh.size, p.name AS product_name,
             COALESCE(pc.color_name, 'N/A') AS color_name
      FROM stock_history sh
      JOIN products p ON p.id = sh.product_id
      LEFT JOIN product_colors pc ON pc.id = sh.color_id
      ORDER BY sh.created_at DESC, sh.id DESC
      LIMIT 8`,
    isBoss ? getBossOverview(sql) : Promise.resolve(null),
  ]);

  return {
    totalProducts: Number(counts!.total_products),
    activeProducts: Number(counts!.active_products),
    totalStockUnits: Number(counts!.total_units),
    totalVariants: Number(variants!.total),
    goodStock: Number(variants!.good),
    lowStock: Number(variants!.low),
    outOfStock: Number(variants!.out),
    productsWithoutStockRows: Number(counts!.no_stock_rows),
    totalCustomers: Number(counts!.customers),
    lowStockVariants: lowRows.map((r) => ({
      productId: Number(r.product_id),
      colourId: Number(r.color_id),
      size: r.size,
      quantity: Number(r.quantity),
      name: r.name,
      category: r.category,
      colourName: r.color_name,
    })),
    recentMovements: historyRows.map((r) => ({
      createdAt: r.created_at,
      type: r.type === "IN" ? "IN" : "OUT",
      quantity: Number(r.quantity),
      reason: r.reason ?? "",
      size: r.size,
      productName: r.product_name,
      colourName: r.color_name,
    })),
    boss,
  };
}

/** Boss-only: stock value at cost, store and online prices, and the newest products' prices. */
async function getBossOverview(sql: Sql): Promise<BossOverview> {
  const [[totals], products] = await Promise.all([
    sql<{ cost: string; store: string; online: string }[]>`
      SELECT COALESCE(SUM(COALESCE(p.cost_price, 0) * stock.qty), 0) AS cost,
             COALESCE(SUM(COALESCE(p.price, 0) * stock.qty), 0) AS store,
             COALESCE(SUM(COALESCE(p.online_sell_price, 0) * stock.qty), 0) AS online
      FROM products p
      JOIN (
        SELECT product_id, SUM(quantity) AS qty FROM product_sizes
        WHERE color_id IS NOT NULL GROUP BY product_id
      ) stock ON stock.product_id = p.id
      WHERE p.archived_at IS NULL`,
    sql<{ id: string; item_code: string; name: string; price: string; cost_price: string | null; online_sell_price: string | null; total_quantity: string }[]>`
      SELECT p.id, p.item_code, p.name, p.price, p.cost_price, p.online_sell_price,
             COALESCE(SUM(ps.quantity), 0) AS total_quantity
      FROM products p
      LEFT JOIN product_sizes ps ON ps.product_id = p.id AND ps.color_id IS NOT NULL
      WHERE p.archived_at IS NULL
      GROUP BY p.id
      ORDER BY p.created_at DESC NULLS LAST, p.id DESC
      LIMIT 8`,
  ]);
  return {
    totalCost: Number(totals!.cost),
    totalStore: Number(totals!.store),
    totalOnline: Number(totals!.online),
    products: products.map((p) => ({
      id: Number(p.id),
      itemCode: p.item_code,
      name: p.name,
      price: Number(p.price),
      prices: { cost: Number(p.cost_price ?? 0), online: Number(p.online_sell_price ?? 0) },
      totalQuantity: Number(p.total_quantity),
    })),
  };
}
