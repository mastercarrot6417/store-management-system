import { categoryUrl } from "../../lib/catalog";
import type { ProductCard } from "../../lib/products";
import { ArrivalCard, FeaturedCard } from "./ProductCards";

/** Brand strip. Brands without a logo file show their name instead (as in index.php). */
const BRANDS: { name: string; logo: string | null }[] = [
  { name: "LS2", logo: "/assets/brand-logos/Ls2-Logo-Vector.svg-.png" },
  { name: "KYT", logo: "/assets/brand-logos/Logo-KYT-Helmet-3.png" },
  { name: "GRACSHAW", logo: "/assets/brand-logos/gracshaw-logo.png" },
  { name: "GRAYFOSH", logo: null },
  { name: "MHR", logo: null },
  { name: "XDOT", logo: null },
  { name: "SGV", logo: null },
];

type HomePageProps = {
  newArrivals: ProductCard[];
  featured: ProductCard[];
  mapLink: string;
  mapsApiKey: string;
  mapQuery: string;
};

/** The landing page sections from index.php (shown when there's no search or filter). */
export function HomePage({ newArrivals, featured, mapLink, mapsApiKey, mapQuery }: HomePageProps) {
  return (
    <>
      <section class="hero-section reveal-on-scroll">
        <div class="hero-bg-accent"></div>
        <div class="hero-content">
          <div class="hero-text">
            <p class="hero-eyebrow">MY DREAM BIKE RIDING STORE</p>
            <h1 class="hero-headline">Ride With<br /><span>Confidence</span></h1>
            <p class="hero-sub">Explore quality helmets, riding apparel, and accessories made to support your daily rides and long-distance journeys.</p>
            <div class="hero-actions">
              <a href="#trending" class="btn-hero-primary">Shop Helmets</a>
              <a href={categoryUrl("Helmet")} class="btn-hero-ghost">Browse Helmets</a>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-img-wrapper">
              <img src="/company_logo/Hero.image.webp" alt="Premium motorcycle helmet hero image" />
            </div>
            <div class="hero-badge-float">
              <span class="badge-float-num">200+</span>
              <span class="badge-float-txt">Products</span>
            </div>
          </div>
        </div>
      </section>

      <section class="brand-logo-marquee reveal-on-scroll" aria-label="Helmet brand logo banner">
        <div class="brand-logo-marquee-head">
          <span>Trusted Riding Brands</span>
        </div>
        <div class="brand-logo-marquee-window">
          <div class="brand-logo-marquee-track">
            {/* The list is drawn twice so the scrolling strip loops seamlessly. */}
            {[...BRANDS, ...BRANDS].map((brand) => (
              <div class="brand-logo-item" title={brand.name}>
                {brand.logo ? (
                  <img src={brand.logo} alt={`${brand.name} logo`} />
                ) : (
                  <span class="brand-logo-fallback">{brand.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section class="arrivals-section reveal-on-scroll" id="new-arrivals">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Just landed</p>
            <h2 class="section-title-dark">New Arrivals</h2>
          </div>
          <a href={categoryUrl("Helmet")} class="view-all-link">View All →</a>
        </div>
        <div class="arrivals-grid">
          {newArrivals.length > 0 ? (
            newArrivals.map((product) => <ArrivalCard product={product} />)
          ) : (
            <p style="color:#888; grid-column:1/-1;">No new arrivals yet.</p>
          )}
        </div>
      </section>

      <section class="trending-section reveal-on-scroll" id="trending">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Hand-picked</p>
            <h2 class="section-title-dark">Featured Helmet Collection</h2>
            <p class="section-sub">Large-image product cards designed for quick browsing and a premium helmet-store feel.</p>
          </div>
          <a href={categoryUrl("Helmet")} class="view-all-link">View All →</a>
        </div>
        <div class="trending-grid">
          {featured.length > 0 ? (
            featured.map((product) => <FeaturedCard product={product} />)
          ) : (
            <p style="color:#888; grid-column:1/-1; padding:20px 0;">No featured products are available yet.</p>
          )}
        </div>
      </section>

      <section class="categories-section reveal-on-scroll">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Browse by type</p>
            <h2 class="section-title-dark">Shop By Riding Category</h2>
          </div>
        </div>
        <div class="cat-grid">
          <CategoryTile category="Helmet" image="/company_logo/helmet.jpg" cardClass="cat-helmet" />
          <CategoryTile category="Apparel" image="/company_logo/apparel.jpg" cardClass="cat-apparel" />
          <CategoryTile category="Accessories" image="/company_logo/accessories1.png" cardClass="cat-accessories" />
        </div>
      </section>

      <section class="company-location-section reveal-on-scroll" id="location">
        <div class="location-inner">
          <div class="location-copy">
            <p class="section-eyebrow">Visit Our Showroom</p>
            <h2 class="section-title-dark">Our Location</h2>
            <p>Come visit My Dream Bike showroom! Explore our extensive range of premium motorcycle helmets, riding gear, and accessories in person. Our friendly team is here to help you choose the best equipment for your safety and comfort.</p>
            <div class="location-details">
              <span>📍 Johor, Malaysia</span>
              <span>📞 +60 13-930 3655</span>
              <span>✉️ hello@mydreambike.my</span>
            </div>
            <a href={mapLink} target="_blank" rel="noopener noreferrer" class="location-map-btn">Visit Our Store</a>
          </div>
          <div class="location-map-wrapper">
            {mapsApiKey ? (
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsApiKey)}&q=${encodeURIComponent(mapQuery)}`}
                style="border:0;"
                allowfullscreen={true}
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="My Dream Bike on Google Maps"
              ></iframe>
            ) : (
              <div class="map-placeholder-box">
                <span>📍</span>
                <h3>Find us in-store</h3>
                <p>Johor, Malaysia</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function CategoryTile({ category, image, cardClass }: { category: string; image: string; cardClass: string }) {
  return (
    <a href={categoryUrl(category)} class="cat-item">
      <div class={`cat-card ${cardClass}`}>
        <div class="cat-img-wrap">
          <img src={image} alt={category} class="cat-card-img" />
        </div>
        <div class="cat-card-body">
          <h3 class="cat-name">{category}</h3>
          <p class="cat-cta">Shop now →</p>
        </div>
      </div>
    </a>
  );
}
