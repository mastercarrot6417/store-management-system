import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "../types";

/**
 * One-time messages shown on the next page ("Product saved", "Invalid
 * password"), replacing $_SESSION['success'] / $_SESSION['error'].
 * Stored in a short-lived signed cookie so they also work before login.
 */

export type Flash = { kind: "success" | "error"; message: string };

const COOKIE = "mdb_flash";

export async function setFlash(c: Context<AppEnv>, kind: Flash["kind"], message: string): Promise<void> {
  await setSignedCookie(c, COOKIE, JSON.stringify({ kind, message }), c.env.COOKIE_SECRET, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60,
  });
}

function parseFlash(value: string | false | undefined): Flash | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Flash>;
    if ((parsed.kind === "success" || parsed.kind === "error") && typeof parsed.message === "string") {
      return { kind: parsed.kind, message: parsed.message };
    }
  } catch {
    // Ignore malformed values.
  }
  return null;
}

/** On page views, reads the pending message into `c.var.flash` and clears it. */
export const flashMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  let flash: Flash | null = null;
  if (c.req.method === "GET") {
    const raw = await getSignedCookie(c, c.env.COOKIE_SECRET, COOKIE);
    if (raw !== undefined) {
      flash = parseFlash(raw);
      deleteCookie(c, COOKIE, { path: "/", secure: true });
    }
  }
  c.set("flash", flash);
  await next();
});
