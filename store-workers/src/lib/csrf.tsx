import { createMiddleware } from "hono/factory";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types";
import type { Session } from "./session";
import { timingSafeEqualText } from "./runtime";

/**
 * CSRF protection has two layers:
 *
 * 1. `originCheck` (every route): rejects form posts sent from another website,
 *    using the browser's Origin / Sec-Fetch-Site headers. This also covers
 *    login and sign-up forms, which run before a session exists.
 * 2. `requireCsrfToken` (logged-in routes): the form must also carry the
 *    session's secret token, as the PHP admin forms do today.
 */

/**
 * Paths that receive server-to-server POSTs from other sites (payment
 * gateway callbacks in Phase 6). These must verify the sender's signature instead.
 */
const EXTERNAL_CALLBACK_PREFIX = "/webhooks/";

export const originCheck = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.path.startsWith(EXTERNAL_CALLBACK_PREFIX)) return next();
  return csrf()(c, next);
});

export const CSRF_FIELD = "csrf_token";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Checks the form's csrf_token against the session picked by `getSession`. */
export function requireCsrfToken(getSession: (c: { var: AppEnv["Variables"] }) => Session<unknown> | null) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!UNSAFE_METHODS.has(c.req.method)) return next();

    const session = getSession(c);
    const body = await c.req.parseBody();
    const submitted = body[CSRF_FIELD];
    if (!session || typeof submitted !== "string" || !timingSafeEqualText(submitted, session.csrfToken)) {
      throw new HTTPException(403, { message: "CSRF token missing or invalid" });
    }
    await next();
  });
}

/** Hidden form field carrying the session's CSRF token. */
export function CsrfField({ token }: { token: string }) {
  return <input type="hidden" name={CSRF_FIELD} value={token} />;
}
