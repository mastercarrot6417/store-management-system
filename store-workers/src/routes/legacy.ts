import { Hono } from "hono";
import type { AppEnv } from "../types";

/**
 * Permanent redirects from the PHP site's addresses, so old links, bookmarks
 * and Google results keep working after the switch.
 */
const legacyRoutes = new Hono<AppEnv>();

/** Old path -> new path. The query string is dropped. */
const MOVED: Record<string, string> = {
  "/legal/cookie_notice.php": "/legal/cookies",
  "/legal/privacy_policy.php": "/legal/privacy",
  "/legal/terms_conditions.php": "/legal/terms",
  "/login.php": "/login",
  "/signup.php": "/signup",
  "/user_page.php": "/account",
  "/logout.php": "/logout",
  "/google_login.php": "/auth/google",
  "/admin/login.php": "/admin/login",
  "/admin/logout.php": "/admin/logout",
  "/admin/dashboard.php": "/admin",
  "/admin/add_product.php": "/admin/products/new",
  "/admin/stock_update.php": "/admin/reports/stock",
};

for (const [from, to] of Object.entries(MOVED)) {
  legacyRoutes.get(from, (c) => c.redirect(to, 301));
}

// index.php?search=...&category=...&sub_category=...  ->  /?same filters
legacyRoutes.get("/index.php", (c) => {
  const url = new URL(c.req.url);
  const kept = new URLSearchParams();
  for (const name of ["search", "category", "sub_category"]) {
    const value = url.searchParams.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.toString();
  return c.redirect(query ? `/?${query}` : "/", 301);
});

// product_detail.php?id=5  ->  /product/5
legacyRoutes.get("/product_detail.php", (c) => {
  const id = c.req.query("id") ?? "";
  return c.redirect(/^\d{1,15}$/.test(id) ? `/product/${id}` : "/", 301);
});

/** Old admin page -> new page, keeping the listed query parameters (renamed where the new page differs). */
const MOVED_WITH_QUERY: Record<string, { to: string; keep: Record<string, string> | "all" }> = {
  "/admin/products.php": { to: "/admin/products", keep: { search: "search", category: "category", subcategory: "sub_category" } },
  "/admin/stock_in.php": { to: "/admin/stock/in", keep: { product_id: "product_id", color_id: "color_id", size: "size" } },
  "/admin/stock_out.php": { to: "/admin/stock/out", keep: { product_id: "product_id", color_id: "color_id", size_id: "size_id", size: "size" } },
  // The report pages already use the same parameter names.
  "/admin/stock_report.php": { to: "/admin/reports/stock", keep: "all" },
  "/admin/export_stock_report.php": { to: "/admin/reports/stock/export.csv", keep: "all" },
  "/admin/print_stock_report.php": { to: "/admin/reports/stock/print", keep: "all" },
};

for (const [from, { to, keep }] of Object.entries(MOVED_WITH_QUERY)) {
  legacyRoutes.get(from, (c) => {
    const old = new URL(c.req.url).searchParams;
    const kept = new URLSearchParams();
    if (keep === "all") {
      for (const [name, value] of old) if (value) kept.append(name, value);
    } else {
      for (const [oldName, newName] of Object.entries(keep)) {
        const value = old.get(oldName);
        if (value) kept.set(newName, value);
      }
    }
    const query = kept.toString();
    return c.redirect(query ? `${to}?${query}` : to, 301);
  });
}

// edit_product.php?id=5 -> /admin/products/5/edit, manage_product_colors.php?product_id=5 -> /admin/products/5/colours
legacyRoutes.get("/admin/edit_product.php", (c) => {
  const id = c.req.query("id") ?? "";
  return c.redirect(/^\d{1,15}$/.test(id) ? `/admin/products/${id}/edit` : "/admin/products", 301);
});
legacyRoutes.get("/admin/manage_product_colors.php", (c) => {
  const id = c.req.query("product_id") ?? "";
  return c.redirect(/^\d{1,15}$/.test(id) ? `/admin/products/${id}/colours` : "/admin/products", 301);
});

export default legacyRoutes;
