import { PRODUCT_STATUSES, STATUS_LABELS, type ProductFormValues } from "../../lib/admin/product-form";
import type { AdminProductDetail } from "../../lib/admin/products";
import { CsrfField } from "../../lib/csrf";
import { StockBadge, stockInUrl, stockOutUrl } from "./AdminShared";
import { CategorySelects } from "./CategorySelects";
import { ArchiveButton } from "./ProductListPage";

type Props = {
  values: ProductFormValues;
  error: string | null;
  isBoss: boolean;
  csrfToken: string;
  /** Set when editing an existing product. */
  product?: AdminProductDetail;
};

/** Add Product and Edit Product, ported from admin/add_product.php and edit_product.php. */
export function ProductFormPage({ values, error, isBoss, csrfToken, product }: Props) {
  const editing = Boolean(product);
  const action = product ? `/admin/products/${product.id}/edit` : "/admin/products/new";

  return (
    <>
      {error && <div class="alert alert-danger">{error}</div>}

      <div class="form-container">
        {product && <ColoursBanner product={product} />}
        {product?.archived && (
          <div class="archived-note">
            <div>
              <strong>This product is archived.</strong> It's hidden from the shop and from Stock In / Stock Out.
              {isBoss ? " Restore it to use it again." : " A boss admin can restore it."}
            </div>
            {isBoss && <ArchiveButton product={{ id: product.id, name: product.name, archived: true }} csrfToken={csrfToken} />}
          </div>
        )}

        <form method="post" action={action}>
          <CsrfField token={csrfToken} />
          <div class="form-section-title">Basic Information</div>

          <div class="form-row">
            <div class="form-group">
              <label for="item_code">Item Code <span class="required">*</span></label>
              <input type="text" id="item_code" name="item_code" maxlength={50} placeholder="e.g. HEL-001" value={values.itemCode} required />
            </div>
            <div class="form-group">
              <label for="name">Product Name <span class="required">*</span></label>
              <input type="text" id="name" name="name" maxlength={200} placeholder="e.g. AGV K1 Full Face Helmet" value={values.name} required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="brand">Brand <span class="required">*</span></label>
              <input type="text" id="brand" name="brand" maxlength={100} placeholder="e.g. AGV, Shoei, HJC" value={values.brand} required />
            </div>
            <div class="form-group">
              <label for="price">Price (RM) <span class="required">*</span></label>
              <input type="number" id="price" name="price" step="0.01" min="0" max="99999999.99" value={values.price} required />
            </div>
          </div>

          {isBoss && (
            <div class="boss-only-box">
              <div class="form-section-title">Boss-Only Pricing</div>
              <p class="boss-note">Only boss admins can view and edit cost price and online sell price.</p>
              <div class="form-row">
                <div class="form-group">
                  <label for="cost_price">Cost Price (RM)</label>
                  <input type="number" id="cost_price" name="cost_price" step="0.01" min="0" max="99999999.99" value={values.costPrice} />
                </div>
                <div class="form-group">
                  <label for="online_sell_price">Online Sell Price (RM)</label>
                  <input type="number" id="online_sell_price" name="online_sell_price" step="0.01" min="0" max="99999999.99" value={values.onlineSellPrice} />
                </div>
              </div>
            </div>
          )}

          <CategorySelects
            mode="form"
            category={values.category}
            subCategory={values.subCategory}
            categoryName="category"
            subCategoryName="sub_category"
            keep={product ? { category: product.category, subCategory: product.subCategory } : undefined}
          />

          <div class="form-row">
            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" name="status" disabled={product?.archived}>
                {PRODUCT_STATUSES.map((s) => (
                  <option value={s} selected={s === values.status}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              {product?.archived && <small class="field-help">Archived products stay Hidden until restored.</small>}
            </div>
            <div class="form-group">
              <label for="arrival_date">Arrival Date</label>
              <input type="date" id="arrival_date" name="arrival_date" value={values.arrivalDate} />
              <small class="field-help">Used for the shop's "New Arrivals" section.</small>
            </div>
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows={4} maxlength={5000} placeholder="Describe the product...">
              {values.description}
            </textarea>
          </div>

          {product && <StockTable product={product} />}

          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-lg">{editing ? "💾 Save Changes" : "Save & Set Up Colours →"}</button>
            <a href="/admin/products" class="btn btn-secondary btn-lg">Cancel</a>
          </div>
        </form>
      </div>
    </>
  );
}

function ColoursBanner({ product }: { product: AdminProductDetail }) {
  return (
    <div class="colors-cta-banner">
      <div class="colors-cta-left">
        <div class="colors-cta-icon">🎨</div>
        <div>
          <div class="colors-cta-title">Colours &amp; Images</div>
          <div class="colors-cta-sub">
            {product.colourCount > 0
              ? `${product.colourCount} colour${product.colourCount > 1 ? "s" : ""} configured for this product`
              : "No colours added yet — click to set up product colours and images"}
          </div>
        </div>
      </div>
      <a href={`/admin/products/${product.id}/colours`} class="btn-manage-colors">Manage Colours &amp; Images →</a>
    </div>
  );
}

/** Read-only stock table: quantities only change through Stock In / Stock Out. */
function StockTable({ product }: { product: AdminProductDetail }) {
  return (
    <>
      <div class="form-section-title form-section-spaced">Sizes &amp; Current Stock</div>
      <div class="stock-lock-note">
        <strong>Stock quantity is locked on this page.</strong> This page is only for editing product information. Please use{" "}
        <b>Stock In</b> to add quantity and <b>Stock Out</b> to remove quantity with a required reason.
      </div>
      <div class="table-scroll-wrap stock-readonly-wrap">
        <table>
          <thead>
            <tr><th>Colour</th><th>Size</th><th>Current Stock</th><th>Status</th><th>Stock Action</th></tr>
          </thead>
          <tbody>
            {product.stock.length > 0 ? (
              product.stock.map((s) => (
                <tr>
                  <td>{s.colourName}</td>
                  <td><strong>{s.size}</strong></td>
                  <td>{s.quantity}</td>
                  <td><StockBadge quantity={s.quantity} /></td>
                  <td>
                    {product.archived || s.colourId === null ? (
                      <span class="admin-muted-small">—</span>
                    ) : (
                      <div class="action-btns">
                        <a class="btn btn-success btn-sm" href={stockInUrl(product.id, s.colourId, s.size)}>Stock In</a>
                        <a class="btn btn-danger btn-sm" href={stockOutUrl(product.id, s.colourId, s.sizeId)}>Stock Out</a>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colspan={5} class="admin-muted-cell">No sizes have been created yet. Use Stock In to create a size and add quantity.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
