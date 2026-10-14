import { CATEGORIES, categoryUrl } from "../../lib/catalog";

/** Which top-level menu item to highlight: "home", a category value, or nothing. */
export type ActiveNav = "home" | string | null;

type NavbarProps = {
  active: ActiveNav;
  search: string;
  isLoggedIn: boolean;
};

/** Desktop navbar, ported from the top of index.php / product_detail.php. */
export function Navbar({ active, search, isLoggedIn }: NavbarProps) {
  return (
    <nav class="navbar desktop-navbar">
      <a href="/" class="logo logo-image-link">
        <img src="/company_logo/ori.logo.png" alt="My Dream Bike" class="site-logo-img" />
      </a>

      <ul class="nav-links desktop-nav-links" id="navLinks">
        <li>
          <a href="/" class={`nav-menu-link ${active === "home" ? "active" : ""}`}>Home</a>
        </li>
        {CATEGORIES.map((category) => (
          <li class="nav-item has-dropdown">
            <a href={categoryUrl(category.value)} class={`nav-menu-link ${active === category.value ? "active" : ""}`}>
              {category.label} <span class="nav-caret">▾</span>
            </a>
            <div class="nav-dropdown">
              {category.subCategories.map((sub) => (
                <a href={categoryUrl(category.value, sub.value)}>{sub.label}</a>
              ))}
            </div>
          </li>
        ))}
        <li><a href="/#new-arrivals" class="nav-menu-link">New Arrivals</a></li>
        <li><a href="/#location" class="nav-menu-link">Store Location</a></li>
      </ul>

      <div class="nav-right">
        <form class="nav-search" method="get" action="/">
          <input type="text" name="search" placeholder="Search products…" value={search} />
          <button type="submit" class="nav-search-btn" aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        </form>
        <div class="nav-account-dropdown">
          <button type="button" class="nav-account-btn" aria-expanded="false" aria-label="Customer account">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
            <span>Account</span>
            <b>▾</b>
          </button>
          <div class="nav-account-menu">
            {isLoggedIn ? (
              <>
                <a href="/account">My Account</a>
                <a href="/logout">Log Out</a>
              </>
            ) : (
              <>
                <a href="/login">Login</a>
                <a href="/signup">Sign Up</a>
              </>
            )}
          </div>
        </div>
        <button type="button" class="hamburger" onclick="toggleNav()" aria-label="Open mobile menu" aria-controls="mobileMenuDrawer">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
}
