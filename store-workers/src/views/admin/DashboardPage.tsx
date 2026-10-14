import type { DashboardData } from "../../lib/admin/dashboard";
import { formatCount, formatDate, formatDateTime, formatPrice } from "../../lib/format";
import { stockInUrl } from "./AdminShared";

/** Admin dashboard, ported from admin/dashboard.php. */
export function DashboardPage({ data, adminName, today }: { data: DashboardData; adminName: string; today: string }) {
  const percent = (value: number) =>
    data.totalVariants > 0 ? Math.max(0, Math.min(100, Math.round((value / data.totalVariants) * 100))) : 0;

  return (
    <>
      <section class="dashboard-hero-card">
        <div>
          <span class="dashboard-kicker">Inventory Control Center</span>
          <h2>Welcome back, {adminName}</h2>
          <p>Here is your store overview, stock health, and latest inventory movement for today.</p>
        </div>
        <div class="dashboard-date-pill">
          <span>Today</span>
          <strong>{formatDate(today)}</strong>
        </div>
      </section>

      <section class="dashboard-metric-grid">
        <Metric colour="blue" icon="📦" label="Total Products" value={data.totalProducts} note={`${formatCount(data.activeProducts)} active products`} />
        <Metric colour="green" icon="📊" label="Total Stock Units" value={data.totalStockUnits} note="Across colour + size variants" />
        <Metric colour="orange" icon="⚠️" label="Low Stock Variants" value={data.lowStock} note="Below 5 units" />
        <Metric colour="red" icon="⛔" label="Out of Stock" value={data.outOfStock} note={`${formatCount(data.productsWithoutStockRows)} products without stock rows`} />
        <Metric colour="purple" icon="👥" label="Total Customers" value={data.totalCustomers} note="Registered customer accounts" />
      </section>

      <section class="dashboard-layout-grid">
        <div class="admin-card dashboard-panel stock-health-panel">
          <div class="dashboard-section-head">
            <div>
              <h3 class="admin-card-title">Stock Health Overview</h3>
              <p class="admin-card-subtitle">Variant-level stock status based on product, colour and size.</p>
            </div>
            <a href="/admin/reports/stock#current-stock-levels" class="dashboard-mini-link">View report</a>
          </div>
          <div class="stock-health-list">
            <HealthRow kind="good" label="Good Stock" count={data.goodStock} percent={percent(data.goodStock)} />
            <HealthRow kind="low" label="Low Stock" count={data.lowStock} percent={percent(data.lowStock)} />
            <HealthRow kind="out" label="Out of Stock" count={data.outOfStock} percent={percent(data.outOfStock)} />
          </div>
        </div>

        <div class="admin-card dashboard-panel quick-actions-panel">
          <div class="dashboard-section-head">
            <div>
              <h3 class="admin-card-title">Quick Actions</h3>
              <p class="admin-card-subtitle">Common actions for daily store management.</p>
            </div>
          </div>
          <div class="dashboard-quick-grid">
            <a href="/admin/products/new" class="dashboard-action-card"><span>＋</span><strong>Add Product</strong><small>Create new product</small></a>
            <a href="/admin/stock/in" class="dashboard-action-card"><span>↗</span><strong>Stock In</strong><small>Add inventory</small></a>
            <a href="/admin/stock/out" class="dashboard-action-card"><span>↘</span><strong>Stock Out</strong><small>Remove inventory</small></a>
            <a href="/admin/reports/stock" class="dashboard-action-card"><span>↬</span><strong>Stock Report</strong><small>View report</small></a>
          </div>
        </div>
      </section>

      <section class="dashboard-two-column">
        <div class="admin-card dashboard-panel">
          <div class="dashboard-section-head">
            <div>
              <h3 class="admin-card-title">Low Stock Alert</h3>
              <p class="admin-card-subtitle">Variants below 5 units. Use Stock In to restock quickly.</p>
            </div>
            <a href="/admin/reports/stock?current_status=low#current-stock-levels" class="dashboard-mini-link">View all</a>
          </div>
          {data.lowStockVariants.length > 0 ? (
            <div class="dashboard-alert-list">
              {data.lowStockVariants.map((row) => (
                <div class="dashboard-alert-item">
                  <div class="alert-product-info">
                    <strong>{row.name}</strong>
                    <span>{row.colourName} / {row.size} · {row.category}</span>
                  </div>
                  <span class={`dashboard-stock-pill ${row.quantity <= 0 ? "out" : "low"}`}>
                    {row.quantity <= 0 ? "Out" : "Low"} · {row.quantity}
                  </span>
                  <a class="btn btn-success btn-sm" href={stockInUrl(row.productId, row.colourId, row.size)}>Stock In</a>
                </div>
              ))}
            </div>
          ) : (
            <div class="dashboard-empty-state">No low stock variants found.</div>
          )}
        </div>

        <div class="admin-card dashboard-panel">
          <div class="dashboard-section-head">
            <div>
              <h3 class="admin-card-title">Recent Stock Movement</h3>
              <p class="admin-card-subtitle">Latest Stock In and Stock Out activity.</p>
            </div>
            <a href="/admin/reports/stock#stock-movement-history" class="dashboard-mini-link">View history</a>
          </div>
          {data.recentMovements.length > 0 ? (
            <div class="dashboard-history-list">
              {data.recentMovements.map((row) => (
                <div class="dashboard-history-item">
                  <div class="history-main">
                    <span class={`type-badge ${row.type === "IN" ? "type-in" : "type-out"}`}>{row.type === "IN" ? "Stock In" : "Stock Out"}</span>
                    <strong>{row.productName}</strong>
                    <small>{row.colourName} / {row.size} · {row.reason}</small>
                  </div>
                  <div class="history-side">
                    <strong>{(row.type === "IN" ? "+" : "-") + row.quantity}</strong>
                    <span>{formatDateTime(row.createdAt, false)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class="dashboard-empty-state">No recent stock movement yet.</div>
          )}
        </div>
      </section>

      {data.boss && (
        <section class="admin-card boss-pricing-panel dashboard-panel">
          <div class="dashboard-section-head">
            <div>
              <h3 class="admin-card-title">Boss Pricing Overview</h3>
              <p class="admin-card-subtitle">Cost price and online sell price are boss-only business data.</p>
            </div>
            <span class="boss-only-badge">Boss Only</span>
          </div>
          <div class="admin-stats-grid boss-dashboard-grid">
            <BossStat icon="💰" label="Total Cost Value" amount={data.boss.totalCost} />
            <BossStat icon="🏷️" label="Store Price Value" amount={data.boss.totalStore} />
            <BossStat icon="🛒" label="Online Sell Value" amount={data.boss.totalOnline} />
            <BossStat icon="📈" label="Potential Gross Difference" amount={data.boss.totalStore - data.boss.totalCost} />
          </div>
          {data.boss.products.length > 0 && (
            <div class="table-scroll-wrap">
              <table>
                <thead>
                  <tr><th>Item Code</th><th>Product</th><th>Qty</th><th>Cost Price</th><th>Current Price</th><th>Online Sell Price</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {data.boss.products.map((p) => (
                    <tr>
                      <td>{p.itemCode}</td>
                      <td>{p.name}</td>
                      <td>{p.totalQuantity}</td>
                      <td>RM {formatPrice(p.prices.cost)}</td>
                      <td>RM {formatPrice(p.price)}</td>
                      <td>RM {formatPrice(p.prices.online)}</td>
                      <td><a class="btn btn-info btn-sm" href={`/admin/products/${p.id}/edit`}>Edit Pricing</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Metric(props: { colour: string; icon: string; label: string; value: number; note: string }) {
  return (
    <div class={`dashboard-metric-card metric-${props.colour}`}>
      <div class="metric-icon">{props.icon}</div>
      <div>
        <span>{props.label}</span>
        <strong>{formatCount(props.value)}</strong>
        <small>{props.note}</small>
      </div>
    </div>
  );
}

function HealthRow(props: { kind: "good" | "low" | "out"; label: string; count: number; percent: number }) {
  return (
    <div class={`stock-health-row ${props.kind}`}>
      <div>
        <strong>{props.label}</strong>
        <span>{formatCount(props.count)} variants</span>
      </div>
      <div class="stock-health-bar"><span style={`width: ${props.percent}%;`}></span></div>
    </div>
  );
}

function BossStat(props: { icon: string; label: string; amount: number }) {
  return (
    <div class="admin-stat-card">
      <div class="admin-stat-head"><span class="admin-stat-icon">{props.icon}</span></div>
      <div class="admin-stat-number">RM {formatPrice(props.amount)}</div>
      <div class="admin-stat-label">{props.label}</div>
    </div>
  );
}
