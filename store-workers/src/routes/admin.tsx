import { Hono } from "hono";
import { requireCsrfToken } from "../lib/csrf";
import { setFlash } from "../lib/flash";
import { adminSessionMiddleware, endSession, requireAdmin, startSession } from "../lib/session";
import { findAdminForLogin, findAdminIdByEmail } from "../lib/accounts";
import { ADMIN_GOOGLE, finishGoogleLogin, googleConfigured, startGoogleLogin } from "../lib/google";
import { verifyPassword } from "../lib/passwords";
import { allowLoginAttempt, TOO_MANY_ATTEMPTS } from "../lib/rate-limit";
import type { AppEnv } from "../types";
import { AdminLayout } from "../views/admin/AdminLayout";
import { AdminLoginPage } from "../views/auth/AuthPages";
import { formText } from "./render";

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", adminSessionMiddleware);

// ---- Pages that work without being logged in (must be registered before requireAdmin) ----

adminRoutes.get("/login", (c) => {
  if (c.var.adminSession) return c.redirect("/admin");
  return c.html(<AdminLoginPage email="" error={null} flash={c.var.flash} googleEnabled={googleConfigured(c.env)} />);
});

adminRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = formText(body, "email", 254);
  // The PHP admin login trimmed passwords too.
  const password = formText(body, "password", 500);
  const fail = (error: string, status: 400 | 401 | 429) =>
    c.html(<AdminLoginPage email={email} error={error} flash={null} googleEnabled={googleConfigured(c.env)} />, status);

  if (!email || !password) return fail("Please fill in all fields.", 400);
  if (!(await allowLoginAttempt(c, "admin-login", email))) return fail(TOO_MANY_ATTEMPTS, 429);

  const admin = await findAdminForLogin(c.var.db, email);
  if (!(await verifyPassword(password, admin?.password ?? null)) || !admin) return fail("Invalid email or password.", 401);

  await startSession(c, "admin", admin.id);
  return c.redirect("/admin");
});

adminRoutes.get("/auth/google", async (c) => {
  if (!googleConfigured(c.env)) {
    await setFlash(c, "error", "Google login is not available right now.");
    return c.redirect("/admin/login");
  }
  return startGoogleLogin(c, ADMIN_GOOGLE);
});

adminRoutes.get("/auth/google/callback", async (c) => {
  if (!googleConfigured(c.env)) return c.redirect("/admin/login");

  const result = await finishGoogleLogin(c, ADMIN_GOOGLE);
  if (!result.ok) {
    await setFlash(c, "error", result.message);
    return c.redirect("/admin/login");
  }

  const adminId = await findAdminIdByEmail(c.var.db, result.profile.email);
  if (adminId === null) {
    await setFlash(c, "error", `Access Denied: The Google account (${result.profile.email}) is not registered as an administrator.`);
    return c.redirect("/admin/login");
  }
  await startSession(c, "admin", adminId);
  return c.redirect("/admin");
});

adminRoutes.get("/logout", async (c) => {
  await endSession(c, "admin");
  await setFlash(c, "success", "You have been logged out.");
  return c.redirect("/admin/login");
});

// ---- Everything below needs an admin login, and forms need the session's CSRF token ----

adminRoutes.use("*", requireAdmin, requireCsrfToken((c) => c.var.adminSession));

// Placeholder until the real dashboard is ported in Phase 4.
adminRoutes.get("/", (c) => {
  const admin = c.var.adminSession!.user;
  return c.html(
    <AdminLayout title="Dashboard" admin={admin} active="dashboard" flash={c.var.flash}>
      <div class="admin-card">
        <h3 class="admin-card-title">New admin panel</h3>
        <p>The dashboard, products and stock pages arrive in Phase 4 of the rewrite.</p>
      </div>
    </AdminLayout>,
  );
});

export default adminRoutes;
