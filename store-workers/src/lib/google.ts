import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { randomToken, timingSafeEqualText } from "./runtime";

/**
 * "Continue with Google" (OAuth 2.0 authorization code flow), ported from
 * config/google_customer.php and config/google_oauth.php, plus PKCE.
 *
 * One Google OAuth client serves both customers and admins. Its "Authorized
 * redirect URIs" in Google Cloud Console must include, for every site address:
 *   https://<site>/auth/google/callback
 *   https://<site>/admin/auth/google/callback
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleFlow = { cookieName: string; cookiePath: string; callbackPath: string };

export const CUSTOMER_GOOGLE: GoogleFlow = {
  cookieName: "mdb_oauth",
  cookiePath: "/auth/google",
  callbackPath: "/auth/google/callback",
};

export const ADMIN_GOOGLE: GoogleFlow = {
  cookieName: "mdb_admin_oauth",
  cookiePath: "/admin/auth/google",
  callbackPath: "/admin/auth/google/callback",
};

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
};

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(c: Context<AppEnv>, flow: GoogleFlow): string {
  return new URL(flow.callbackPath, c.req.url).toString();
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Sends the visitor to Google's account chooser. */
export async function startGoogleLogin(c: Context<AppEnv>, flow: GoogleFlow): Promise<Response> {
  const state = randomToken();
  const verifier = randomToken(48);
  await setSignedCookie(c, flow.cookieName, JSON.stringify({ state, verifier }), c.env.COOKIE_SECRET, {
    path: flow.cookiePath,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(c, flow),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
  });
  return c.redirect(`${AUTH_URL}?${params}`);
}

export type GoogleResult = { ok: true; profile: GoogleProfile } | { ok: false; message: string };

/** Handles Google's redirect back: checks the state, swaps the code for the visitor's profile. */
export async function finishGoogleLogin(c: Context<AppEnv>, flow: GoogleFlow): Promise<GoogleResult> {
  const saved = await getSignedCookie(c, c.env.COOKIE_SECRET, flow.cookieName);
  deleteCookie(c, flow.cookieName, { path: flow.cookiePath, secure: true });

  if (c.req.query("error")) return { ok: false, message: "Google login was cancelled." };

  let pending: { state?: unknown; verifier?: unknown } = {};
  try {
    pending = saved ? JSON.parse(saved) : {};
  } catch {
    pending = {};
  }
  const state = c.req.query("state") ?? "";
  const code = c.req.query("code") ?? "";
  if (typeof pending.state !== "string" || typeof pending.verifier !== "string" || !timingSafeEqualText(state, pending.state)) {
    return { ok: false, message: "This Google login has expired. Please try again." };
  }
  if (!code) return { ok: false, message: "Google login failed. Please try again." };

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(c, flow),
      grant_type: "authorization_code",
      code_verifier: pending.verifier,
    }),
  });
  const token = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !token.access_token) {
    console.error("Google token exchange failed:", tokenResponse.status, token.error);
    return { ok: false, message: "Google login failed. Please try again." };
  }

  const userResponse = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
  const user = (await userResponse.json().catch(() => ({}))) as {
    sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string;
  };
  if (!userResponse.ok || !user.sub || !user.email) {
    console.error("Google user info failed:", userResponse.status);
    return { ok: false, message: "Google login failed. Please try again." };
  }
  if (user.email_verified !== true) {
    return { ok: false, message: "Please use a Google account with a verified email address." };
  }

  return {
    ok: true,
    profile: { sub: user.sub, email: user.email, name: user.name || user.email, picture: user.picture || null },
  };
}
