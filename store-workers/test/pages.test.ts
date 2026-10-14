import { describe, expect, it } from "vitest";
import { createCustomer, fetchApp, login, testSql } from "./helpers";

describe("public pages", () => {
  it("renders the home page inside the public layout", async () => {
    const res = await fetchApp("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('class="navbar desktop-navbar"');
    expect(html).toContain('id="mobileMenuDrawer"');
    expect(html).toContain('class="site-footer premium-footer brand-directory-footer"');
    expect(html).toContain('href="/?category=Helmet&amp;sub_category=Full+Face+Helmet"');
    // Logged out: account menu offers Login / Sign Up.
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/logout"');
  });

  it("sends security headers on pages", async () => {
    const res = await fetchApp("/");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // Google Maps key restrictions need the referrer, so it must not be "no-referrer".
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("shows the account menu for a logged-in customer", async () => {
    const sql = await testSql();
    const customerId = await createCustomer(sql, "Ali Rider");
    const { cookie } = await login(sql, "customer", customerId);

    const html = await (await fetchApp("/", { headers: { Cookie: cookie } })).text();
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/logout"');
    expect(html).toContain("Ali Rider");
  });

  it("escapes customer names (no HTML injection)", async () => {
    const sql = await testSql();
    const customerId = await createCustomer(sql, "<script>alert(1)</script>");
    const { cookie } = await login(sql, "customer", customerId);

    const html = await (await fetchApp("/", { headers: { Cookie: cookie } })).text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("reports database health", async () => {
    const res = await fetchApp("/_health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ db: "ok" });
  });

  it("shows a 404 page for unknown paths", async () => {
    const res = await fetchApp("/no-such-page");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Page not found");
  });
});
