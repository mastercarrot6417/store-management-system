import type { AdminProductFilters, AdminProductListItem } from "../../lib/admin/products";
import { LOW_STOCK_LIMIT } from "../../lib/admin/inventory";
import { formatPrice } from "../../lib/format";
import { CsrfField } from "../../lib/csrf";
import { ProductThumb } from "./AdminShared";
import { CategorySelects } from "./CategorySelects";

type Props = {
  products: AdminProductListItem[];
  filters: AdminProductFilters;
  isBoss: boolean;
  csrfToken: string;
};

/** Product list, ported from admin/products.php. "Delete" became "Archive" (boss only). */
export function ProductListPage({ products, filters, isBoss, csrfToken }: Props) {
  const viewParam = filters.archived ? "archived" : "";
  return (
    <>
      <div class="admin-card">
        <h3 class="admin-card-title">Product Filters</h3>
        <form class="filter-bar" method="get" action="/admin/products">
          {viewParam && <input type="hidden" name="view" value={viewParam} />}
          <input type="text" name="search" placeholder="Search by name, item code or brand..." value={filters.search} />
          <CategorySelects
            mode="filter"
            category={filters.category}
            subCategory={filters.subCategory}
            categoryName="category"
            subCategoryName="sub_category"
          />
          <button type="submit" class="btn btn-primary">Search</button>
          <a href={filters.archived ? "/admin/products?view=archived" : "/admin/products"} class="btn btn-secondary">Reset</a>
        </form>
        <div class="product-view-tabs">
          <a href="/admin/products" class={filters.archived ? "" : "active"}>Current products</a>
          <a href="/admin/products?view=archived" class={filters.archived ? "active" : ""}>Archived</a>
        </div>
      </div>

      <div class="admin-card">
        <h3 class="admin-card-title">
          {filters.archived ? "Archived Products" : "Products"} ({products.length} items)
        </h3>
        {filters.archived && (
          <p class="admin-card-subtitle">
            Archived products are hidden from the shop and from Stock In / Stock Out. Their stock history is kept.
          </p>
        )}
        {products.length > 0 ? (
          <div class="table-scroll-wrap">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Item Code</th>
                  <th>Name</th>
                  <th>Category / Subcategory</th>
                  {isBoss && <th>Cost Price</th>}
                  <th>Price</th>
                  {isBoss && <th>Online Price</th>}
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr>
                    <td><ProductThumb path={p.image} /></td>
                    <td>{p.itemCode}</td>
                    <td>
                      <strong>{p.name}</strong>
                      <br />
                      <span class="admin-muted-small">{p.brand}</span>
                    </td>
                    <td>{p.category} / {p.subCategory}</td>
                    {p.bossPrices && <td>RM {formatPrice(p.bossPrices.cost)}</td>}
                    <td>RM {formatPrice(p.price)}</td>
                    {p.bossPrices && <td>RM {formatPrice(p.bossPrices.online)}</td>}
                    <td class={p.totalQuantity < LOW_STOCK_LIMIT ? "low-stock" : ""}>{p.totalQuantity}</td>
                    <td><ProductStatusBadge status={p.status} archived={p.archived} /></td>
                    <td>
                      <div class="action-btns">
                        <a href={`/admin/products/${p.id}/edit`} class="btn btn-info btn-sm">Edit</a>
                        {isBoss && <ArchiveButton product={p} csrfToken={csrfToken} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filters.archived ? (
          <p class="admin-empty-text">No archived products.</p>
        ) : (
          <p class="admin-empty-text">
            No products found. <a href="/admin/products/new">Add your first product</a>.
          </p>
        )}
      </div>
    </>
  );
}

export function ProductStatusBadge({ status, archived }: { status: string; archived: boolean }) {
  if (archived) return <span class="status-badge status-archived">Archived</span>;
  if (status === "ACTIVE") return <span class="status-badge status-active">Active</span>;
  if (status === "HIDDEN") return <span class="status-badge status-hidden">Hidden</span>;
  return <span class="status-badge status-out">Out of Stock</span>;
}

/** Boss-only Archive / Restore button, with the shared confirmation dialog (app.js). */
export function ArchiveButton({ product, csrfToken }: { product: { id: number; name: string; archived: boolean }; csrfToken: string }) {
  if (product.archived) {
    return (
      <form method="post" action={`/admin/products/${product.id}/restore`} class="admin-inline-form">
        <CsrfField token={csrfToken} />
        <button type="submit" class="btn btn-success btn-sm">Restore</button>
      </form>
    );
  }
  return (
    <form
      method="post"
      action={`/admin/products/${product.id}/archive`}
      class="admin-inline-form admin-confirm-form"
      data-confirm-title="Archive Product"
      data-confirm-message={`Archive "${product.name}"? It will be hidden from the shop and from Stock In / Stock Out. Its stock history is kept, and you can restore it later.`}
      data-confirm-text="Yes, Archive"
      data-confirm-type="danger"
    >
      <CsrfField token={csrfToken} />
      <button type="submit" class="btn btn-danger btn-sm">Archive</button>
    </form>
  );
}
