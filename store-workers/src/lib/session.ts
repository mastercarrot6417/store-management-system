import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import type { Sql } from "./db";
import { randomToken, sha256Hex } from "./runtime";

/**
 * Login sessions, replacing PHP's $_SESSION.
 *
 * Admins and customers get separate cookies. The admin cookie is limited to
 * /admin, so it's never sent with public shop requests. The cookie holds a
 * random token; the database only stores its SHA-256 hash.
 */

export type UserType = "admin" | "customer";

export interface AdminUser {
  id: number;
  email: string;
  role: "boss" | "admin";
  displayName: string;
}

export interface CustomerUser {
  id: number;
  email: string;
  fullName: string;
}

export interface Session<User> {
  user: User;
  csrfToken: string;
}

const COOKIE_NAME: Record<UserType, string> = { admin: "mdb_admin", customer: "mdb_customer" };
const COOKIE_PATH: Record<UserType, string> = { admin: "/admin", customer: "/" };

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** Logged out after `idle` seconds of no activity, and after `absolute` seconds no matter what. */
export const SESSION_LIFETIME: Record<UserType, { idle: number; absolute: number }> = {
  admin: { idle: 2 * HOUR, absolute: 12 * HOUR },
  customer: { idle: 30 * DAY, absolute: 90 * DAY },
};

/** Refresh last_seen_at at most this often, to avoid a database write on every page view. */
const TOUCH_INTERVAL_SECONDS = 5 * 60;

/**
 * Inserts a session row and returns the raw cookie token.
 * Exported separately so tests can create sessions without going through a login form.
 */
export async function createSessionRow(sql: Sql, type: UserType, userId: number): Promise<string> {
  const token = randomToken();
  await sql`
    INSERT INTO sessions (id_hash, user_type, user_id, csrf_token, expires_at)
    VALUES (
      ${await sha256Hex(token)}, ${type}, ${userId}, ${randomToken()},
      NOW() + make_interval(secs => ${SESSION_LIFETIME[type].absolute})
    )`;
  return token;
}

/**
 * Logs a user in. Any session already in the browser for this user type is
 * deleted first, so a session ID planted before login can't be reused.
 */
export async function startSession(c: Context<AppEnv>, type: UserType, userId: number): Promise<void> {
  await deleteCurrentSessionRow(c, type);
  const token = await createSessionRow(c.var.db, type, userId);
  setCookie(c, COOKIE_NAME[type], token, {
    path: COOKIE_PATH[type],
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_LIFETIME[type].absolute,
  });
}

export async function endSession(c: Context<AppEnv>, type: UserType): Promise<void> {
  await deleteCurrentSessionRow(c, type);
  deleteCookie(c, COOKIE_NAME[type], { path: COOKIE_PATH[type], secure: true });
}

async function deleteCurrentSessionRow(c: Context<AppEnv>, type: UserType): Promise<void> {
  const token = getCookie(c, COOKIE_NAME[type]);
  if (!token) return;
  await c.var.db`DELETE FROM sessions WHERE id_hash = ${await sha256Hex(token)}`;
}

type SessionRow = { id_hash: string; csrf_token: string; needs_touch: boolean };

async function touchIfNeeded(sql: Sql, row: SessionRow): Promise<void> {
  if (row.needs_touch) {
    await sql`UPDATE sessions SET last_seen_at = NOW() WHERE id_hash = ${row.id_hash}`;
  }
}

/** Shared WHERE conditions: the session exists, is the right type, and hasn't expired. */
function validSessionCondition(sql: Sql, type: UserType, idHash: string) {
  return sql`
    s.id_hash = ${idHash}
    AND s.user_type = ${type}
    AND s.expires_at > NOW()
    AND s.last_seen_at > NOW() - make_interval(secs => ${SESSION_LIFETIME[type].idle})`;
}

/**
 * Reads the admin session. Role and name come from the admin table on every
 * request, so a role change or a deleted admin takes effect immediately.
 */
export async function loadAdminSession(c: Context<AppEnv>): Promise<Session<AdminUser> | null> {
  const token = getCookie(c, COOKIE_NAME.admin);
  if (!token) return null;

  const sql = c.var.db;
  const [row] = await sql<(SessionRow & { id: string; email: string; role: string | null; display_name: string })[]>`
    SELECT s.id_hash, s.csrf_token,
           s.last_seen_at < NOW() - make_interval(secs => ${TOUCH_INTERVAL_SECONDS}) AS needs_touch,
           a.id, a.email, a.role,
           COALESCE(NULLIF(a.display_name, ''), a.email) AS display_name
    FROM sessions s
    JOIN admin a ON a.id = s.user_id
    WHERE ${validSessionCondition(sql, "admin", await sha256Hex(token))}`;
  if (!row) return null;

  await touchIfNeeded(sql, row);
  return {
    csrfToken: row.csrf_token,
    user: {
      id: Number(row.id),
      email: row.email,
      role: row.role === "boss" ? "boss" : "admin",
      displayName: row.display_name,
    },
  };
}

export async function loadCustomerSession(c: Context<AppEnv>): Promise<Session<CustomerUser> | null> {
  const token = getCookie(c, COOKIE_NAME.customer);
  if (!token) return null;

  const sql = c.var.db;
  const [row] = await sql<(SessionRow & { id: string; email: string; full_name: string })[]>`
    SELECT s.id_hash, s.csrf_token,
           s.last_seen_at < NOW() - make_interval(secs => ${TOUCH_INTERVAL_SECONDS}) AS needs_touch,
           cu.id, cu.email, cu.full_name
    FROM sessions s
    JOIN customers cu ON cu.id = s.user_id
    WHERE ${validSessionCondition(sql, "customer", await sha256Hex(token))}`;
  if (!row) return null;

  await touchIfNeeded(sql, row);
  return {
    csrfToken: row.csrf_token,
    user: { id: Number(row.id), email: row.email, fullName: row.full_name },
  };
}

/** Sets `c.var.adminSession` (or null). */
export const adminSessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("adminSession", await loadAdminSession(c));
  await next();
});

/** Sets `c.var.customerSession` (or null). */
export const customerSessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("customerSession", await loadCustomerSession(c));
  await next();
});

/**
 * Blocks anyone not logged in as an admin. Pages behind this are never cached
 * by the browser, so admin data doesn't linger after logout.
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.adminSession) {
    return c.redirect("/admin/login");
  }
  await next();
  c.header("Cache-Control", "no-store");
});

export async function deleteExpiredSessions(sql: Sql): Promise<number> {
  const deleted = await sql`
    DELETE FROM sessions
    WHERE expires_at <= NOW()
       OR (user_type = 'admin' AND last_seen_at <= NOW() - make_interval(secs => ${SESSION_LIFETIME.admin.idle}))
       OR (user_type = 'customer' AND last_seen_at <= NOW() - make_interval(secs => ${SESSION_LIFETIME.customer.idle}))`;
  return deleted.count;
}
