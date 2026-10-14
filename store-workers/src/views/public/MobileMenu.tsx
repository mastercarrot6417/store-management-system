import { categoryUrl } from "../../lib/catalog";

type MobileMenuProps = {
  isLoggedIn: boolean;
  customerName: string;
};

/** Slide-out mobile menu, ported from includes/public_mobile_menu.php. */
export function MobileMenu({ isLoggedIn, customerName }: MobileMenuProps) {
  return (
    <>
      <div class="mobile-menu-overlay" id="mobileMenuOverlay" hidden></div>
      <aside class="mobile-menu-drawer" id="mobileMenuDrawer" aria-hidden="true" aria-label="Mobile navigation" hidden>
        <div class="mobile-menu-top">
          <a href="/" class="mobile-menu-logo" aria-label="My Dream Bike home">
            <img src="/company_logo/ori.logo.png" alt="My Dream Bike" />
          </a>
          <button type="button" class="mobile-menu-close" onclick="closeMobileMenu()" aria-label="Close menu">×</button>
        </div>

        <form class="mobile-menu-search" method="get" action="/">
          <span aria-hidden="true">⌕</span>
          <input type="text" name="search" placeholder="Search products..." />
          <button type="submit">Search</button>
        </form>

        <div class="mobile-menu-section">
          <p class="mobile-menu-title">Main Menu</p>
          <a href="/" class="mobile-menu-link"><span class="mobile-link-icon">⌂</span><span>Home</span><b>›</b></a>
          <a href={categoryUrl("Helmet")} class="mobile-menu-link"><span class="mobile-link-icon">◒</span><span>Helmets</span><b>›</b></a>
          <a href={categoryUrl("Apparel")} class="mobile-menu-link"><span class="mobile-link-icon">◫</span><span>Apparel</span><b>›</b></a>
          <a href={categoryUrl("Accessories")} class="mobile-menu-link"><span class="mobile-link-icon">✋</span><span>Accessories</span><b>›</b></a>
          <a href="/#new-arrivals" class="mobile-menu-link"><span class="mobile-link-icon">✦</span><span>New Arrivals</span><em>NEW</em><b>›</b></a>
          <a href="/#location" class="mobile-menu-link"><span class="mobile-link-icon">⌖</span><span>Store Location</span><b>›</b></a>
        </div>

        <div class="mobile-menu-section">
          <p class="mobile-menu-title">My Account</p>
          {isLoggedIn ? (
            <>
              <a href="/account" class="mobile-menu-link"><span class="mobile-link-icon">♙</span><span>{customerName || "My Account"}</span><b>›</b></a>
              <a href="/logout" class="mobile-menu-link"><span class="mobile-link-icon">⇥</span><span>Log Out</span><b>›</b></a>
            </>
          ) : (
            <>
              <a href="/login" class="mobile-menu-link"><span class="mobile-link-icon">♙</span><span>Login</span><b>›</b></a>
              <a href="/signup" class="mobile-menu-link"><span class="mobile-link-icon">＋</span><span>Sign Up</span><b>›</b></a>
            </>
          )}
          <span class="mobile-menu-link mobile-menu-disabled"><span class="mobile-link-icon">🛒</span><span>Cart</span><small>Coming Soon</small></span>
        </div>

        <div class="mobile-menu-section mobile-menu-follow">
          <p class="mobile-menu-title">Follow Us</p>
          <div class="mobile-socials">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">◎</a>
            <a href="#" aria-label="TikTok">♪</a>
          </div>
        </div>
      </aside>
    </>
  );
}
