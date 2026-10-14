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
