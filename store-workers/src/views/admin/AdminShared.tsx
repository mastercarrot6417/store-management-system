import { imageUrl } from "../../lib/format";
import { stockLevel } from "../../lib/admin/inventory";

/** Small pieces shared by the admin pages. */

/** "In Stock" / "Low Stock" / "Out of Stock" badge for one variant's quantity. */
export function StockBadge({ quantity }: { quantity: number }) {
  const level = stockLevel(quantity);
  if (level === "out") return <span class="status-badge status-out">Out of Stock</span>;
  if (level === "low") return <span class="status-badge status-low">Low Stock</span>;
  return <span class="status-badge status-in">In Stock</span>;
}

/** Product photo thumbnail; shows "N/A" if there's no photo or it fails to load. */
export function ProductThumb({ path }: { path: string | null }) {
  const src = imageUrl(path);
  if (!src) return <div class="admin-thumb-placeholder">N/A</div>;
  return (
    <img
      src={src}
      alt=""
      class="admin-product-thumb"
      loading="lazy"
      data-fallback-class="admin-thumb-placeholder"
      data-fallback-text="N/A"
    />
  );
}

/** Link to Stock In / Stock Out with the product, colour and size already chosen. */
export function stockInUrl(productId: number, colourId?: number | null, size?: string): string {
  const params = new URLSearchParams({ product_id: String(productId) });
  if (colourId) params.set("color_id", String(colourId));
  if (size) params.set("size", size);
  return `/admin/stock/in?${params}`;
}

export function stockOutUrl(productId: number, colourId?: number | null, sizeId?: number): string {
  const params = new URLSearchParams({ product_id: String(productId) });
  if (colourId) params.set("color_id", String(colourId));
  if (sizeId) params.set("size_id", String(sizeId));
  return `/admin/stock/out?${params}`;
}

/**
 * Previous / 1 ... 4 5 6 ... 9 / Next, as on the PHP stock report.
 * `href(page)` builds each link.
 */
export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const middle: number[] = [];
  for (let i = start; i <= end; i++) middle.push(i);

  return (
    <div class="report-pagination">
      {page > 1 ? <a href={href(page - 1)}>Previous</a> : <span class="disabled">Previous</span>}
      {start > 1 && <a href={href(1)}>1</a>}
      {start > 2 && <span class="dots">...</span>}
      {middle.map((i) => (i === page ? <span class="active">{i}</span> : <a href={href(i)}>{i}</a>))}
      {end < totalPages - 1 && <span class="dots">...</span>}
      {end < totalPages && <a href={href(totalPages)}>{totalPages}</a>}
      {page < totalPages ? <a href={href(page + 1)}>Next</a> : <span class="disabled">Next</span>}
    </div>
  );
}

/** <option> list for a select, marking `selected`. */
export function Options({ items, selected }: { items: { value: string; label: string }[]; selected: string }) {
  return (
    <>
      {items.map((item) => (
        <option value={item.value} selected={item.value === selected}>
          {item.label}
        </option>
      ))}
    </>
  );
}
