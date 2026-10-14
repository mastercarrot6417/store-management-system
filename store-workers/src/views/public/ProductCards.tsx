import { formatPrice, imageUrl } from "../../lib/format";
import { isInStock, type ProductCard } from "../../lib/products";

/** Product cards ported from index.php and product_detail.php. */

export function productUrl(id: number): string {
  return `/product/${id}`;
}

const NO_IMAGE_BOX_STYLE = "display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;background:#1e1e2e;";

/** Search / category results grid card. */
export function ResultCard({ product }: { product: ProductCard }) {
  const outOfStock = !isInStock(product);
  const src = imageUrl(product.image);
  return (
    <a href={productUrl(product.id)} class={`product-card ${outOfStock ? "is-out-of-stock" : ""}`}>
      {src ? (
        <img
          src={src}
          alt={product.name}
          class="card-image"
          loading="lazy"
          data-fallback-class="card-image"
          data-fallback-text="No Image"
          data-fallback-style={NO_IMAGE_BOX_STYLE}
        />
      ) : (
        <div class="card-image" style={NO_IMAGE_BOX_STYLE}>No Image</div>
      )}
      {outOfStock && <span class="product-stock-ribbon product-card-ribbon">Out of Stock</span>}
      <div class="card-body">
        <div class="card-category">{product.subCategory}</div>
        <div class="card-title">{product.name}</div>
        <div class="card-price">RM {formatPrice(product.price)}</div>
        <div class="card-meta">
          <span>{product.brand}</span>
          {outOfStock ? <span class="badge badge-danger">Out of Stock</span> : <span class="badge badge-success">In Stock</span>}
        </div>
      </div>
    </a>
  );
}

/** Homepage "New Arrivals" card. */
export function ArrivalCard({ product }: { product: ProductCard }) {
  const outOfStock = !isInStock(product);
  const src = imageUrl(product.image);
  return (
    <a href={productUrl(product.id)} class={`arrival-card ${outOfStock ? "is-out-of-stock" : ""}`}>
      {src ? (
        <img src={src} alt={product.name} class="arrival-img" data-fallback-class="arrival-img arrival-no-img" />
      ) : (
        <div class="arrival-img arrival-no-img"></div>
      )}
      {outOfStock && <span class="product-stock-ribbon">Out of Stock</span>}
      <div class="arrival-overlay">
        <span class={`arrival-tag ${outOfStock ? "arrival-tag-out" : ""}`}>{outOfStock ? "OUT OF STOCK" : "NEW"}</span>
        <h3 class="arrival-name">{product.name}</h3>
        <p class="arrival-price">RM {formatPrice(product.price)}</p>
        <span class="arrival-cta">{outOfStock ? "View Details →" : "View Product →"}</span>
      </div>
    </a>
  );
}

/** Homepage "Featured Helmet Collection" card. */
export function FeaturedCard({ product }: { product: ProductCard }) {
  const src = imageUrl(product.image);
  return (
    <a href={productUrl(product.id)} class="tcard">
      <div class="tcard-img-wrap">
        {src ? (
          <img src={src} alt={product.name} class="tcard-img" loading="lazy" data-fallback-class="tcard-no-img" data-fallback-text="No Image" />
        ) : (
          <div class="tcard-no-img">No Image</div>
        )}
        <span class="tcard-badge">NEW</span>
      </div>
      <div class="tcard-body">
        <p class="tcard-cat">{product.subCategory}</p>
        <h3 class="tcard-name">{product.name}</h3>
        <div class="tcard-stars">★★★★★</div>
        <p class="tcard-price">RM {formatPrice(product.price)}</p>
      </div>
    </a>
  );
}

/** Product page "Discover More" card. */
export function DiscoverCard({ product }: { product: ProductCard }) {
  const outOfStock = !isInStock(product);
  const src = imageUrl(product.image);
  return (
    <a href={productUrl(product.id)} class={`discover-card ${outOfStock ? "is-out-of-stock" : ""}`}>
      <div class="discover-card-image-wrap">
        {src ? (
          <img src={src} alt={product.name} class="discover-card-image" loading="lazy" data-fallback-class="discover-card-no-image" data-fallback-text="No Image" />
        ) : (
          <div class="discover-card-no-image">No Image</div>
        )}
        {outOfStock && <span class="product-stock-ribbon discover-stock-ribbon">Out of Stock</span>}
      </div>
      <div class="discover-card-body">
        <div class="discover-card-label">{product.subCategory || product.category}</div>
        <h3 class="discover-card-name">{product.name}</h3>
        <div class="discover-card-price">RM {formatPrice(product.price)}</div>
      </div>
    </a>
  );
}
