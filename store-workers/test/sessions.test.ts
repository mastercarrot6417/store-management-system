import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { createAdmin, createCustomer, fetchApp, login, testSql } from "./helpers";

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("admin sessions", () => {
  it("redirects to the login page when not logged in", async () => {
    const res = await fetchApp("/admin");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/login");
  });

  it("lets the login page through without a session", async () => {
    const res = await fetchApp("/admin/login");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Admin Login");
  });

  it("shows the admin layout with the admin's name and role", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql, { role: "boss", displayName: "Boss Tan" });
    const { cookie } = await login(sql, "admin", adminId);

    const res = await fetchApp("/admin", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Welcome, Boss Tan");
    expect(html).toContain("Boss Admin");
    expect(html).toContain('href="/admin" class="active"');
  });

  it("labels a normal admin as Staff Admin", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql, { role: "admin" });
    const { cookie } = await login(sql, "admin", adminId);

    const html = await (await fetchApp("/admin", { headers: { Cookie: cookie } })).text();
    expect(html).toContain("Staff Admin");
    expect(html).not.toContain("Boss Admin");
  });

  it("reads the role fresh from the database on every request", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql, { role: "admin" });
    const { cookie } = await login(sql, "admin", adminId);
    await sql`UPDATE admin SET role = 'boss' WHERE id = ${adminId}`;

    const html = await (await fetchApp("/admin", { headers: { Cookie: cookie } })).text();
    expect(html).toContain("Boss Admin");
  });

  it.each([
    ["the session has passed its absolute expiry", "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE id_hash = $1"],
    ["the admin has been idle for over 2 hours", "UPDATE sessions SET last_seen_at = NOW() - INTERVAL '3 hours' WHERE id_hash = $1"],
    ["the session row was deleted", "DELETE FROM sessions WHERE id_hash = $1"],
  ])("logs the admin out when %s", async (_label, statement) => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const { token, cookie } = await login(sql, "admin", adminId);
    await sql.unsafe(statement, [await sha256Hex(token)]);

    const res = await fetchApp("/admin", { headers: { Cookie: cookie } });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/login");
  });

  it("logs the admin out when their admin account is deleted", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const { cookie } = await login(sql, "admin", adminId);
    await sql`DELETE FROM admin WHERE id = ${adminId}`;

    const res = await fetchApp("/admin", { headers: { Cookie: cookie } });
    expect(res.status).toBe(302);
  });

  it("does not accept a customer session as an admin session", async () => {
    const sql = await testSql();
    const customerId = await createCustomer(sql);
    // Same numeric ID as the customer, so only the user_type check stops this.
    await sql`INSERT INTO admin (id, email, password) VALUES (${customerId}, ${`clash-${customerId}@test.my`}, 'x') ON CONFLICT DO NOTHING`;
    const { token } = await login(sql, "customer", customerId);

    const res = await fetchApp("/admin", { headers: { Cookie: `mdb_admin=${token}` } });
    expect(res.status).toBe(302);
  });

  it("refreshes last_seen_at when it's more than 5 minutes old", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const { token, cookie } = await login(sql, "admin", adminId);
    const hash = await sha256Hex(token);
    await sql`UPDATE sessions SET last_seen_at = NOW() - INTERVAL '10 minutes' WHERE id_hash = ${hash}`;

    await fetchApp("/admin", { headers: { Cookie: cookie } });

    const [row] = await sql<{ recent: boolean }[]>`
      SELECT last_seen_at > NOW() - INTERVAL '1 minute' AS recent FROM sessions WHERE id_hash = ${hash}`;
    expect(row!.recent).toBe(true);
  });

  it("stores only a hash of the cookie token", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const { token } = await login(sql, "admin", adminId);
    const rows = await sql`SELECT 1 FROM sessions WHERE id_hash = ${token}`;
    expect(rows.length).toBe(0);
  });

  it("logs out: deletes the session, clears the cookie, and shows a message", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const { token, cookie } = await login(sql, "admin", adminId);

    const res = await fetchApp("/admin/logout", { headers: { Cookie: cookie } });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/login");

    const setCookies = res.headers.getSetCookie();
    const adminCookie = setCookies.find((c) => c.startsWith("mdb_admin="));
    expect(adminCookie).toContain("Max-Age=0");
    expect(adminCookie).toContain("Path=/admin");

    const rows = await sql`SELECT 1 FROM sessions WHERE id_hash = ${await sha256Hex(token)}`;
    expect(rows.length).toBe(0);

    // The old cookie no longer works.
    expect((await fetchApp("/admin", { headers: { Cookie: cookie } })).status).toBe(302);

    // The flash message shows once on the next page.
    const flashCookie = setCookies.find((c) => c.startsWith("mdb_flash="))!.split(";")[0]!;
    const loginPage = await fetchApp("/admin/login", { headers: { Cookie: flashCookie } });
    expect(await loginPage.text()).toContain("You have been logged out.");
    expect(loginPage.headers.getSetCookie().some((c) => c.startsWith("mdb_flash=;"))).toBe(true);
  });

  it("ignores a flash cookie that wasn't signed with the secret", async () => {
    const forged = encodeURIComponent(JSON.stringify({ kind: "success", message: "Forged message" }));
    const res = await fetchApp("/admin/login", { headers: { Cookie: `mdb_flash=${forged}.bad-signature` } });
    expect(await res.text()).not.toContain("Forged message");
  });
});

describe("daily session clean-up", () => {
  it("deletes expired and idle sessions but keeps valid ones", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const valid = await login(sql, "admin", adminId);
    const expired = await login(sql, "admin", adminId);
    const idle = await login(sql, "admin", adminId);
    await sql`UPDATE sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id_hash = ${await sha256Hex(expired.token)}`;
    await sql`UPDATE sessions SET last_seen_at = NOW() - INTERVAL '3 hours' WHERE id_hash = ${await sha256Hex(idle.token)}`;

    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController(), env, ctx);
    await waitOnExecutionContext(ctx);

    const remaining = await sql<{ id_hash: string }[]>`
      SELECT id_hash FROM sessions
      WHERE id_hash IN (${await sha256Hex(valid.token)}, ${await sha256Hex(expired.token)}, ${await sha256Hex(idle.token)})`;
    expect(remaining.map((r) => r.id_hash)).toEqual([await sha256Hex(valid.token)]);
  });
});
