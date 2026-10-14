import type { Context } from "hono";
import type { AppEnv } from "../types";

/**
 * Limits login and sign-up attempts (wrangler.jsonc: 10 per minute) per IP
 * address and, when given, per email, so one address can't try many passwords
 * and one account can't be attacked from many addresses quickly.
 *
 * Returns true if the attempt may go ahead.
 */
export async function allowLoginAttempt(c: Context<AppEnv>, scope: string, email?: string): Promise<boolean> {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const keys = [`${scope}:ip:${ip}`];
  if (email) keys.push(`${scope}:email:${email.toLowerCase()}`);

  const results = await Promise.all(keys.map((key) => c.env.LOGIN_LIMITER.limit({ key })));
  return results.every((r) => r.success);
}

export const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a minute and try again.";
