import { Hono, type Context } from "hono";
import { raw } from "hono/html";
import { storeMapLink } from "../lib/config";
import { featuredProducts, getProductPage, listProducts, newArrivals, type ProductFilters } from "../lib/products";
import { customerSessionMiddleware } from "../lib/session";
import type { AppEnv } from "../types";
import cookiesHtml from "../views/legal/cookies.html";
import privacyHtml from "../views/legal/privacy.html";
import termsHtml from "../views/legal/terms.html";
import { HomePage } from "../views/public/HomePage";
import { ProductPage } from "../views/public/ProductPage";
import { ResultsPage } from "../views/public/ResultsPage";
import accountRoutes from "./account";
import { renderPublic } from "./render";

const publicRoutes = new Hono<AppEnv>();

publicRoutes.use("*", customerSessionMiddleware);

// Login, sign-up, account and Google login (src/routes/account.tsx).
publicRoutes.route("/", accountRoutes);

/** Reads a text query parameter, trimmed and length-limited. */
function queryText(c: Context<AppEnv>, name: string): string {
  return (c.req.query(name) ?? "").trim().slice(0, 100);
}

// ---- Homepage, or search / category results ----
publicRoutes.get("/", async (c) => {
  const filters: ProductFilters = {
    search: queryText(c, "search"),
    category: queryText(c, "category"),
    subCategory: queryText(c, "sub_category"),
  };
  const isFiltered = Boolean(filters.search || filters.category || filters.subCategory);
  const active = filters.category || (filters.search ? null : "home");

  if (isFiltered) {
    const products = await listProducts(c.var.dbCached, filters);
    const heading = filters.category || (filters.search ? `Search: ${filters.search}` : "Products");
    return renderPublic(c, { title: `${heading} — My Dream Bike`, active, search: filters.search }, (
      <ResultsPage products={products} filters={filters} />
    ));
  }

  const [arrivals, featured] = await Promise.all([newArrivals(c.var.dbCached), featuredProducts(c.var.dbCached)]);
  return renderPublic(c, { title: "My Dream Bike — Premium Helmet Store", active }, (
    <HomePage
      newArrivals={arrivals}
      featured={featured}
      mapLink={storeMapLink(c.env)}
      mapsApiKey={c.env.GOOGLE_MAPS_API_KEY}
      mapQuery={c.env.COMPANY_MAP_QUERY}
    />
  ));
});

// ---- Product page ----
publicRoutes.get("/product/:id", async (c) => {
  const idText = c.req.param("id");
  // Digits only, and small enough to be a valid BIGINT.
  if (!/^\d{1,15}$/.test(idText)) return c.notFound();

  const product = await getProductPage(c.var.dbCached, Number(idText));
  if (!product) return c.notFound();

  const description = `${product.name} - ${product.description}`.slice(0, 300);
  return renderPublic(
    c,
    {
      title: `${product.name} - My Dream Bike`,
      description,
      active: product.category,
      bodyClass: "product-detail-page",
      extraStylesheets: ["/assets/css/product_detail.css"],
      extraScripts: ["/assets/js/product_detail.js"],
    },
    <ProductPage product={product} />,
  );
});

// ---- Legal pages (static text copied from legal/*.php) ----
const LEGAL_PAGES: Record<string, { title: string; bodyClass: string; html: string }> = {
  cookies: { title: "Cookie Notice", bodyClass: "legal-page legal-cookie-page", html: cookiesHtml },
  privacy: { title: "Privacy Policy", bodyClass: "legal-page legal-privacy-page", html: privacyHtml },
  terms: { title: "Terms & Conditions", bodyClass: "legal-page legal-terms-page", html: termsHtml },
};

publicRoutes.get("/legal/:page", (c) => {
  const page = LEGAL_PAGES[c.req.param("page")];
  if (!page) return c.notFound();
  return renderPublic(
    c,
    { title: `${page.title} — My Dream Bike`, bodyClass: page.bodyClass, extraStylesheets: ["/assets/css/legal_pages.css"] },
    raw(page.html),
  );
});

export default publicRoutes;
