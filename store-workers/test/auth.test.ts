import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { hashPassword, NO_PASSWORD, verifyPassword } from "../src/lib/passwords";
import { fetchApp, ORIGIN, postForm, randomIp, testSql } from "./helpers";

/** Real hashes made by PHP's password_hash() on the XAMPP PHP 8.2 install. */
const PHP_HASH_RIDER = "$2y$10$Lc6rbrbTjE289pN6IM9ISO0UljKYTyupmgmRgxRALByBFUlghTE8S"; // "Rider-Pass-2026"
const PHP_HASH_SPACED = "$2y$10$rGsJTrYqvz4Ikm0d6P9bKOZUWnrpCEqx58vTREJSykDnouHrRU9eq"; // "spaced-pass"

const uniqueEmail = (label: string) => `${label}-${crypto.randomUUID()}@test.my`;

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "name=value" for a cookie set by the response, or undefined. */
function cookieFrom(res: Response, name: string): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(";")[0];
}

async function phpCustomer(opts: { hash?: string; name?: string; phone?: string | null } = {}) {
  const sql = await testSql();
  const email = uniqueEmail("customer");
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO customers (full_name, email, phone, password)
    VALUES (${opts.name ?? "Ahmad Rider"}, ${email}, ${opts.phone ?? null}, ${opts.hash ?? PHP_HASH_RIDER})
    RETURNING id`;
  return { id: Number(row!.id), email };
}

async function phpAdmin(role: "boss" | "admin" = "admin") {
  const sql = await testSql();
  const email = uniqueEmail("admin");
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO admin (email, password, role, display_name) VALUES (${email}, ${PHP_HASH_RIDER}, ${role}, 'Shop Admin')
    RETURNING id`;
  return { id: Number(row!.id), email };
}

/** Calls the Worker directly (same isolate as the test, so fetch can be mocked), with optional env overrides. */
async function callWorker(path: string, init: RequestInit = {}, envOverrides: Partial<Env> = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual", ...init }), { ...env, ...envOverrides }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("passwords", () => {
  it("checks hashes made by PHP's password_hash()", async () => {
    expect(await verifyPassword("Rider-Pass-2026", PHP_HASH_RIDER)).toBe(true);
    expect(await verifyPassword("wrong", PHP_HASH_RIDER)).toBe(false);
  });

  it("saves new hashes in PHP's $2y$ format", async () => {
    const hash = await hashPassword("Brand-New-1");
    expect(hash.startsWith("$2y$10$")).toBe(true);
    expect(await verifyPassword("Brand-New-1", hash)).toBe(true);
  });

  it("never matches a missing account or a Google-only account", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword(NO_PASSWORD, NO_PASSWORD)).toBe(false);
  });
});

describe("customer login", () => {
  it("logs in with a password hashed by the PHP site", async () => {
    const customer = await phpCustomer();
    const res = await postForm("/login", { email: customer.email, password: "Rider-Pass-2026" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/account");

    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("mdb_customer="))!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("trims spaces around the password, as the PHP site did", async () => {
    const customer = await phpCustomer({ hash: PHP_HASH_SPACED });
    const res = await postForm("/login", { email: customer.email, password: "  spaced-pass  " });
    expect(res.status).toBe(302);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const customer = await phpCustomer();
    const wrong = await postForm("/login", { email: customer.email, password: "not-it" });
    const unknown = await postForm("/login", { email: uniqueEmail("nobody"), password: "not-it" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.text()).toContain("Invalid email or password.");
    expect(await unknown.text()).toContain("Invalid email or password.");
  });

  it("keeps the email (escaped) but never the password in the form after an error", async () => {
    const res = await postForm("/login", { email: '"><script>x</script>@a.my', password: "secret-typed" });
    const html = await res.text();
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(html).not.toContain("secret-typed");
  });

  it("replaces any session the browser already had (no session fixation)", async () => {
    const sql = await testSql();
    const customer = await phpCustomer();
    const planted = "planted-token-from-an-attacker";
    await sql`
      INSERT INTO sessions (id_hash, user_type, user_id, csrf_token, expires_at)
      VALUES (${await sha256Hex(planted)}, 'customer', ${customer.id}, 'x', NOW() + INTERVAL '1 hour')`;

    const res = await postForm("/login", { email: customer.email, password: "Rider-Pass-2026" }, `mdb_customer=${planted}`);
    expect(cookieFrom(res, "mdb_customer")).not.toBe(`mdb_customer=${planted}`);
    const rows = await sql`SELECT 1 FROM sessions WHERE id_hash = ${await sha256Hex(planted)}`;
    expect(rows.length).toBe(0);
  });

  it("blocks the 11th attempt within a minute from the same IP", async () => {
    const ip = randomIp();
    for (let i = 0; i < 10; i++) {
      const res = await postForm("/login", { email: uniqueEmail("guess"), password: "guess" }, undefined, ip);
      expect(res.status).toBe(401);
    }
    const blocked = await postForm("/login", { email: uniqueEmail("guess"), password: "guess" }, undefined, ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.text()).toContain("Too many attempts");
  });

  it("blocks the 11th attempt on one email even from different IPs", async () => {
    const customer = await phpCustomer();
    for (let i = 0; i < 10; i++) await postForm("/login", { email: customer.email, password: "guess" });
    const blocked = await postForm("/login", { email: customer.email, password: "Rider-Pass-2026" });
    expect(blocked.status).toBe(429);
  });
});

describe("customer account and logout", () => {
  async function loggedIn(opts: Parameters<typeof phpCustomer>[0] = {}) {
    const customer = await phpCustomer(opts);
    const res = await postForm("/login", { email: customer.email, password: "Rider-Pass-2026" });
    return { ...customer, cookie: cookieFrom(res, "mdb_customer")! };
  }

  it("shows the account page to a logged-in customer", async () => {
    const customer = await loggedIn({ name: "Siti Rider" });
    const res = await fetchApp("/account", { headers: { Cookie: customer.cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Welcome, Siti Rider");
    expect(html).toContain(customer.email);
    expect(html).toContain("Not added");
    expect(html).toContain("<span>Email</span>");
    expect(html).toMatch(/<strong>Joined<\/strong><span>\d{2} [A-Z][a-z]{2} \d{4}<\/span>/);
  });

  it("sends logged-out visitors from /account to /login, and logged-in ones from /login to /account", async () => {
    expect((await fetchApp("/account")).headers.get("Location")).toBe("/login");
    const customer = await loggedIn();
    expect((await fetchApp("/login", { headers: { Cookie: customer.cookie } })).headers.get("Location")).toBe("/account");
  });

  it("logs out: deletes the session and clears the cookie", async () => {
    const customer = await loggedIn();
    const res = await fetchApp("/logout", { headers: { Cookie: customer.cookie } });
    expect(res.headers.get("Location")).toBe("/");
    expect(res.headers.getSetCookie().find((c) => c.startsWith("mdb_customer="))).toContain("Max-Age=0");
    expect((await fetchApp("/account", { headers: { Cookie: customer.cookie } })).status).toBe(302);
  });
});

describe("customer sign-up", () => {
  const form = (overrides: Record<string, string> = {}) => ({
    full_name: "New Rider",
    email: uniqueEmail("signup"),
    phone: "012-345 6789",
    password: "Strong-Pass-1",
    confirm_password: "Strong-Pass-1",
    ...overrides,
  });

  it("creates an account with a PHP-compatible hash, then the customer can log in", async () => {
    const fields = form();
    const res = await postForm("/signup", fields);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");

    const sql = await testSql();
    const [row] = await sql<{ password: string; auth_provider: string; phone: string }[]>`
      SELECT password, auth_provider, phone FROM customers WHERE email = ${fields.email}`;
    expect(row!.password.startsWith("$2y$10$")).toBe(true);
    expect(row!.auth_provider).toBe("email");
    expect(row!.phone).toBe("012-345 6789");

    const flash = cookieFrom(res, "mdb_flash")!;
    expect(await (await fetchApp("/login", { headers: { Cookie: flash } })).text()).toContain("Account created successfully. Please login.");
    expect((await postForm("/login", { email: fields.email, password: "Strong-Pass-1" })).status).toBe(302);
  });

  it.each([
    [{ full_name: "" }, "Please fill in all required fields."],
    [{ email: "not-an-email" }, "Please enter a valid email address."],
    [{ password: "short", confirm_password: "short" }, "Password must be at least 8 characters."],
    [{ password: "x".repeat(73), confirm_password: "x".repeat(73) }, "Password is too long"],
    [{ confirm_password: "Different-Pass-1" }, "Password and confirm password do not match."],
  ])("rejects %o", async (overrides, message) => {
    const res = await postForm("/signup", form(overrides));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(message);
  });

  it("rejects an email that is already registered", async () => {
    const existing = await phpCustomer();
    const res = await postForm("/signup", form({ email: existing.email }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("This email is already registered. Please login instead.");
  });
});

describe("admin login", () => {
  it("logs an admin in with a PHP password hash; the cookie only goes to /admin", async () => {
    const admin = await phpAdmin("boss");
    const res = await postForm("/admin/login", { email: admin.email, password: "Rider-Pass-2026" });
    expect(res.headers.get("Location")).toBe("/admin");
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("mdb_admin="))!;
    expect(setCookie).toContain("Path=/admin");

    const dashboard = await fetchApp("/admin", { headers: { Cookie: cookieFrom(res, "mdb_admin")! } });
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("Boss Admin");
  });

  it("rejects wrong passwords and customer accounts", async () => {
    const admin = await phpAdmin();
    const customer = await phpCustomer();
    expect((await postForm("/admin/login", { email: admin.email, password: "nope" })).status).toBe(401);
    expect((await postForm("/admin/login", { email: customer.email, password: "Rider-Pass-2026" })).status).toBe(401);
  });

  it("lets the login form through without a CSRF token (there's no session yet)", async () => {
    const res = await postForm("/admin/login", { email: uniqueEmail("x"), password: "y" });
    expect(res.status).toBe(401);
  });
});

describe("Google login", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Fakes Google's token and user-info endpoints. Returns the token request bodies it received. */
  function mockGoogle(user: Record<string, unknown>) {
    const tokenRequests: URLSearchParams[] = [];
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "https://oauth2.googleapis.com/token") {
        tokenRequests.push(new URLSearchParams(String(init?.body)));
        return Response.json({ access_token: "fake-access-token" });
      }
      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") return Response.json(user);
      return realFetch(input, init);
    });
    return tokenRequests;
  }

  /** Starts the flow; returns the state Google would echo back and the browser's state cookie. */
  async function start(path: string, cookieName: string) {
    const res = await callWorker(path);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location")!);
    return { location, state: location.searchParams.get("state")!, cookie: cookieFrom(res, cookieName)! };
  }

  it("sends the visitor to Google with state and PKCE", async () => {
    const { location, cookie } = await start("/auth/google", "mdb_oauth");
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/google/callback`);
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(cookie).toBeTruthy();
  });

  it("creates a customer from a new Google account and logs them in", async () => {
    const email = uniqueEmail("google");
    const tokenRequests = mockGoogle({ sub: `g-${crypto.randomUUID()}`, email, email_verified: true, name: "Google Rider", picture: "https://lh3.googleusercontent.com/a/x" });
    const { state, cookie } = await start("/auth/google", "mdb_oauth");

    const res = await callWorker(`/auth/google/callback?state=${state}&code=abc`, { headers: { Cookie: cookie } });
    expect(res.headers.get("Location")).toBe("/account");
    expect(cookieFrom(res, "mdb_customer")).toBeTruthy();
    expect(tokenRequests[0]!.get("code_verifier")).toBeTruthy();
    expect(tokenRequests[0]!.get("client_secret")).toBe("test-google-client-secret");

    const sql = await testSql();
    const [row] = await sql<{ auth_provider: string; password: string; full_name: string }[]>`
      SELECT auth_provider, password, full_name FROM customers WHERE email = ${email}`;
    expect(row).toEqual({ auth_provider: "google", password: NO_PASSWORD, full_name: "Google Rider" });
  });

  it("links Google to an existing customer with the same email", async () => {
    const existing = await phpCustomer({ name: "Existing Name" });
    mockGoogle({ sub: `g-${crypto.randomUUID()}`, email: existing.email, email_verified: true, name: "Other Name" });
    const { state, cookie } = await start("/auth/google", "mdb_oauth");
    await callWorker(`/auth/google/callback?state=${state}&code=abc`, { headers: { Cookie: cookie } });

    const sql = await testSql();
    const rows = await sql<{ id: string; auth_provider: string; full_name: string; password: string }[]>`
      SELECT id, auth_provider, full_name, password FROM customers WHERE email = ${existing.email}`;
    expect(rows.length).toBe(1);
    expect(Number(rows[0]!.id)).toBe(existing.id);
    expect(rows[0]!.auth_provider).toBe("google");
    expect(rows[0]!.full_name).toBe("Existing Name");
    expect(rows[0]!.password).toBe(PHP_HASH_RIDER);
  });

  it("rejects a callback whose state doesn't match", async () => {
    mockGoogle({ sub: "x", email: uniqueEmail("g"), email_verified: true });
    const { cookie } = await start("/auth/google", "mdb_oauth");
    const res = await callWorker("/auth/google/callback?state=forged&code=abc", { headers: { Cookie: cookie } });
    expect(res.headers.get("Location")).toBe("/login");
    expect(cookieFrom(res, "mdb_customer")).toBeUndefined();
  });

  it("rejects Google accounts without a verified email", async () => {
    mockGoogle({ sub: "x", email: uniqueEmail("g"), email_verified: false });
    const { state, cookie } = await start("/auth/google", "mdb_oauth");
    const res = await callWorker(`/auth/google/callback?state=${state}&code=abc`, { headers: { Cookie: cookie } });
    expect(res.headers.get("Location")).toBe("/login");
    expect(cookieFrom(res, "mdb_customer")).toBeUndefined();
  });

  it("logs in an admin whose email is in the admin table, and refuses others", async () => {
    const admin = await phpAdmin();
    mockGoogle({ sub: "g-admin", email: admin.email, email_verified: true, name: "Admin" });
    let flow = await start("/admin/auth/google", "mdb_admin_oauth");
    let res = await callWorker(`/admin/auth/google/callback?state=${flow.state}&code=abc`, { headers: { Cookie: flow.cookie } });
    expect(res.headers.get("Location")).toBe("/admin");
    expect(cookieFrom(res, "mdb_admin")).toBeTruthy();

    vi.restoreAllMocks();
    const outsider = uniqueEmail("outsider");
    mockGoogle({ sub: "g-out", email: outsider, email_verified: true });
    flow = await start("/admin/auth/google", "mdb_admin_oauth");
    res = await callWorker(`/admin/auth/google/callback?state=${flow.state}&code=abc`, { headers: { Cookie: flow.cookie } });
    expect(res.headers.get("Location")).toBe("/admin/login");
    expect(cookieFrom(res, "mdb_admin")).toBeUndefined();
    const page = await callWorker("/admin/login", { headers: { Cookie: cookieFrom(res, "mdb_flash")! } });
    expect(await page.text()).toContain(`Access Denied: The Google account (${outsider}) is not registered as an administrator.`);
  });

  it("hides the Google button and refuses the flow when Google isn't configured", async () => {
    const off = { GOOGLE_CLIENT_ID: "" as const, GOOGLE_CLIENT_SECRET: undefined };
    const page = await callWorker("/login", {}, off);
    expect(await page.text()).not.toContain('href="/auth/google"');
    const res = await callWorker("/auth/google", {}, off);
    expect(res.headers.get("Location")).toBe("/login");
  });
});
