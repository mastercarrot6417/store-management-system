import type { Context } from "hono";
import type { Child } from "hono/jsx";
import { createMiddleware } from "hono/factory";
import { setFlash } from "../../lib/flash";
import type { AdminUser } from "../../lib/session";
import type { AppEnv } from "../../types";
import { AdminLayout, type AdminNavKey } from "../../views/admin/AdminLayout";

/** Helpers shared by the admin page routes. All of these run behind requireAdmin. */

export function currentAdmin(c: Context<AppEnv>): AdminUser {
  return c.var.adminSession!.user;
}

export function csrfToken(c: Context<AppEnv>): string {
  return c.var.adminSession!.csrfToken;
}

export function renderAdmin(
  c: Context<AppEnv>,
  page: { title: string; active: AdminNavKey | null },
  content: Child,
  status: 200 | 400 = 200,
) {
  return c.html(
    <AdminLayout title={page.title} admin={currentAdmin(c)} active={page.active} flash={c.var.flash}>
      {content}
    </AdminLayout>,
    status,
  );
}

/** A whole-number ID from a form field or query value, or 0 if it isn't one. */
export function toId(value: unknown): number {
  return typeof value === "string" && /^\d{1,15}$/.test(value.trim()) ? Number(value.trim()) : 0;
}

/** Route parameter that only matches digits, e.g. "/:id{[0-9]+}". */
export const ID = "{[0-9]{1,15}}";

/** Boss-only actions: anyone else is sent back with a message. */
export const requireBoss = (message: string, redirectTo: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (currentAdmin(c).role !== "boss") {
      await setFlash(c, "error", message);
      return c.redirect(redirectTo);
    }
    await next();
  });

/** Sends the admin back to `to` with a one-time message. */
export async function redirectWithFlash(c: Context<AppEnv>, to: string, kind: "success" | "error", message: string) {
  await setFlash(c, kind, message);
  return c.redirect(to);
}
