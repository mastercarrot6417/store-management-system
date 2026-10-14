import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import type { Flash } from "../../lib/flash";
import type { AdminUser } from "../../lib/session";
import { Document } from "../Document";

export type AdminNavKey = "dashboard" | "products" | "add-product" | "stock-report" | "stock-in" | "stock-out";

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 13h8V3H3v10Z"/><path d="M13 21h8V11h-8v10Z"/><path d="M13 3v6h8V3h-8Z"/><path d="M3 21h8v-6H3v6Z"/></svg>',
  products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11h6"/><path d="M9 15h6"/><path d="M9 7h6"/><path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/></svg>',
  stock_in: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14"/><path d="M5 12h14"/><path d="M4 4h16v16H4z"/></svg>',
  stock_out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/><path d="M4 4h16v16H4z"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9h18l-1.5-5h-15L3 9Z"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 20v-6h6v6"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg>',
};

const NAV: { key: AdminNavKey; href: string; label: string; icon: keyof typeof ICONS }[] = [
  { key: "dashboard", href: "/admin", label: "Dashboard", icon: "dashboard" },
  { key: "products", href: "/admin/products", label: "Products", icon: "products" },
  { key: "add-product", href: "/admin/products/new", label: "Add Product", icon: "add" },
  { key: "stock-report", href: "/admin/reports/stock", label: "Stock Report", icon: "stock" },
  { key: "stock-in", href: "/admin/stock/in", label: "Stock In", icon: "stock_in" },
  { key: "stock-out", href: "/admin/stock/out", label: "Stock Out", icon: "stock_out" },
];

type AdminLayoutProps = {
  title: string;
  admin: AdminUser;
  active: AdminNavKey;
  flash: Flash | null;
  children: Child;
};

/** Admin page frame: sidebar, top bar, flash message. Ported from admin/includes/header.php + footer.php. */
export function AdminLayout({ title, admin, active, flash, children }: AdminLayoutProps) {
  const isBoss = admin.role === "boss";
  const roleLabel = isBoss ? "Boss Admin" : "Staff Admin";

  return (
    <Document
      title={`${title} - My Dream Bike Admin`}
      fonts="admin"
      bodyClass="admin-panel-body"
      stylesheets={["/assets/css/style.css", "/assets/css/admin.css"]}
      scripts={["/assets/js/app.js", "/assets/js/admin.js"]}
    >
      <div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleAdminSidebar(false)"></div>
      <div class="admin-wrapper">
        <aside id="admin-sidebar" class="sidebar">
          <div class="sidebar-brand">
            <img src="/company_logo/ori.logo.png" alt="My Dream Bike" class="sidebar-logo-img" />
            <div class="sidebar-brand-text">
              <strong>My Dream Bike</strong>
              <span>Admin Panel</span>
              <span class={`admin-role-pill ${isBoss ? "boss" : ""}`}>{roleLabel}</span>
            </div>
          </div>
          <ul class="nav-menu">
            {NAV.map((item) => (
              <li>
                <a href={item.href} class={item.key === active ? "active" : ""}>
                  {raw(ICONS[item.icon])} {item.label}
                </a>
              </li>
            ))}
            <li><a href="/">{raw(ICONS.store)} View Website</a></li>
            <li class="sidebar-divider"></li>
            <li><a href="/admin/logout">{raw(ICONS.logout)} Logout</a></li>
          </ul>
        </aside>

        <main class="admin-content">
          <div class="admin-topbar">
            <div class="admin-topbar-left">
              <button class="admin-mobile-toggle" type="button" onclick="toggleAdminSidebar(true)" aria-label="Open admin menu">
                <span></span><span></span><span></span>
              </button>
              <div>
                <h1>{title}</h1>
                <p class="admin-topbar-subtitle">Manage store products, inventory and reports.</p>
              </div>
            </div>
            <div class="admin-user">
              <span>Welcome, {admin.displayName}</span>
              <span class={`admin-role-badge ${isBoss ? "boss" : ""}`}>{roleLabel}</span>
            </div>
          </div>

          {flash && (
            <div class={`alert ${flash.kind === "success" ? "alert-success" : "alert-danger"}`}>{flash.message}</div>
          )}

          {children}
        </main>
      </div>
    </Document>
  );
}
