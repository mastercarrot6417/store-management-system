import { raw } from "hono/html";
import { formatPrice, imageUrl, jsonForScript } from "../../lib/format";
import { isInStock, type ProductPageData } from "../../lib/products";
import { DiscoverCard } from "./ProductCards";

/** Works out what the page shows before any colour or size is clicked (same rules as product_detail.php). */
export function initialSelection(product: ProductPageData) {
  const defaultColour = product.colours.find((c) => c.isDefault) ?? product.colours[0] ?? null;
  const defaultKey = defaultColour ? String(defaultColour.id) : "default";
  const currentImages = product.imagesByColour[defaultKey] ?? [];
  const sizes = product.sizesByColour[defaultKey] ?? [];
  const firstInStock = sizes.find((s) => s.quantity > 0)?.label ?? null;

  let sizeMessage: string;
  let sizeMessageClass = "";
  if (sizes.length === 0 && product.colours.length > 0) {
    sizeMessage = "No available sizes for this colour. Please select another colour or contact us for availability.";
    sizeMessageClass = "warning";
  } else if (sizes.length > 0 && firstInStock === null) {
    sizeMessage = "This colour is currently out of stock.";
    sizeMessageClass = "danger";
  } else if (sizes.length > 0) {
    sizeMessage = "Select an available size for this colour.";
  } else {
    sizeMessage = "No size information is available for this product yet.";
    sizeMessageClass = "warning";
  }

  return {
    defaultColour,
    defaultKey,
    currentImages,
    mainImage: imageUrl(currentImages[0]?.path) ?? imageUrl(product.legacyImage),
    mainImageAlt: currentImages[0]?.colorName || product.name,
    sizes,
    selectedSize: firstInStock ?? "—",
    selectedColourName: defaultColour?.name ?? "Default",
    sizeMessage,
    sizeMessageClass,
  };
}

/** Data for public/assets/js/product_detail.js. */
function scriptData(product: ProductPageData, defaultKey: string) {
  const imagesByColor: Record<string, { src: string | null; alt: string }[]> = {};
  for (const [key, images] of Object.entries(product.imagesByColour)) {
    imagesByColor[key] = images.map((img) => ({ src: imageUrl(img.path), alt: img.colorName ?? "" }));
  }
  return {
    productName: product.name,
    hasColours: product.colours.length > 0,
    defaultColorKey: defaultKey,
    imagesByColor,
    colorNames: Object.fromEntries(product.colours.map((c) => [String(c.id), c.name])),
    sizesByColor: product.sizesByColour,
  };
}

export function ProductPage({ product }: { product: ProductPageData }) {
  const view = initialSelection(product);
  const inStock = isInStock(product);
  const showVariants = product.colours.length > 0 || product.allSizeLabels.length > 0;
  const discoverTitle = product.category === "Helmet" ? "Helmets" : product.category;

  return (
    <>
      <div class="container">
        <div class="product-detail">
          <div class="product-gallery-panel">
            {view.mainImage ? (
              <img id="mainProductImage" src={view.mainImage} alt={view.mainImageAlt} class="detail-image" />
            ) : (
              <div class="detail-image" id="mainProductImage" style="display:flex;align-items:center;justify-content:center;background:#eee;min-height:300px;border-radius:12px;color:#aaa;font-size:16px;">
                No Image Available
              </div>
            )}

            {view.currentImages.length > 0 && (
              <>
                <div class="thumb-strip" id="thumbStrip">
                  {view.currentImages.map((img, index) => (
                    <img
                      src={imageUrl(img.path) ?? ""}
                      alt={img.colorName || product.name}
                      class={index === 0 ? "active" : ""}
                      data-image-index={String(index)}
                    />
                  ))}
                </div>
                {view.currentImages.length > 1 && (
                  <div class="image-nav">
                    <button type="button" data-image-step="-1">← Prev</button>
                    <button type="button" data-image-step="1">Next →</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div class="detail-info">
            <h1>{product.name}</h1>
            <div class="detail-price">RM {formatPrice(product.price)}</div>

            {inStock ? (
              <span class="badge badge-success">In Stock ({product.totalQuantity} available)</span>
            ) : (
              <>
                <span class="badge badge-danger">Out of Stock</span>
                <div class="product-out-stock-message">
                  This product is currently out of stock. You can still view the colours and sizes, but unavailable sizes cannot be selected.
                </div>
              </>
            )}

            <div class="detail-meta mt-20">
              <p><strong>Brand:</strong> {product.brand}</p>
              <p><strong>Category:</strong> {product.category} / {product.subCategory}</p>
              <p><strong>Available Sizes:</strong> {product.allSizeLabels.length > 0 ? product.allSizeLabels.join(", ") : "N/A"}</p>
            </div>

            {product.description && (
              <>
                <h3 class="mt-20" style="margin-bottom:8px;">Description</h3>
                <p style="color:#666;line-height:1.8;">
                  {product.description.split(/\r?\n/).map((line, i) => (
                    <>
                      {i > 0 && <br />}
                      {line}
                    </>
                  ))}
                </p>
              </>
            )}

            {showVariants && (
              <div class="variant-box">
                {product.colours.length > 0 && (
                  <>
                    <div class="variant-title">Select Color</div>
                    <div class="simple-color-row">
                      {product.colours.map((colour) => (
                        <button
                          type="button"
                          class={`simple-color-dot ${view.defaultColour?.id === colour.id ? "active" : ""}`}
                          style={`--dot-color: ${colour.code};`}
                          title={colour.name}
                          aria-label={`Colour: ${colour.name}`}
                          data-color-id={String(colour.id)}
                        ></button>
                      ))}
                    </div>
                  </>
                )}

                <div class="variant-title">Select Size</div>
                <div class="simple-size-row" id="simpleSizeRow">
                  {view.sizes.map((size) => {
                    const available = size.quantity > 0;
                    return available ? (
                      <button
                        type="button"
                        class={`simple-size-btn ${size.label === view.selectedSize ? "active" : ""}`}
                        data-size={size.label}
                        title={size.label}
                      >
                        {size.label}
                      </button>
                    ) : (
                      <button type="button" class="simple-size-btn" data-size={size.label} title={`${size.label} - Out of stock`} disabled aria-disabled="true">
                        {size.label}
                      </button>
                    );
                  })}
                </div>
                <div class={`size-availability-message ${view.sizeMessageClass}`} id="sizeAvailabilityMessage">
                  {view.sizeMessage}
                </div>

                <div class="selection-note">
                  Selected Size: <strong id="selectedSizeText">{view.selectedSize}</strong>
                  {raw("&nbsp; | &nbsp;")}
                  Selected Color: <strong id="selectedColorText">{view.selectedColourName}</strong>
                </div>
              </div>
            )}

            <a href="/" class="btn-back mt-20">← Back to Products</a>
          </div>
        </div>
      </div>

      {product.discoverMore.length > 0 && (
        <section class="discover-more-section">
          <div class="discover-more-header">
            <div>
              <h2 class="discover-more-title">Discover More {discoverTitle}</h2>
              <p class="discover-more-sub">More {product.subCategory || product.category} products you may like.</p>
            </div>
            <div class="discover-arrow-wrap">
              <button type="button" class="discover-arrow" id="discoverPrev" aria-label="Previous products">‹</button>
              <button type="button" class="discover-arrow" id="discoverNext" aria-label="Next products">›</button>
            </div>
          </div>
          <div class="discover-track" id="discoverTrack">
            {product.discoverMore.map((related) => <DiscoverCard product={related} />)}
          </div>
        </section>
      )}

      <script type="application/json" id="product-data">{raw(jsonForScript(scriptData(product, view.defaultKey)))}</script>
    </>
  );
}
