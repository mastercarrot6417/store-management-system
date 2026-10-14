import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { connectUncached } from "../src/lib/db";
import { createAdmin, csrfTokenFor, fetchApp, login, ORIGIN, postForm, testSql } from "./helpers";

async function adminWithCsrf() {
  const sql = await testSql();
  const adminId = await createAdmin(sql);
  const { token, cookie } = await login(sql, "admin", adminId);
  const csrf = await csrfTokenFor(sql, token);
  return { cookie, csrf };
}

describe("CSRF protection", () => {
  it("accepts an admin form post with the session's token", async () => {
    const { cookie, csrf } = await adminWithCsrf();
    // No POST handler exists on /admin yet, so getting past the CSRF check means a 404.
    const res = await postForm("/admin", { csrf_token: csrf }, cookie);
    expect(res.status).toBe(404);
  });

  it("blocks an admin form post with the wrong token", async () => {
    const { cookie } = await adminWithCsrf();
    const res = await postForm("/admin", { csrf_token: "wrong-token" }, cookie);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Request blocked");
  });

  it("blocks an admin form post with no token", async () => {
    const { cookie } = await adminWithCsrf();
    const res = await postForm("/admin", {}, cookie);
    expect(res.status).toBe(403);
  });

  it("blocks a token taken from a different admin's session", async () => {
    const first = await adminWithCsrf();
    const second = await adminWithCsrf();
    const res = await postForm("/admin", { csrf_token: second.csrf }, first.cookie);
    expect(res.status).toBe(403);
  });

  it("blocks form posts sent from another website", async () => {
    const res = await fetchApp("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://evil.example" },
      body: "a=1",
    });
    expect(res.status).toBe(403);
  });

  it("lets cross-site posts reach /webhooks/ (payment callbacks verify signatures instead)", async () => {
    const res = await fetchApp("/webhooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://gateway.example" },
      body: "a=1",
    });
    expect(res.status).toBe(404);
  });

  it("allows same-origin posts on public pages", async () => {
    // No POST handler on / yet, so getting past the origin check means a 404.
    const res = await postForm("/", { a: "1" });
    expect(res.status).toBe(404);
  });
});

describe("error handling", () => {
  async function callWorker(path: string, envOverrides: Partial<Env>, init: RequestInit = {}) {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request(`${ORIGIN}${path}`, init), { ...env, ...envOverrides }, ctx);
    await waitOnExecutionContext(ctx);
    return res;
  }

  it("shows a generic 500 page and hides the reason when the cookie secret is missing", async () => {
    const res = await callWorker("/", { COOKIE_SECRET: "" });
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("Something went wrong");
    expect(html).not.toContain("COOKIE_SECRET");
  });

  it("shows a generic 500 page and no SQL details when the database is down", async () => {
    const sql = await testSql();
    const adminId = await createAdmin(sql);
    const { cookie } = await login(sql, "admin", adminId);

    const deadDb = { connectionString: "postgres://u:p@127.0.0.1:1/x" } as Hyperdrive;
    const res = await callWorker("/admin", { HYPERDRIVE_NOCACHE: deadDb }, { headers: { Cookie: cookie } });
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("Something went wrong");
    expect(html).not.toMatch(/ECONNREFUSED|sessions|SELECT/i);
  });

  it("reports an unreachable database on /_health without details", async () => {
    const deadDb = { connectionString: "postgres://u:p@127.0.0.1:1/x" } as Hyperdrive;
    const res = await callWorker("/_health", { HYPERDRIVE_NOCACHE: deadDb });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ db: "error" });
  });
});

describe("database helper", () => {
  it("returns TIMESTAMP WITHOUT TIME ZONE values exactly as stored (Malaysia wall-clock time)", async () => {
    const sql = connectUncached(env);
    const [row] = await sql<{ t: string }[]>`SELECT '2026-07-08 17:59:00'::timestamp AS t`;
    expect(row!.t).toBe("2026-07-08 17:59:00");
  });
});
