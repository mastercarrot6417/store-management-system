import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAdmin, createProduct, csrfTokenFor, fetchApp, inStockProduct, login, ORIGIN, postForm, testSql } from "./helpers";

/** Logs in a new admin and returns what's needed to send their forms. */
async function adminSession(role: "boss" | "admin" = "admin", displayName = "Test Admin") {
  const sql = await testSql();
  const id = await createAdmin(sql, { role, displayName });
  const { token, cookie } = await login(sql, "admin", id);
  const csrf = await csrfTokenFor(sql, token);
  return {
    id,
    cookie,
    csrf,
    get: (path: string) => fetchApp(path, { headers: { Cookie: cookie } }),
    post: (path: string, fields: Record<string, string>) => postForm(path, { csrf_token: csrf, ...fields }, cookie),
  };
}

/** The one-time message a redirect left behind, read by following it like a browser. */
async function flashAfter(res: Response, cookie: string): Promise<string> {
  const flash = res.headers.getSetCookie().find((c) => c.startsWith("mdb_flash="))?.split(";")[0];
  const page = await fetchApp(res.headers.get("Location")!, { headers: { Cookie: [cookie, flash].filter(Boolean).join("; ") } });
  const html = await page.text();
  const match = /<div class="alert alert-(?:success|danger)">([^<]*)<\/div>/.exec(html);
  return (match?.[1] ?? "").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

const uniqueCode = (label: string) => `${label}-${crypto.randomUUID().slice(0, 8)}`;

const productForm = (overrides: Record<string, string> = {}) => ({
  item_code: uniqueCode("HEL"),
  name: `Admin Test Helmet ${crypto.randomUUID()}`,
  brand: "KYT",
  price: "299.90",
  category: "Helmet",
  sub_category: "Full Face Helmet",
  status: "ACTIVE",
  arrival_date: "2026-10-01",
  description: "Line one\nLine two",
  ...overrides,
});

async function productRow(id: number) {
  const sql = await testSql();
  const [row] = await sql<{
    item_code: string; name: string; status: string; price: string; cost_price: string; online_sell_price: string;
    archived_at: string | null; category: string; sub_category: string;
  }[]>`SELECT item_code, name, status, price, cost_price, online_sell_price, archived_at, category, sub_category FROM products WHERE id = ${id}`;
  return row!;
}

async function sizeQuantity(productId: number, size: string): Promise<number | null> {
  const sql = await testSql();
  const [row] = await sql<{ quantity: number }[]>`SELECT quantity FROM product_sizes WHERE product_id = ${productId} AND size = ${size}`;
  return row ? Number(row.quantity) : null;
}

async function colourIdOf(productId: number): Promise<number> {
  const sql = await testSql();
  const [row] = await sql<{ id: string }[]>`SELECT id FROM product_colors WHERE product_id = ${productId} ORDER BY id LIMIT 1`;
  return Number(row!.id);
}

describe("admin pages need a login", () => {
  it.each(["/admin/products", "/admin/products/new", "/admin/stock/in", "/admin/stock/out", "/admin/reports/stock", "/admin/reports/stock/export.csv"])(
    "redirects %s to the admin login",
    async (path) => {
      const res = await fetchApp(path);
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/admin/login");
    },
  );

  it("rejects admin form posts without the session's CSRF token", async () => {
    const admin = await adminSession();
    const res = await postForm("/admin/products/new", productForm(), admin.cookie);
    expect(res.status).toBe(403);
  });
});

describe("dashboard", () => {
  it("shows stock figures, low stock and recent movements", async () => {
    const sql = await testSql();
    const { name } = await createProduct(sql, inStockProduct({ colours: [{ name: "Black", sizes: [{ size: "M", quantity: 2 }] }] }));
    const admin = await adminSession("admin", "Staff Lee");

    const html = await (await admin.get("/admin")).text();
    expect(html).toContain("Welcome back, Staff Lee");
    expect(html).toContain("Low Stock Alert");
    expect(html).toContain(name);
    expect(html).not.toContain("Boss Pricing Overview");
  });

  it("shows the boss pricing overview to bosses only", async () => {
    const boss = await adminSession("boss");
    const html = await (await boss.get("/admin")).text();
    expect(html).toContain("Boss Pricing Overview");
    expect(html).toContain("Total Cost Value");
  });
});

describe("product list", () => {
  it("hides boss-only prices from staff admins", async () => {
    const sql = await testSql();
    await createProduct(sql, inStockProduct({ costPrice: 123.45, onlineSellPrice: 234.56 }));
    const staff = await adminSession("admin");
    const html = await (await staff.get("/admin/products")).text();
    expect(html).not.toContain("Cost Price");
    expect(html).not.toContain("123.45");
    expect(html).not.toContain("234.56");

    const boss = await adminSession("boss");
    const bossHtml = await (await boss.get("/admin/products")).text();
    expect(bossHtml).toContain("Cost Price");
    expect(bossHtml).toContain("RM 123.45");
  });

  it("filters by search text, with % treated literally", async () => {
    const sql = await testSql();
    const { name } = await createProduct(sql, inStockProduct({ name: `Searchable 50% Helmet ${crypto.randomUUID()}` }));
    const other = await createProduct(sql, inStockProduct());
    const admin = await adminSession();
    const html = await (await admin.get(`/admin/products?search=${encodeURIComponent("50% Helmet")}`)).text();
    expect(html).toContain(name);
    expect(html).not.toContain(other.name);
  });

  it("escapes product names", async () => {
    const sql = await testSql();
    await createProduct(sql, inStockProduct({ name: `<img src=x onerror=alert(1)> ${crypto.randomUUID()}` }));
    const admin = await adminSession("boss");
    const html = await (await admin.get("/admin/products")).text();
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("add and edit products", () => {
  it("adds a product and goes on to its colours page", async () => {
    const admin = await adminSession();
    const form = productForm();
    const res = await admin.post("/admin/products/new", form);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toMatch(/^\/admin\/products\/\d+\/colours$/);
    expect(await flashAfter(res, admin.cookie)).toContain("added! Now set up its colours and images.");

    const id = Number(location.split("/")[3]);
    const row = await productRow(id);
    expect(row.item_code).toBe(form.item_code);
    expect(row.price).toBe("299.90");
  });

  it("ignores boss-only prices sent by a staff admin", async () => {
    const admin = await adminSession("admin");
    const res = await admin.post("/admin/products/new", productForm({ cost_price: "50", online_sell_price: "60" }));
    const id = Number(res.headers.get("Location")!.split("/")[3]);
    const row = await productRow(id);
    expect(Number(row.cost_price)).toBe(0);
    expect(Number(row.online_sell_price)).toBe(0);
  });

  it("saves boss-only prices from a boss", async () => {
    const boss = await adminSession("boss");
    const res = await boss.post("/admin/products/new", productForm({ cost_price: "150.50", online_sell_price: "280" }));
    const id = Number(res.headers.get("Location")!.split("/")[3]);
    const row = await productRow(id);
    expect(row.cost_price).toBe("150.50");
    expect(row.online_sell_price).toBe("280.00");
  });

  it.each([
    [{ item_code: "" }, "Please fill in all required fields."],
    [{ price: "12abc" }, "Price must be an amount"],
    [{ price: "-5" }, "Price must be an amount"],
    [{ category: "Helmet", sub_category: "Jackets" }, "Please choose a category and a sub category"],
    [{ arrival_date: "2026-02-31" }, "Arrival date is not a valid date."],
  ])("rejects %o", async (overrides, message) => {
    const admin = await adminSession();
    const res = await admin.post("/admin/products/new", productForm(overrides));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(message);
  });

  it("rejects a duplicate item code and keeps what was typed", async () => {
    const sql = await testSql();
    const code = uniqueCode("DUP");
    await createProduct(sql, { itemCode: code });
    const admin = await adminSession();
    const res = await admin.post("/admin/products/new", productForm({ item_code: code, name: "Typed Name Kept" }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("already exists");
    expect(html).toContain('value="Typed Name Kept"');
  });

  it("edits details without touching stock, and staff can't change boss prices", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct({ costPrice: 100, onlineSellPrice: 200 }));
    const staff = await adminSession("admin");
    const res = await staff.post(`/admin/products/${id}/edit`, productForm({ name: "Renamed Helmet", cost_price: "1", online_sell_price: "1" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/products");

    const row = await productRow(id);
    expect(row.name).toBe("Renamed Helmet");
    expect(Number(row.cost_price)).toBe(100);
    expect(Number(row.online_sell_price)).toBe(200);
    expect(await sizeQuantity(id, "M")).toBe(3);
  });

  it("lets an older product keep a category pair the menus no longer list", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct({ category: "Accessories", subCategory: "Bags" }));
    const admin = await adminSession();
    const res = await admin.post(`/admin/products/${id}/edit`, productForm({ category: "Accessories", sub_category: "Bags" }));
    expect(res.status).toBe(302);
    expect((await productRow(id)).sub_category).toBe("Bags");
  });

  it("shows the edit page with the stock table read-only", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const admin = await adminSession();
    const html = await (await admin.get(`/admin/products/${id}/edit`)).text();
    expect(html).toContain("Stock quantity is locked on this page.");
    expect(html).toContain(`/admin/stock/in?product_id=${id}`);
    expect(html).not.toMatch(/name="quantity/);
  });
});

describe("archive instead of delete", () => {
  it("only lets bosses archive", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const staff = await adminSession("admin");
    const res = await staff.post(`/admin/products/${id}/archive`, {});
    expect(await flashAfter(res, staff.cookie)).toBe("Only boss admins can archive products.");
    expect((await productRow(id)).archived_at).toBeNull();
  });

  it("archives a product: hidden from shop and lists, stock history kept, then restores it", async () => {
    const sql = await testSql();
    const { id, name } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    await sql`INSERT INTO stock_history (product_id, color_id, size, type, quantity, reason) VALUES (${id}, ${colourId}, 'M', 'IN', 3, 'Opening stock')`;
    const boss = await adminSession("boss");

    const res = await boss.post(`/admin/products/${id}/archive`, {});
    expect(await flashAfter(res, boss.cookie)).toContain("was archived");
    const row = await productRow(id);
    expect(row.archived_at).not.toBeNull();
    expect(row.status).toBe("HIDDEN");

    const [history] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM stock_history WHERE product_id = ${id}`;
    expect(Number(history!.count)).toBe(1);
    expect(await sizeQuantity(id, "M")).toBe(3);

    expect((await fetchApp(`/product/${id}`)).status).toBe(404);
    expect(await (await boss.get("/admin/products")).text()).not.toContain(name);
    expect(await (await boss.get("/admin/products?view=archived")).text()).toContain(name);
    expect(await (await boss.get("/admin/stock/in")).text()).not.toContain(name);

    const restored = await boss.post(`/admin/products/${id}/restore`, {});
    expect(restored.headers.get("Location")).toBe(`/admin/products/${id}/edit`);
    const after = await productRow(id);
    expect(after.archived_at).toBeNull();
    expect(after.status).toBe("HIDDEN");
  });

  it("keeps an archived product hidden when it's edited", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    await sql`UPDATE products SET archived_at = NOW(), status = 'HIDDEN' WHERE id = ${id}`;
    const boss = await adminSession("boss");
    await boss.post(`/admin/products/${id}/edit`, productForm({ status: "ACTIVE" }));
    expect((await productRow(id)).status).toBe("HIDDEN");
  });

  it("refuses stock movements on an archived product", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    await sql`UPDATE products SET archived_at = NOW(), status = 'HIDDEN' WHERE id = ${id}`;
    const admin = await adminSession();
    const res = await admin.post("/admin/stock/in", {
      product_id: String(id), color_id: String(colourId), existing_size: "M", quantity: "2", reason: "Restock",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("This product is archived.");
    expect(await sizeQuantity(id, "M")).toBe(3);
  });
});

describe("stock in / stock out", () => {
  it("adds stock to a new size and records who did it", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    const admin = await adminSession("admin", "Store Keeper");

    const res = await admin.post("/admin/stock/in", {
      product_id: String(id), color_id: String(colourId), existing_size: "", new_size: "XL", quantity: "4",
      reason: "New supplier stock", note: "Invoice 123",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/admin/stock/in?product_id=${id}&color_id=${colourId}&size=XL`);
    expect(await flashAfter(res, admin.cookie)).toContain("Stock In recorded successfully. Size XL: 0 → 4 unit(s).");
    expect(await sizeQuantity(id, "XL")).toBe(4);

    const [history] = await sql<{ type: string; quantity: number; quantity_before: number; quantity_after: number; note: string; edited_by_admin_id: string; edited_by_admin_name: string }[]>`
      SELECT type, quantity, quantity_before, quantity_after, note, edited_by_admin_id, edited_by_admin_name
      FROM stock_history WHERE product_id = ${id}`;
    expect(history).toMatchObject({ type: "IN", quantity: 4, quantity_before: 0, quantity_after: 4, note: "Invoice 123", edited_by_admin_name: "Store Keeper" });
    expect(Number(history!.edited_by_admin_id)).toBe(admin.id);
  });

  it("adds to an existing size whatever its case", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    const admin = await adminSession();
    await admin.post("/admin/stock/in", { product_id: String(id), color_id: String(colourId), new_size: " m ", quantity: "2", reason: "Restock" });
    expect(await sizeQuantity(id, "M")).toBe(5);
    const [sizes] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM product_sizes WHERE product_id = ${id}`;
    expect(Number(sizes!.count)).toBe(1);
  });

  it("removes stock and refuses to go below zero", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    const [size] = await sql<{ id: string }[]>`SELECT id FROM product_sizes WHERE product_id = ${id}`;
    const admin = await adminSession();
    const fields = { product_id: String(id), color_id: String(colourId), size_id: size!.id, reason: "Damaged item" };

    const tooMany = await admin.post("/admin/stock/out", { ...fields, quantity: "4" });
    expect(tooMany.status).toBe(400);
    expect(await tooMany.text()).toContain("Cannot remove 4 unit(s). Only 3 unit(s) are available");
    expect(await sizeQuantity(id, "M")).toBe(3);

    const ok = await admin.post("/admin/stock/out", { ...fields, quantity: "3" });
    expect(ok.status).toBe(302);
    expect(await sizeQuantity(id, "M")).toBe(0);
    const [history] = await sql<{ type: string; quantity_before: number; quantity_after: number }[]>`
      SELECT type, quantity_before, quantity_after FROM stock_history WHERE product_id = ${id}`;
    expect(history).toMatchObject({ type: "OUT", quantity_before: 3, quantity_after: 0 });
  });

  it.each([
    [{ quantity: "0" }, "quantity must be more than 0"],
    [{ quantity: "abc" }, "quantity must be more than 0"],
    [{ quantity: "2", reason: "Because" }, "Please select a reason"],
  ])("rejects %o", async (overrides, message) => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    const admin = await adminSession();
    const res = await admin.post("/admin/stock/in", { product_id: String(id), color_id: String(colourId), existing_size: "M", reason: "Restock", ...overrides });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(message);
    expect(await sizeQuantity(id, "M")).toBe(3);
  });

  it("refuses a colour that belongs to another product", async () => {
    const sql = await testSql();
    const first = await createProduct(sql, inStockProduct());
    const second = await createProduct(sql, inStockProduct());
    const admin = await adminSession();
    const res = await admin.post("/admin/stock/in", {
      product_id: String(first.id), color_id: String(await colourIdOf(second.id)), existing_size: "M", quantity: "1", reason: "Restock",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("does not belong to this product");
  });

  it("lists the chosen product's colours and sizes", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const admin = await adminSession();
    const html = await (await admin.get(`/admin/stock/out?product_id=${id}&size=M`)).text();
    expect(html).toContain(">Black<");
    expect(html).toMatch(/<option value="\d+" data-size="M" data-qty="3" selected="">/);
  });
});

describe("colours and images", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

  function upload(admin: { cookie: string; csrf: string }, path: string, files: File[]) {
    const body = new FormData();
    body.set("csrf_token", admin.csrf);
    for (const file of files) body.append("images[]", file);
    return fetchApp(path, { method: "POST", headers: { Cookie: admin.cookie, Origin: ORIGIN }, body });
  }

  it("adds a colour, making the first one the default, and rejects bad colour codes", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql);
    const admin = await adminSession();

    const bad = await admin.post(`/admin/products/${id}/colours/add`, { color_name: "Red", color_code: "red;background:url(x)" });
    expect(await flashAfter(bad, admin.cookie)).toBe("Colour code must look like #1a1a1a.");

    await admin.post(`/admin/products/${id}/colours/add`, { color_name: "Red", color_code: "#cc0000" });
    const [colour] = await sql<{ color_name: string; is_default: boolean }[]>`SELECT color_name, is_default FROM product_colors WHERE product_id = ${id}`;
    expect(colour).toEqual({ color_name: "Red", is_default: true });
  });

  it("saves names, codes and the default colour together, validating every code", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, { colours: [{ name: "Black", isDefault: true }, { name: "White", code: "#ffffff" }] });
    const colours = await sql<{ id: string }[]>`SELECT id FROM product_colors WHERE product_id = ${id} ORDER BY id`;
    const [black, white] = colours.map((c) => c.id);
    const admin = await adminSession();

    const fields = (whiteCode: string) => {
      const body = new URLSearchParams({ csrf_token: admin.csrf, default_color_id: white! });
      body.append("color_ids[]", black!);
      body.append("color_ids[]", white!);
      body.set(`color_name_${black}`, "Matte Black");
      body.set(`color_code_${black}`, "#111111");
      body.set(`color_name_${white}`, "Pearl White");
      body.set(`color_code_${white}`, whiteCode);
      return fetchApp(`/admin/products/${id}/colours/save`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: ORIGIN, Cookie: admin.cookie },
        body: body.toString(),
      });
    };

    const bad = await fields("#fff");
    expect(await flashAfter(bad, admin.cookie)).toContain('"Pearl White" has an invalid colour code');

    await fields("#fafafa");
    const saved = await sql<{ color_name: string; color_code: string; is_default: boolean }[]>`
      SELECT color_name, color_code, is_default FROM product_colors WHERE product_id = ${id} ORDER BY id`;
    expect(saved).toEqual([
      { color_name: "Matte Black", color_code: "#111111", is_default: false },
      { color_name: "Pearl White", color_code: "#fafafa", is_default: true },
    ]);
  });

  it("won't delete a colour that still has stock", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, inStockProduct());
    const admin = await adminSession();
    const res = await admin.post(`/admin/products/${id}/colours/${await colourIdOf(id)}/delete`, {});
    expect(await flashAfter(res, admin.cookie)).toContain("still has 3 unit(s) in stock");
  });

  it("refuses to change another product's colour through this product's address", async () => {
    const sql = await testSql();
    const mine = await createProduct(sql);
    const theirs = await createProduct(sql, { colours: [{ name: "Theirs" }] });
    const admin = await adminSession();
    const res = await admin.post(`/admin/products/${mine.id}/colours/${await colourIdOf(theirs.id)}/delete`, {});
    expect(await flashAfter(res, admin.cookie)).toBe("Invalid colour selected.");
    const [still] = await sql`SELECT 1 FROM product_colors WHERE product_id = ${theirs.id}`;
    expect(still).toBeDefined();
  });

  it("uploads real images to R2, skips other files, and serves them at /uploads/", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, { colours: [{ name: "Black" }] });
    const colourId = await colourIdOf(id);
    const admin = await adminSession();

    const res = await upload(admin, `/admin/products/${id}/colours/${colourId}/images`, [
      new File([PNG], "photo.png", { type: "image/png" }),
      new File(["<script>alert(1)</script>"], "evil.png", { type: "image/png" }),
    ]);
    expect(await flashAfter(res, admin.cookie)).toBe("1 image(s) uploaded. 1 skipped (only JPEG, PNG, GIF or WebP images up to 5 MB).");

    const [image] = await sql<{ image_path: string; is_main: boolean }[]>`SELECT image_path, is_main FROM product_images WHERE product_id = ${id}`;
    expect(image!.image_path).toMatch(new RegExp(`^uploads/pimg_${id}_${colourId}_[0-9a-f]{12}\\.png$`));
    expect(image!.is_main).toBe(true);
    expect(await env.IMAGES.get(image!.image_path)).not.toBeNull();

    const served = await fetchApp(`/${image!.image_path}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("Content-Type")).toBe("image/png");
  });

  it("deletes an image from the database and R2, and moves 'main' to the next one", async () => {
    const sql = await testSql();
    const { id } = await createProduct(sql, { colours: [{ name: "Black" }] });
    const colourId = await colourIdOf(id);
    const admin = await adminSession();
    await upload(admin, `/admin/products/${id}/colours/${colourId}/images`, [
      new File([PNG], "a.png"),
      new File([PNG], "b.png"),
    ]);
    const images = await sql<{ id: string; image_path: string; is_main: boolean }[]>`
      SELECT id, image_path, is_main FROM product_images WHERE product_id = ${id} ORDER BY sort_order`;
    expect(images.map((i) => i.is_main)).toEqual([true, false]);

    await admin.post(`/admin/products/${id}/colours/images/${images[0]!.id}/delete`, {});
    expect(await env.IMAGES.get(images[0]!.image_path)).toBeNull();
    const [left] = await sql<{ is_main: boolean }[]>`SELECT is_main FROM product_images WHERE product_id = ${id}`;
    expect(left!.is_main).toBe(true);
  });
});

describe("stock report", () => {
  it("shows current stock and movement history, with online prices for bosses only", async () => {
    const sql = await testSql();
    const { id, name } = await createProduct(sql, inStockProduct({ onlineSellPrice: 345.67 }));
    const colourId = await colourIdOf(id);
    await sql`INSERT INTO stock_history (product_id, color_id, size, type, quantity, reason, quantity_before, quantity_after, edited_by_admin_name, created_at)
              VALUES (${id}, ${colourId}, 'M', 'IN', 3, 'Opening stock', 0, 3, 'Report Tester', '2026-07-08 17:59:00')`;
    const search = `?current_search=${encodeURIComponent(name)}&history_search=${encodeURIComponent(name)}`;

    const staff = await adminSession("admin");
    const html = await (await staff.get(`/admin/reports/stock${search}`)).text();
    expect(html).toContain("Showing 1 of 1 stock rows");
    expect(html).toContain("08 Jul 2026 17:59");
    expect(html).toContain("Edited by: Report Tester");
    expect(html).not.toContain("Online Price");
    expect(html).not.toContain("345.67");

    const boss = await adminSession("boss");
    expect(await (await boss.get(`/admin/reports/stock${search}`)).text()).toContain("345.67");
  });

  it("filters movement history by date range (Malaysia dates)", async () => {
    const sql = await testSql();
    const { id, name } = await createProduct(sql, inStockProduct());
    const colourId = await colourIdOf(id);
    for (const when of ["2026-03-01 23:59:00", "2026-03-02 00:00:00"]) {
      await sql`INSERT INTO stock_history (product_id, color_id, size, type, quantity, reason, created_at)
                VALUES (${id}, ${colourId}, 'M', 'IN', 1, 'Restock', ${when}::text::timestamp)`;
    }
    const admin = await adminSession();
    const html = await (await admin.get(`/admin/reports/stock?history_search=${encodeURIComponent(name)}&date_from=2026-03-01&date_to=2026-03-01`)).text();
    expect(html).toContain("01 Mar 2026 23:59");
    expect(html).not.toContain("02 Mar 2026 00:00");
  });

  it("exports CSV with formula-safe text", async () => {
    const sql = await testSql();
    const name = `=HYPERLINK("http://evil") ${crypto.randomUUID()}`;
    await createProduct(sql, inStockProduct({ name }));
    const admin = await adminSession();

    const res = await admin.get(`/admin/reports/stock/export.csv?report_type=current&current_search=${encodeURIComponent(name.slice(-36))}`);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=UTF-8");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="current_stock_levels_\d{8}_\d{6}\.csv"$/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")`);
    expect(text.split("\r\n")[0]).not.toContain("Online Price");
  });

  it("renders the print view", async () => {
    const admin = await adminSession("admin", "Printer Pat");
    const res = await admin.get("/admin/reports/stock/print?report_type=history");
    const html = await res.text();
    expect(html).toContain("My Dream Bike Stock Report");
    expect(html).toContain("Generated By:</strong> Printer Pat");
    expect(html).toContain("Stock Movement History");
    expect(html).not.toContain("Current Stock Levels");
  });
});

describe("old PHP admin addresses", () => {
  it.each([
    ["/admin/products.php?search=kyt&subcategory=Bag", "/admin/products?search=kyt&sub_category=Bag"],
    ["/admin/add_product.php", "/admin/products/new"],
    ["/admin/edit_product.php?id=12", "/admin/products/12/edit"],
    ["/admin/manage_product_colors.php?product_id=12", "/admin/products/12/colours"],
    ["/admin/stock_in.php?product_id=3&color_id=4&size=XL", "/admin/stock/in?product_id=3&color_id=4&size=XL"],
    ["/admin/stock_out.php?product_id=3&color_id=4&size_id=9", "/admin/stock/out?product_id=3&color_id=4&size_id=9"],
    ["/admin/stock_report.php?current_search=kyt&history_type=IN", "/admin/reports/stock?current_search=kyt&history_type=IN"],
    ["/admin/export_stock_report.php?report_type=history", "/admin/reports/stock/export.csv?report_type=history"],
    ["/admin/print_stock_report.php?report_type=all", "/admin/reports/stock/print?report_type=all"],
  ])("redirects %s", async (from, to) => {
    const res = await fetchApp(from);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(to);
  });
});
