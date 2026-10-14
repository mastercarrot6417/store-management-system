import { Hono } from "hono";
import { requireCsrfToken } from "../lib/csrf";
import { setFlash } from "../lib/flash";
import { adminSessionMiddleware, endSession, requireAdmin } from "../lib/session";
import type { AppEnv } from "../types";
import { AdminLayout } from "../views/admin/AdminLayout";
import { Document } from "../views/Document";

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", adminSessionMiddleware);

// ---- Pages that work without being logged in (must be registered before requireAdmin) ----

// Placeholder until the real login is ported in Phase 3.
adminRoutes.get("/login", (c) => {
  if (c.var.adminSession) return c.redirect("/admin");
  const flash = c.var.flash;
  return c.html(
    <Document title="Admin Login - My Dream Bike" fonts="admin" stylesheets={["/assets/css/style.css"]}>
      <div class="login-container">
        <div class="login-box">
          <div class="auth-brand-logo"><img src="/company_logo/ori.logo.png" alt="My Dream Bike" /></div>
          <h2>Admin Login</h2>
          {flash && <div class={flash.kind === "success" ? "success-msg" : "error-msg"}>{flash.message}</div>}
          <p class="login-subtitle">The new admin login is being built in Phase 3 of the rewrite.</p>
        </div>
      </div>
    </Document>,
  );
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
