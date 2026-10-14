import {
  CURRENT_SORTS,
  type CurrentFilters,
  type CurrentStockRow,
  type FilterOptions,
  type HistoryFilters,
  type MovementRow,
  type Paged,
  type ReportSummary,
} from "../../lib/admin/stock-report";
import { LOW_STOCK_LIMIT } from "../../lib/admin/inventory";
import { formatCount, formatDateTime, formatPrice } from "../../lib/format";
import { Options, Pagination, ProductThumb, StockBadge, stockInUrl, stockOutUrl } from "./AdminShared";

type Props = {
  query: URLSearchParams;
  summary: ReportSummary;
  options: FilterOptions;
  current: CurrentFilters;
  history: HistoryFilters;
  currentPage: Paged<CurrentStockRow>;
  historyPage: Paged<MovementRow>;
  isBoss: boolean;
};

const CURRENT_KEYS = ["current_search", "current_product_id", "current_color_id", "current_size", "current_category", "current_subcategory", "current_status", "current_sort", "current_page"];
const HISTORY_KEYS = ["history_search", "history_product_id", "history_color_id", "history_size", "history_type", "history_category", "history_subcategory", "date_from", "date_to", "history_page"];

/** The same filters with some values changed (empty values removed). */
function withParams(query: URLSearchParams, changes: Record<string, string>): string {
  const next = new URLSearchParams(query);
  for (const [k, v] of Object.entries(changes)) next.set(k, v);
  for (const [k, v] of [...next.entries()]) if (v === "" || v === "0") next.delete(k);
  const text = next.toString();
  return text ? `?${text}` : "";
}

/** Hidden fields that carry the other section's filters, so searching one section keeps the other. */
function KeepFields({ query, keys }: { query: URLSearchParams; keys: string[] }) {
  return (
    <>
      {keys.map((k) => {
        const v = query.get(k);
        return v ? <input type="hidden" name={k} value={v} /> : null;
      })}
    </>
  );
}

const ids = (items: { id: number; label?: string; name?: string }[]) => items.map((i) => ({ value: String(i.id), label: i.label ?? i.name ?? "" }));
const texts = (items: string[]) => items.map((v) => ({ value: v, label: v }));

/** Stock report, ported from admin/stock_report.php. */
export function StockReportPage(p: Props) {
  const { query, summary, options, current, history, isBoss } = p;
  const tool = (path: string, reportType: string) => `/admin/reports/stock/${path}${withParams(query, { report_type: reportType })}`;

  return (
    <>
      <section class="stock-report-hero no-print">
        <div>
          <span class="stock-report-eyebrow">Inventory Reporting</span>
          <h2>Stock Report</h2>
          <p>Monitor product stock levels, colour and size variants, and every Stock In / Stock Out movement record.</p>
        </div>
        <div class="stock-report-hero-actions">
          <a class="btn btn-secondary" href="/admin">Back to Dashboard</a>
          <a class="btn btn-primary" href={tool("print", "all")} target="_blank" rel="noopener">Print Full Report</a>
        </div>
      </section>

      <div class="admin-stats-grid stock-report-stats-grid">
        <Stat kind="total" icon="📦" tag="Products" value={formatCount(summary.totalProducts)} label="Total Products" />
        <Stat kind="stock" icon="📊" tag="Units" value={formatCount(summary.totalUnits)} label="Total Stock Units" />
        <Stat kind="low" icon="⚠️" tag="1-4 units" value={formatCount(summary.lowVariants)} label="Low Stock Variants" />
        <Stat kind="out" icon="⛔" tag="0 units" value={formatCount(summary.outVariants)} label="Out of Stock Variants" />
        {summary.stockValue !== null && (
          <Stat kind="value" icon="💰" tag="Boss Only" value={`RM ${formatPrice(summary.stockValue)}`} label="Total Stock Value" />
        )}
      </div>

      {(summary.legacyStockRows > 0 || summary.legacyHistoryRows > 0) && (
        <div class="alert alert-warning inventory-legacy-warning">
          <strong>Legacy colour data needs review.</strong>{" "}
          {summary.legacyStockRows > 0 && `${summary.legacyStockRows} current stock row(s) still have no colour assigned. `}
          {summary.legacyHistoryRows > 0 && `${summary.legacyHistoryRows} stock history row(s) still have no colour recorded. `}
          Run migration <code>0002_colour_size_stock_rule.sql</code>. If rows still appear after that, re-add the correct quantity through
          Stock In under the correct colour and review the old row manually.
        </div>
      )}

      <div class="admin-card stock-health-panel no-print">
        <div class="stock-health-head">
          <div>
            <h3 class="admin-card-title">Stock Health Overview</h3>
            <p class="report-tool-note">Current variant status based on product colour and size quantities.</p>
          </div>
          <a class="btn btn-primary btn-sm" href="/admin/stock/in">Stock In</a>
        </div>
        <div class="stock-health-grid">
          <div class="stock-health-item good"><strong>{formatCount(summary.goodVariants)}</strong><span>Good Stock</span></div>
          <div class="stock-health-item low"><strong>{formatCount(summary.lowVariants)}</strong><span>Low Stock</span></div>
          <div class="stock-health-item out"><strong>{formatCount(summary.outVariants)}</strong><span>Out of Stock</span></div>
        </div>
      </div>

      {/* ---- Current stock levels ---- */}
      <div class="admin-card" id="current-stock-levels">
        <div class="report-section-head">
          <div>
            <h3 class="admin-card-title">Current Stock Levels</h3>
            <div class="report-count">Showing {p.currentPage.rows.length} of {formatCount(p.currentPage.total)} stock rows</div>
          </div>
          <div class="section-report-actions no-print">
            <a class="btn btn-secondary btn-sm" href={tool("print", "current")} target="_blank" rel="noopener">Print Current</a>
            <a class="btn btn-success btn-sm" href={tool("export.csv", "current")}>Export Current CSV</a>
          </div>
        </div>

        <form class="stock-report-toolbar current-toolbar" method="get" action="/admin/reports/stock#current-stock-levels">
          <KeepFields query={query} keys={HISTORY_KEYS} />
          <div class="field"><label>Search Current Stock</label><input type="text" name="current_search" placeholder="Search item code, name, colour, category, size..." value={current.search} /></div>
          <div class="field"><label>Product</label><select name="current_product_id"><option value="">All Products</option><Options items={ids(options.products)} selected={String(current.productId)} /></select></div>
          <div class="field"><label>Colour</label><select name="current_color_id"><option value="">All Colours</option><Options items={ids(options.colours)} selected={String(current.colourId)} /></select></div>
          <div class="field"><label>Size</label><select name="current_size"><option value="">All Sizes</option><Options items={texts(options.sizes)} selected={current.size} /></select></div>
          <div class="field"><label>Category</label><select name="current_category"><option value="">All Categories</option><Options items={texts(options.categories)} selected={current.category} /></select></div>
          <div class="field"><label>Subcategory</label><select name="current_subcategory"><option value="">All Subcategories</option><Options items={texts(options.subCategories)} selected={current.subCategory} /></select></div>
          <div class="filter-row-break"></div>
          <div class="field">
            <label>Stock Status</label>
            <select name="current_status">
              <Options
                items={[
                  { value: "", label: "All Status" },
                  { value: "low", label: "Low Stock" },
                  { value: "out", label: "Out of Stock" },
                  { value: "in", label: "In Stock" },
                ]}
                selected={current.status}
              />
            </select>
          </div>
          <div class="field">
            <label>Sort By</label>
            <select name="current_sort">
              <Options items={Object.entries(CURRENT_SORTS).map(([value, label]) => ({ value, label }))} selected={current.sort} />
            </select>
          </div>
          <div class="filter-actions-right">
            <button type="submit" class="btn btn-primary">Search</button>
            <a href={`/admin/reports/stock${withParams(query, Object.fromEntries(CURRENT_KEYS.map((k) => [k, ""])))}#current-stock-levels`} class="btn btn-secondary">Reset</a>
          </div>
        </form>

        {p.currentPage.rows.length > 0 ? (
          <>
            <div class="table-scroll-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Image</th><th>Item Code</th><th>Product Name</th><th>Category</th><th>Subcategory</th><th>Colour</th><th>Size</th><th>Quantity</th>
                    <th>Price (RM)</th>{isBoss && <th>Online Price (RM)</th>}<th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {p.currentPage.rows.map((row) => (
                    <tr>
                      <td><ProductThumb path={row.image} /></td>
                      <td>{row.itemCode}</td>
                      <td><strong>{row.name}</strong><br /><span class="admin-muted-small">{row.brand}</span></td>
                      <td>{row.category}</td>
                      <td>{row.subCategory}</td>
                      <td>{row.colourId === null ? <span class="status-badge status-low">Legacy / No colour</span> : row.colourName}</td>
                      <td>{row.size}</td>
                      <td class={row.quantity < LOW_STOCK_LIMIT ? "low-stock" : ""}>{row.quantity}</td>
                      <td>{formatPrice(row.price)}</td>
                      {isBoss && <td>{formatPrice(row.onlinePrice)}</td>}
                      <td class="stock-status-cell"><StockBadge quantity={row.quantity} /></td>
                      <td>
                        <div class="action-btns">
                          {row.colourId === null ? (
                            <a class="btn btn-secondary btn-sm" href={`/admin/products/${row.productId}/colours`}>Review Colour</a>
                          ) : (
                            <>
                              <a class="btn btn-success btn-sm" href={stockInUrl(row.productId, row.colourId, row.size)}>Stock In</a>
                              <a class="btn btn-danger btn-sm" href={stockOutUrl(row.productId, row.colourId, row.sizeId)}>Stock Out</a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={p.currentPage.page}
              totalPages={p.currentPage.totalPages}
              href={(n) => `/admin/reports/stock${withParams(query, { current_page: String(n) })}#current-stock-levels`}
            />
          </>
        ) : (
          <p class="admin-empty-text">No stock rows match your search/filter.</p>
        )}
      </div>

      {/* ---- Stock movement history ---- */}
      <div class="admin-card" id="stock-movement-history">
        <div class="report-section-head">
          <div>
            <h3 class="admin-card-title">Stock Movement History</h3>
            <div class="report-count">
              Showing {p.historyPage.rows.length} of {formatCount(p.historyPage.total)} movement records · Page {p.historyPage.page} of {p.historyPage.totalPages}
            </div>
          </div>
          <div class="section-report-actions no-print">
            <a class="btn btn-secondary btn-sm" href={tool("print", "history")} target="_blank" rel="noopener">Print Movement</a>
            <a class="btn btn-success btn-sm" href={tool("export.csv", "history")}>Export Movement CSV</a>
          </div>
        </div>
        <div class="stock-history-audit-note no-print">
          Stock Movement History is view-only. To correct stock, use Stock In or Stock Out with a clear reason so the audit trail stays accurate.
        </div>

        <form class="stock-report-toolbar history-toolbar" method="get" action="/admin/reports/stock#stock-movement-history">
          <KeepFields query={query} keys={CURRENT_KEYS} />
          <div class="field"><label>Search Movement</label><input type="text" name="history_search" placeholder="Search item code, name, colour, size, reason, note, edited by..." value={history.search} /></div>
          <div class="field"><label>Product</label><select name="history_product_id"><option value="">All Products</option><Options items={ids(options.products)} selected={String(history.productId)} /></select></div>
          <div class="field"><label>Colour</label><select name="history_color_id"><option value="">All Colours</option><Options items={ids(options.colours)} selected={String(history.colourId)} /></select></div>
          <div class="field"><label>Size</label><select name="history_size"><option value="">All Sizes</option><Options items={texts(options.sizes)} selected={history.size} /></select></div>
          <div class="field">
            <label>Type</label>
            <select name="history_type">
              <Options items={[{ value: "", label: "All Types" }, { value: "IN", label: "Stock In" }, { value: "OUT", label: "Stock Out" }]} selected={history.type} />
            </select>
          </div>
          <div class="field"><label>Category</label><select name="history_category"><option value="">All Categories</option><Options items={texts(options.categories)} selected={history.category} /></select></div>
          <div class="field"><label>Subcategory</label><select name="history_subcategory"><option value="">All Subcategories</option><Options items={texts(options.subCategories)} selected={history.subCategory} /></select></div>
          <div class="filter-row-break"></div>
          <div class="field"><label>From Date</label><input type="date" name="date_from" value={history.dateFrom} /></div>
          <div class="field"><label>To Date</label><input type="date" name="date_to" value={history.dateTo} /></div>
          <div class="filter-actions-right">
            <button type="submit" class="btn btn-primary">Search</button>
            <a href={`/admin/reports/stock${withParams(query, Object.fromEntries(HISTORY_KEYS.map((k) => [k, ""])))}#stock-movement-history`} class="btn btn-secondary">Reset</a>
          </div>
        </form>

        {p.historyPage.rows.length > 0 ? (
          <>
            <div class="table-scroll-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Item Code</th><th>Product</th><th>Category</th><th>Subcategory</th><th>Colour</th><th>Size</th><th>Type</th><th>Before</th><th>Change</th><th>After</th><th>Reason / Note</th></tr>
                </thead>
                <tbody>
                  {p.historyPage.rows.map((row) => (
                    <tr>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.itemCode}</td>
                      <td>{row.productName}</td>
                      <td>{row.category}</td>
                      <td>{row.subCategory}</td>
                      <td>{row.colourName}</td>
                      <td>{row.size}</td>
                      <td><span class={`type-badge ${row.type === "IN" ? "type-in" : "type-out"}`}>{row.type === "IN" ? "Stock In" : "Stock Out"}</span></td>
                      <td>{row.before}</td>
                      <td>{(row.type === "IN" ? "+" : "-") + row.quantity}</td>
                      <td>{row.after}</td>
                      <td>
                        {row.reason}
                        {row.note && <div class="audit-meta">Note: {row.note}</div>}
                        <div class="audit-meta">Edited by: {row.editedBy}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={p.historyPage.page}
              totalPages={p.historyPage.totalPages}
              href={(n) => `/admin/reports/stock${withParams(query, { history_page: String(n) })}#stock-movement-history`}
            />
          </>
        ) : (
          <p class="admin-empty-text">No stock movements match your search/filter.</p>
        )}
      </div>
    </>
  );
}

function Stat(props: { kind: string; icon: string; tag: string; value: string; label: string }) {
  return (
    <div class={`admin-stat-card report-stat-card report-stat-${props.kind}`}>
      <div class="admin-stat-head"><span class="admin-stat-icon">{props.icon}</span><span class="report-stat-tag">{props.tag}</span></div>
      <div class="admin-stat-number">{props.value}</div>
      <div class="admin-stat-label">{props.label}</div>
    </div>
  );
}
