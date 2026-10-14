import type { DbVariables } from "./lib/db";
import type { Flash } from "./lib/flash";
import type { AdminUser, CustomerUser, Session } from "./lib/session";

export type AppVariables = DbVariables & {
  flash: Flash | null;
  /** Set on /admin routes. */
  adminSession: Session<AdminUser> | null;
  /** Set on public shop routes. */
  customerSession: Session<CustomerUser> | null;
};

export type AppEnv = { Bindings: Env; Variables: AppVariables };

declare global {
  interface Env {
    /** Optional secret (`npx wrangler secret put GOOGLE_CLIENT_SECRET`). Google login is hidden without it. */
    GOOGLE_CLIENT_SECRET?: string;
  }
}
