import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createProduct, fetchApp, inStockProduct, testSql } from "./helpers";

async function html(path: string): Promise<string> {
  const res = await fetchApp(path);
  expect(res.status).toBe(200);
  return res.text();
}

/** Extracts and parses the product page's JSON data block. */
function productData(page: string) {
  const match = page.match(/<script type="application\/json" id="product-data">([\s\S]*?)<\/script>/);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]!);
}

describe("homepage", () => {
  it("shows the landing sections with new arrivals and featured products", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, inStockProduct({ arrivalDate: "2099-12-31" }));

    const page = await html("/");
    expect(page).toContain('class="hero-section reveal-on-scroll"');
    expect(page).toContain('id="new-arrivals"');
    expect(page).toContain('id="trending"');
    expect(page).toContain('class="brand-logo-marquee reveal-on-scroll"');
    // Newest arrival date, so it's in New Arrivals.
    expect(page).toContain(product.name);
    expect(page).toContain(`href="/product/${product.id}"`);
    // Image links work from any page.
    expect(page).toContain('src="/uploads/test-black.jpg"');
    // Brands without a logo file show their name.
    expect(page).toContain('<span class="brand-logo-fallback">GRAYFOSH</span>');
  });

  it("shows the map placeholder when no Google Maps key is set", async () => {
    const page = await html("/");
    expect(page).toContain("Find us in-store");
    expect(page).not.toContain("maps/embed");
  });

  it("never shows hidden products", async () => {
    const sql = await testSql();
    const hidden = await createProduct(sql, inStockProduct({ status: "HIDDEN", arrivalDate: "2099-12-31" }));
    expect(await html("/")).not.toContain(hidden.name);
    // The search words appear in the heading, so check for the product's link instead of its name.
    const results = await html(`/?search=${encodeURIComponent(hidden.name)}`);
    expect(results).not.toContain(`href="/product/${hidden.id}"`);
    expect(results).toContain("No products found.");
  });

  it("never sends boss-only prices to the browser", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, inStockProduct({ price: 250, costPrice: 123.45, onlineSellPrice: 678.9, arrivalDate: "2099-12-31" }));
    for (const path of ["/", `/?search=${encodeURIComponent(product.name)}`, `/product/${product.id}`]) {
      const page = await html(path);
      expect(page).toContain("250.00");
      expect(page).not.toContain("123.45");
      expect(page).not.toContain("678.9");
    }
  });
});

describe("search and category results", () => {
  it("finds products by name, item code or brand, ignoring case", async () => {
    const sql = await testSql();
    const marker = crypto.randomUUID().slice(0, 8);
    const byName = await createProduct(sql, { name: `Zeta ${marker} Helmet` });
    const byCode = await createProduct(sql, { itemCode: `CODE-${marker}` });
    const byBrand = await createProduct(sql, { brand: `Brand${marker}` });

    const page = await html(`/?search=${marker.toUpperCase()}`);
    expect(page).toContain(byName.name);
    expect(page).toContain(byCode.name);
    expect(page).toContain(byBrand.name);
    expect(page).toContain(`Results for “${marker.toUpperCase()}”`);
  });

  it("treats % and _ in the search as normal characters", async () => {
    const sql = await testSql();
    await createProduct(sql);
    expect(await html("/?search=%25%25%25")).toContain("No products found.");
    expect(await html("/?search=____")).toContain("No products found.");
  });

  it("filters by category and sub-category", async () => {
    const sql = await testSql();
    const marker = crypto.randomUUID().slice(0, 8);
    const gloves = await createProduct(sql, { name: `Gloves ${marker}`, category: "Apparel", subCategory: "Gloves" });
    const jacket = await createProduct(sql, { name: `Jacket ${marker}`, category: "Apparel", subCategory: "Jackets" });

    const apparel = await html("/?category=Apparel");
    expect(apparel).toContain(gloves.name);
    expect(apparel).toContain(jacket.name);
    expect(apparel).toContain('class="nav-menu-link active"');

    const onlyGloves = await html("/?category=Apparel&sub_category=Gloves");
    expect(onlyGloves).toContain(gloves.name);
    expect(onlyGloves).not.toContain(jacket.name);
    expect(onlyGloves).toContain("Apparel › Gloves");
  });

  it("escapes the search text (no HTML injection)", async () => {
    const page = await html(`/?search=${encodeURIComponent("<img src=x onerror=alert(1)>")}`);
    expect(page).not.toContain("<img src=x onerror=alert(1)>");
    expect(page).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("labels out-of-stock products", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, { colours: [{ name: "Red", isDefault: true, sizes: [{ size: "M", quantity: 0 }] }] });
    const page = await html(`/?search=${encodeURIComponent(product.name)}`);
    expect(page).toContain('class="product-card is-out-of-stock"');
    expect(page).toContain('<span class="badge badge-danger">Out of Stock</span>');
  });
});

describe("product page", () => {
  it("shows the product with price, stock, sizes in shop order and the default colour", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, {
      price: 1234.5,
      brand: "Shoei",
      description: "Line one\nLine two",
      colours: [
        { name: "Matt Black", code: "#111111", isDefault: true, images: ["uploads/black-1.jpg", "uploads/black-2.jpg"],
          sizes: [{ size: "XL", quantity: 1 }, { size: "S", quantity: 0 }, { size: "M", quantity: 2 }] },
        { name: "Red", code: "#ff0000", images: ["uploads/red-1.jpg"], sizes: [{ size: "L", quantity: 4 }] },
      ],
    });

    const page = await html(`/product/${product.id}`);
    expect(page).toContain(`<h1>${product.name}</h1>`);
    expect(page).toContain("RM 1,234.50");
    expect(page).toContain("In Stock (7 available)");
    expect(page).toContain("Line one<br/>Line two");
    expect(page).toContain('src="/uploads/black-1.jpg"');
    expect(page).toContain('data-image-step="1"'); // two images -> prev/next buttons
    expect(page).toContain("<strong>Available Sizes:</strong> S, M, L, XL");
    // Default colour's sizes in shop order; S is out of stock and disabled; M (first in stock) is selected.
    const sizeRow = page.slice(page.indexOf('id="simpleSizeRow"'), page.indexOf('id="sizeAvailabilityMessage"'));
    expect(sizeRow.indexOf('data-size="S"')).toBeLessThan(sizeRow.indexOf('data-size="M"'));
    expect(sizeRow.indexOf('data-size="M"')).toBeLessThan(sizeRow.indexOf('data-size="XL"'));
    expect(sizeRow).toMatch(/data-size="S"[^>]*disabled/);
    expect(sizeRow).toContain('class="simple-size-btn active" data-size="M"');
    expect(page).toContain('<strong id="selectedColorText">Matt Black</strong>');

    const data = productData(page);
    expect(data.productName).toBe(product.name);
    expect(Object.values(data.colorNames)).toEqual(["Matt Black", "Red"]);
    const redKey = Object.keys(data.colorNames).find((k) => data.colorNames[k] === "Red")!;
    expect(data.imagesByColor[redKey]).toEqual([{ src: "/uploads/red-1.jpg", alt: "Red" }]);
    expect(data.sizesByColor[redKey]).toEqual([{ label: "L", quantity: 4 }]);
  });

  it("shows the out-of-stock message when nothing is in stock", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, { colours: [{ name: "Blue", isDefault: true, sizes: [{ size: "M", quantity: 0 }] }] });
    const page = await html(`/product/${product.id}`);
    expect(page).toContain('<span class="badge badge-danger">Out of Stock</span>');
    expect(page).toContain("This colour is currently out of stock.");
  });

  it("falls back to the legacy product image when there are no colour images", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, { legacyImage: "uploads/product_legacy.png" });
    expect(await html(`/product/${product.id}`)).toContain('src="/uploads/product_legacy.png"');
  });

  it("returns 404 for hidden, missing and malformed product IDs", async () => {
    const sql = await testSql();
    const hidden = await createProduct(sql, inStockProduct({ status: "HIDDEN" }));
    for (const path of [`/product/${hidden.id}`, "/product/999999999", "/product/abc", "/product/1e5", "/product/99999999999999999999"]) {
      expect((await fetchApp(path)).status, path).toBe(404);
    }
  });

  it("only allows real hex colour codes in the page style", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, {
      colours: [{ name: "Bad", code: "red;background:url(https://evil.example/x)", isDefault: true }],
    });
    const page = await html(`/product/${product.id}`);
    expect(page).toContain("--dot-color: #000000;");
    expect(page).not.toContain("evil.example");
  });

  it("keeps product data inside its script block even if a name contains </script>", async () => {
    const sql = await testSql();
    const product = await createProduct(sql, {
      colours: [{ name: "</script><script>alert(1)</script>", isDefault: true, sizes: [{ size: "M", quantity: 1 }] }],
    });
    const page = await html(`/product/${product.id}`);
    expect(page).not.toContain("<script>alert(1)</script>");
    const data = productData(page);
    expect(Object.values(data.colorNames)).toEqual(["</script><script>alert(1)</script>"]);
  });

  it("suggests other products from the same sub-category, then category", async () => {
    const sql = await testSql();
    const subCategory = `Sub ${crypto.randomUUID().slice(0, 8)}`;
    const main = await createProduct(sql, { category: "Accessories", subCategory });
    const sibling = await createProduct(sql, { category: "Accessories", subCategory });
    const hiddenSibling = await createProduct(sql, { category: "Accessories", subCategory, status: "HIDDEN" });

    const page = await html(`/product/${main.id}`);
    const discover = page.slice(page.indexOf('id="discoverTrack"'));
    expect(page).toContain("Discover More Accessories");
    expect(discover).toContain(sibling.name);
    expect(discover).not.toContain(hiddenSibling.name);
    expect(discover).not.toContain(`href="/product/${main.id}"`);
  });
});

describe("product images", () => {
  it("serves images from R2 with a fixed content type and long caching", async () => {
    await env.IMAGES.put("uploads/test-serve.png", new Uint8Array([137, 80, 78, 71]));
    const res = await fetchApp("/uploads/test-serve.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("refuses non-image files and odd names, even if they exist in the bucket", async () => {
    await env.IMAGES.put("uploads/evil.html", "<script>alert(1)</script>");
    for (const path of ["/uploads/evil.html", "/uploads/missing.jpg", "/uploads/..%2Fsecret.png", "/uploads/.hidden.png"]) {
      expect((await fetchApp(path)).status, path).toBe(404);
    }
  });
});

describe("old PHP addresses", () => {
  it.each([
    ["/index.php?category=Helmet&sub_category=Kid+Helmet&x=1", "/?category=Helmet&sub_category=Kid+Helmet"],
    ["/index.php", "/"],
    ["/product_detail.php?id=42", "/product/42"],
    ["/product_detail.php?id=abc", "/"],
    ["/legal/privacy_policy.php", "/legal/privacy"],
    ["/legal/terms_conditions.php", "/legal/terms"],
    ["/legal/cookie_notice.php", "/legal/cookies"],
    ["/admin/login.php", "/admin/login"],
  ])("redirects %s to %s", async (from, to) => {
    const res = await fetchApp(from);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(to);
  });
});

describe("legal pages", () => {
  it.each([
    ["/legal/privacy", "Privacy Policy", "legal-privacy-page"],
    ["/legal/terms", "Terms &amp; Conditions", "legal-terms-page"],
    ["/legal/cookies", "Cookie Notice", "legal-cookie-page"],
  ])("renders %s", async (path, heading, bodyClass) => {
    const page = await html(path);
    expect(page).toContain(`<h1>${heading}</h1>`);
    expect(page).toContain(`class="public-page legal-page ${bodyClass}"`);
    expect(page).toContain("/assets/css/legal_pages.css");
    expect(page).toContain('id="mobileMenuDrawer"');
  });

  it("returns 404 for unknown legal pages", async () => {
    expect((await fetchApp("/legal/nope")).status).toBe(404);
  });
});
