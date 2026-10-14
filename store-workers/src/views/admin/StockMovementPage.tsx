import { MAX_MOVEMENT, MAX_NOTE_LENGTH, MAX_SIZE_LENGTH, STOCK_IN_REASONS, STOCK_OUT_REASONS, type StockFormData } from "../../lib/admin/inventory";
import { CsrfField } from "../../lib/csrf";
import { StockBadge } from "./AdminShared";

/** What the admin typed, kept when the form comes back with an error. */
export type MovementFormValues = { size: string; newSize: string; sizeId: number; quantity: string; reason: string; note: string };

export const EMPTY_MOVEMENT: MovementFormValues = { size: "", newSize: "", sizeId: 0, quantity: "", reason: "", note: "" };

type Props = {
  mode: "in" | "out";
  data: StockFormData;
  values: MovementFormValues;
  error: string | null;
  csrfToken: string;
};

/**
 * Stock In and Stock Out, ported from admin/stock_in.php and stock_out.php.
 * Choosing a product or colour reloads the page with that choice (admin.js);
 * the confirmation dialog and the before/after preview are in admin.js too.
 */
export function StockMovementPage({ mode, data, values, error, csrfToken }: Props) {
  const isIn = mode === "in";
  const title = isIn ? "Stock In" : "Stock Out";
  const path = isIn ? "/admin/stock/in" : "/admin/stock/out";
  const reasons = isIn ? STOCK_IN_REASONS : STOCK_OUT_REASONS;
  const colourName = data.colours.find((c) => c.id === data.colourId)?.name ?? "";
  const selectedOut = data.sizes.find((s) => s.id === values.sizeId);

  return (
    <>
      {error && <div class="alert alert-danger">{error}</div>}

      <div class="admin-card inventory-action-card">
        <div class="report-section-head">
          <div><h3 class="admin-card-title">{title}</h3></div>
          <a href="/admin/reports/stock#stock-movement-history" class="btn btn-info">View Stock History</a>
        </div>

        <form method="post" action={path} class="inventory-form js-stock-form" data-mode={mode} data-page={path}>
          <CsrfField token={csrfToken} />
          <div class="form-row inventory-form-row">
            <div class="form-group">
              <label for="product_id">Product <span class="required">*</span></label>
              <select name="product_id" id="product_id" required class="js-stock-product">
                <option value="">-- Select Product --</option>
                {data.products.map((p) => (
                  <option value={String(p.id)} selected={p.id === data.product?.id}>{`${p.itemCode} - ${p.name}`}</option>
                ))}
              </select>
            </div>
            <div class="form-group">
              <label for="color_id">Colour <span class="required">*</span></label>
              <select name="color_id" id="color_id" required class="js-stock-colour" disabled={data.colours.length === 0}>
                <option value="">-- Select Colour --</option>
                {data.colours.map((c) => (
                  <option value={String(c.id)} selected={c.id === data.colourId}>{c.name}</option>
                ))}
              </select>
              {data.product && data.colours.length === 0 && (
                <small class="field-help">
                  No colours found for this product. Please add colours first from{" "}
                  <a href={`/admin/products/${data.product.id}/colours`}>Colours &amp; Images</a>.
                </small>
              )}
            </div>
          </div>

          {isIn ? (
            <div class="form-row inventory-form-row">
              <div class="form-group">
                <label for="existing_size">Existing Size</label>
                <select name="existing_size" id="existing_size" class="js-stock-size">
                  <option value="">-- Select Existing Size --</option>
                  {data.sizes.map((s) => (
                    <option value={s.size} data-qty={String(s.quantity)} selected={s.size === values.size}>
                      {`${s.size} — Current: ${s.quantity}`}
                    </option>
                  ))}
                </select>
                <small class="field-help">Existing sizes shown here belong to the selected colour only.</small>
              </div>
              <div class="form-group">
                <label for="new_size">New Size (optional)</label>
                <input type="text" name="new_size" id="new_size" maxlength={MAX_SIZE_LENGTH} value={values.newSize} placeholder="Example: XS, XXL, Free Size" class="js-stock-new-size" />
                <small class="field-help">Only fill this when you want to create a new size for the selected colour.</small>
              </div>
            </div>
          ) : (
            <div class="form-row inventory-form-row">
              <div class="form-group">
                <label for="size_id">Size <span class="required">*</span></label>
                <select name="size_id" id="size_id" required class="js-stock-size">
                  <option value="">-- Select Size --</option>
                  {data.sizes.map((s) => (
                    <option value={String(s.id)} data-size={s.size} data-qty={String(s.quantity)} selected={s.id === values.sizeId}>
                      {`${s.size} — Current: ${s.quantity}`}
                    </option>
                  ))}
                </select>
                <small class="field-help" id="currentQtyText">
                  {selectedOut ? `Current stock: ${selectedOut.quantity} unit(s)` : "Select a size to view current stock."}
                </small>
              </div>
              <div class="form-group">
                <label for="quantity">Quantity Removed <span class="required">*</span></label>
                <input type="number" name="quantity" id="quantity" min="1" max={String(MAX_MOVEMENT)} required placeholder="Enter quantity" value={values.quantity} class="js-stock-qty" />
                <small class="field-help" id="stockOutLimitText">The system will check the selected size stock before submitting.</small>
              </div>
            </div>
          )}

          <div class="form-row inventory-form-row">
            {isIn && (
              <div class="form-group">
                <label for="quantity">Quantity Added <span class="required">*</span></label>
                <input type="number" name="quantity" id="quantity" min="1" max={String(MAX_MOVEMENT)} required placeholder="Enter quantity" value={values.quantity} class="js-stock-qty" />
              </div>
            )}
            <div class="form-group">
              <label for="reason">Reason <span class="required">*</span></label>
              <select name="reason" id="reason" required>
                <option value="">-- Select Reason --</option>
                {reasons.map((r) => (
                  <option value={r} selected={r === values.reason}>{r}</option>
                ))}
              </select>
            </div>
            {!isIn && <NoteField value={values.note} placeholder="Optional note, explanation, staff comment, or supporting detail" />}
          </div>

          {isIn && <NoteField value={values.note} placeholder="Optional note, supplier reference, invoice no., or explanation" />}

          <div class={`inventory-stock-preview ${isIn ? "" : "danger-preview"}`}>
            <div><span>Current Stock</span><strong data-preview="current">0 unit(s)</strong></div>
            <div><span>{isIn ? "Quantity Added" : "Quantity Removed"}</span><strong data-preview="change">0 unit(s)</strong></div>
            <div><span>{isIn ? "After Stock In" : "After Stock Out"}</span><strong data-preview="after">0 unit(s)</strong></div>
          </div>

          <div class="form-actions inventory-actions">
            <button type="submit" class={`btn ${isIn ? "btn-primary" : "btn-danger"} btn-lg`}>Confirm {title}</button>
            <a href="/admin/products" class="btn btn-secondary btn-lg">Cancel</a>
          </div>
        </form>
      </div>

      <div class="inventory-confirm-overlay" id="stockConfirmOverlay" aria-hidden="true" hidden>
        <div class="inventory-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="stockConfirmTitle">
          <div class={`inventory-confirm-icon ${isIn ? "" : "danger"}`}>{isIn ? "✓" : "!"}</div>
          <h3 id="stockConfirmTitle">Confirm {title}</h3>
          <p class="inventory-confirm-text">Please check the details before {isIn ? "adding" : "removing"} stock.</p>
          <div class="inventory-confirm-summary">
            <div><span>Colour</span><strong data-confirm="colour">-</strong></div>
            <div><span>Size</span><strong data-confirm="size">-</strong></div>
            <div><span>Current Stock</span><strong data-confirm="current">-</strong></div>
            <div><span>{isIn ? "Quantity Added" : "Quantity Removed"}</span><strong data-confirm="change">-</strong></div>
            <div><span>{isIn ? "After Stock In" : "After Stock Out"}</span><strong data-confirm="after">-</strong></div>
            <div><span>Reason</span><strong data-confirm="reason">-</strong></div>
          </div>
          <div class="inventory-confirm-actions">
            <button type="button" class="btn btn-secondary js-stock-cancel">Cancel</button>
            <button type="button" class={`btn ${isIn ? "btn-primary" : "btn-danger"} js-stock-confirm`}>Yes, Confirm</button>
          </div>
        </div>
      </div>

      {data.product && (
        <div class="admin-card">
          <h3 class="admin-card-title">Current Stock for {data.product.name}{colourName ? ` - ${colourName}` : ""}</h3>
          {data.sizes.length > 0 ? (
            <div class="table-scroll-wrap">
              <table>
                <thead><tr><th>Colour</th><th>Size</th><th>Current Quantity</th><th>Status</th></tr></thead>
                <tbody>
                  {data.sizes.map((s) => (
                    <tr>
                      <td>{colourName || "N/A"}</td>
                      <td>{s.size}</td>
                      <td>{s.quantity}</td>
                      <td><StockBadge quantity={s.quantity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p class="admin-muted-text">
              {isIn
                ? "No sizes yet for this colour. Enter a new size above to create it."
                : "No sizes exist for this colour. Use Stock In to create a size before using Stock Out."}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function NoteField({ value, placeholder }: { value: string; placeholder: string }) {
  return (
    <div class="form-group">
      <label for="note">Additional Note</label>
      <textarea name="note" id="note" rows={3} maxlength={MAX_NOTE_LENGTH} placeholder={placeholder}>{value}</textarea>
    </div>
  );
}
