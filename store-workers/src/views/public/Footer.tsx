import { CATEGORIES, categoryUrl } from "../../lib/catalog";

type FooterProps = {
  /** Google Maps link for the store. */
  mapLink: string;
};

/** Site footer and cookie banner, ported from includes/public_footer.php. */
export function Footer({ mapLink }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <>
      <footer class="site-footer premium-footer brand-directory-footer">
        <div class="footer-inner footer-directory-grid">
          <div class="footer-brand-panel">
            <a href="/" class="footer-logo footer-logo-image" aria-label="My Dream Bike home">
              <img src="/company_logo/ori.logo.png" alt="My Dream Bike" class="footer-logo-img" />
            </a>
            <div class="footer-socials" aria-label="Social media links">
              <a href="#" aria-label="Facebook">f</a>
              <a href="#" aria-label="Instagram">◎</a>
              <a href="#" aria-label="YouTube">▶</a>
              <a href="#" aria-label="TikTok">♪</a>
            </div>
          </div>

          {CATEGORIES.map((category) => (
            <div class="footer-links">
              <h4>{category.label}</h4>
              <ul>
                {category.subCategories.map((sub) => (
                  <li><a href={categoryUrl(category.value, sub.value)}>{sub.label}</a></li>
                ))}
              </ul>
            </div>
          ))}

          <div class="footer-links">
            <h4>Support</h4>
            <ul>
              <li><a href="mailto:hello@mydreambike.my">Contact</a></li>
              <li><a href={mapLink} target="_blank" rel="noopener">Store Location</a></li>
              <li><a href="/legal/privacy">Privacy Policy</a></li>
              <li><a href="/legal/terms">Terms &amp; Conditions</a></li>
              <li><a href="/legal/cookies">Cookie Notice</a></li>
            </ul>
          </div>
        </div>

        <div class="footer-legal-row">
          <a href="/legal/cookies">Cookie Notice</a>
          <span>|</span>
          <a href="/legal/privacy">Privacy Policy</a>
          <span>|</span>
          <a href="/legal/terms">Terms &amp; Conditions</a>
        </div>

        <div class="footer-bottom footer-disclaimer">
          <p>© {year} <span>My Dream Bike</span>. All rights reserved.</p>
          <p class="footer-note">Product images are for illustration purposes only. Actual product details, stock, and pricing may vary.</p>
        </div>
      </footer>

      <div class="cookie-banner" id="cookieBanner" hidden>
        <div class="cookie-copy">
          <strong>Cookies on My Dream Bike</strong>
          <p>We use necessary cookies to keep you logged in and support website features such as Google Maps.</p>
        </div>
        <div class="cookie-actions">
          <a href="/legal/cookies">Learn More</a>
          <button type="button" id="cookieAcceptBtn">Accept</button>
        </div>
      </div>
    </>
  );
}
