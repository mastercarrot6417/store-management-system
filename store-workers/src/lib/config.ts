import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Stops every request with a clear log message if a required secret is
 * missing, instead of failing later in a confusing way.
 */
export const requireConfig = createMiddleware<AppEnv>(async (c, next) => {
  const secret = c.env.COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "COOKIE_SECRET is missing or shorter than 32 characters. Set it in .env locally, or with `npx wrangler secret put COOKIE_SECRET`.",
    );
  }
  await next();
});

/** Google Maps link for the store, falling back to a search for the shop's name. */
export function storeMapLink(env: Env): string {
  if (env.COMPANY_MAP_LINK) return env.COMPANY_MAP_LINK;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(env.COMPANY_MAP_QUERY)}`;
}
