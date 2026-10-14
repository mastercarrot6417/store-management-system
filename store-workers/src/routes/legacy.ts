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
  "/admin/login.php": "/admin/login",
  "/admin/dashboard.php": "/admin",
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

export default legacyRoutes;
