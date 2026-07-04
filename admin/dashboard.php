<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
ensureBossPricingSchema($conn);
ensureInventoryMovementSchema($conn);
$isBoss = isBossAdmin();

$page_title = 'Dashboard';

function dashboardScalar(PDO $conn, string $sql, $default = 0) {
    try {
        $stmt = $conn->query($sql);
        return $stmt ? $stmt->fetchColumn() : $default;
    } catch (Throwable $e) {
        return $default;
    }
}

function dashboardRows(PDO $conn, string $sql): array {
    try {
        $stmt = $conn->query($sql);
        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    } catch (Throwable $e) {
        return [];
    }
}

function h($value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

$todayLabel = date('d M Y');
$totalProducts = (int)dashboardScalar($conn, "SELECT COUNT(*) FROM products WHERE COALESCE(status, 'ACTIVE') != 'HIDDEN'");
$activeProducts = (int)dashboardScalar($conn, "SELECT COUNT(*) FROM products WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE'");
$totalStockUnits = (int)dashboardScalar($conn, "SELECT COALESCE(SUM(COALESCE(quantity, 0)), 0) FROM product_sizes WHERE color_id IS NOT NULL");
$totalVariants = (int)dashboardScalar($conn, "SELECT COUNT(*) FROM product_sizes ps INNER JOIN products p ON p.id = ps.product_id WHERE ps.color_id IS NOT NULL AND COALESCE(p.status, 'ACTIVE') != 'HIDDEN'");
$goodStockCount = (int)dashboardScalar($conn, "
    SELECT COUNT(*)
    FROM product_sizes ps
    INNER JOIN products p ON p.id = ps.product_id
    WHERE ps.color_id IS NOT NULL
      AND COALESCE(p.status, 'ACTIVE') != 'HIDDEN'
      AND COALESCE(ps.quantity, 0) >= 5
");
$lowStockCount = (int)dashboardScalar($conn, "
    SELECT COUNT(*)
    FROM product_sizes ps
    INNER JOIN products p ON p.id = ps.product_id
    WHERE ps.color_id IS NOT NULL
      AND COALESCE(p.status, 'ACTIVE') != 'HIDDEN'
      AND COALESCE(ps.quantity, 0) > 0
      AND COALESCE(ps.quantity, 0) < 5
");
$outStockCount = (int)dashboardScalar($conn, "
    SELECT COUNT(*)
    FROM product_sizes ps
    INNER JOIN products p ON p.id = ps.product_id
    WHERE ps.color_id IS NOT NULL
      AND COALESCE(p.status, 'ACTIVE') != 'HIDDEN'
      AND COALESCE(ps.quantity, 0) = 0
");
$noStockProducts = (int)dashboardScalar($conn, "
    SELECT COUNT(*)
    FROM products p
    WHERE COALESCE(p.status, 'ACTIVE') != 'HIDDEN'
      AND NOT EXISTS (
          SELECT 1 FROM product_sizes ps
          WHERE ps.product_id = p.id AND ps.color_id IS NOT NULL
      )
");
$totalCustomers = (int)dashboardScalar($conn, "SELECT COUNT(*) FROM customers", 0);

$lowStockVariants = dashboardRows($conn, "
    SELECT
        ps.product_id,
        ps.color_id,
        ps.size,
        COALESCE(ps.quantity, 0) AS quantity,
        p.item_code,
        p.name,
        p.category,
        p.sub_category,
        COALESCE(pc.color_name, 'N/A') AS color_name
    FROM product_sizes ps
    INNER JOIN products p ON p.id = ps.product_id
    LEFT JOIN product_colors pc ON pc.id = ps.color_id
    WHERE ps.color_id IS NOT NULL
      AND COALESCE(p.status, 'ACTIVE') != 'HIDDEN'
      AND COALESCE(ps.quantity, 0) < 5
    ORDER BY COALESCE(ps.quantity, 0) ASC, p.name ASC, pc.color_name ASC, ps.size ASC
    LIMIT 8
");

$recentHistory = dashboardRows($conn, "
    SELECT
        sh.created_at,
        sh.type,
        sh.quantity,
        sh.quantity_after,
        sh.reason,
        sh.note,
        sh.edited_by_admin_name,
        sh.size,
        p.item_code,
        p.name AS product_name,
        COALESCE(pc.color_name, 'N/A') AS color_name
    FROM stock_history sh
    INNER JOIN products p ON p.id = sh.product_id
    LEFT JOIN product_colors pc ON pc.id = sh.color_id
    ORDER BY sh.created_at DESC
    LIMIT 8
");

$stockHealthPercent = function (int $value) use ($totalVariants): int {
    if ($totalVariants <= 0) return 0;
    return max(0, min(100, (int)round(($value / $totalVariants) * 100)));
};

$pricingSummary = null;
$bossPricingProducts = [];
if ($isBoss) {
    try {
        $pricingSummary = $conn->query("
            SELECT
                COALESCE(SUM(COALESCE(p.cost_price,0) * COALESCE(stock.total_quantity,0)),0) AS total_cost_value,
                COALESCE(SUM(COALESCE(p.price,0) * COALESCE(stock.total_quantity,0)),0) AS total_store_value,
                COALESCE(SUM(COALESCE(p.online_sell_price,0) * COALESCE(stock.total_quantity,0)),0) AS total_online_value
            FROM products p
            LEFT JOIN (
                SELECT product_id, SUM(quantity) AS total_quantity
                FROM product_sizes
                WHERE color_id IS NOT NULL
                GROUP BY product_id
            ) stock ON stock.product_id = p.id
        ")->fetch(PDO::FETCH_ASSOC);

        $bossPricingProducts = $conn->query("
            SELECT p.id, p.item_code, p.name, p.cost_price, p.price, p.online_sell_price,
                   COALESCE(SUM(ps.quantity), 0) AS total_quantity
            FROM products p
            LEFT JOIN product_sizes ps ON ps.product_id = p.id AND ps.color_id IS NOT NULL
            GROUP BY p.id
            ORDER BY p.created_at DESC NULLS LAST, p.id DESC
            LIMIT 8
        ")->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $pricingSummary = null;
        $bossPricingProducts = [];
    }
}

require_once 'includes/header.php';
?>

<section class="dashboard-hero-card">
    <div>
        <span class="dashboard-kicker">Inventory Control Center</span>
        <h2>Welcome back, <?php echo h(currentAdminDisplayName()); ?></h2>
        <p>Here is your store overview, stock health, and latest inventory movement for today.</p>
    </div>
    <div class="dashboard-date-pill">
        <span>Today</span>
        <strong><?php echo h($todayLabel); ?></strong>
    </div>
</section>

<section class="dashboard-metric-grid">
    <div class="dashboard-metric-card metric-blue">
        <div class="metric-icon">📦</div>
        <div>
            <span>Total Products</span>
            <strong><?php echo number_format($totalProducts); ?></strong>
            <small><?php echo number_format($activeProducts); ?> active products</small>
        </div>
    </div>
    <div class="dashboard-metric-card metric-green">
        <div class="metric-icon">📊</div>
        <div>
            <span>Total Stock Units</span>
            <strong><?php echo number_format($totalStockUnits); ?></strong>
            <small>Across colour + size variants</small>
        </div>
    </div>
    <div class="dashboard-metric-card metric-orange">
        <div class="metric-icon">⚠️</div>
        <div>
            <span>Low Stock Variants</span>
            <strong><?php echo number_format($lowStockCount); ?></strong>
            <small>Below 5 units</small>
        </div>
    </div>
    <div class="dashboard-metric-card metric-red">
        <div class="metric-icon">⛔</div>
        <div>
            <span>Out of Stock</span>
            <strong><?php echo number_format($outStockCount); ?></strong>
            <small><?php echo number_format($noStockProducts); ?> products without stock rows</small>
        </div>
    </div>
    <div class="dashboard-metric-card metric-purple">
        <div class="metric-icon">👥</div>
        <div>
            <span>Total Customers</span>
            <strong><?php echo number_format($totalCustomers); ?></strong>
            <small>Registered customer accounts</small>
        </div>
    </div>
</section>

<section class="dashboard-layout-grid">
    <div class="admin-card dashboard-panel stock-health-panel">
        <div class="dashboard-section-head">
            <div>
                <h3 class="admin-card-title">Stock Health Overview</h3>
                <p class="admin-card-subtitle">Variant-level stock status based on product, colour and size.</p>
            </div>
            <a href="stock_report.php#current-stock-levels" class="dashboard-mini-link">View report</a>
        </div>

        <div class="stock-health-list">
            <div class="stock-health-row good">
                <div>
                    <strong>Good Stock</strong>
                    <span><?php echo number_format($goodStockCount); ?> variants</span>
                </div>
                <div class="stock-health-bar"><span style="width: <?php echo $stockHealthPercent($goodStockCount); ?>%;"></span></div>
            </div>
            <div class="stock-health-row low">
                <div>
                    <strong>Low Stock</strong>
                    <span><?php echo number_format($lowStockCount); ?> variants</span>
                </div>
                <div class="stock-health-bar"><span style="width: <?php echo $stockHealthPercent($lowStockCount); ?>%;"></span></div>
            </div>
            <div class="stock-health-row out">
                <div>
                    <strong>Out of Stock</strong>
                    <span><?php echo number_format($outStockCount); ?> variants</span>
                </div>
                <div class="stock-health-bar"><span style="width: <?php echo $stockHealthPercent($outStockCount); ?>%;"></span></div>
            </div>
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
            <a href="add_product.php" class="dashboard-action-card"><span>＋</span><strong>Add Product</strong><small>Create new product</small></a>
            <a href="stock_in.php" class="dashboard-action-card"><span>↗</span><strong>Stock In</strong><small>Add inventory</small></a>
            <a href="stock_out.php" class="dashboard-action-card"><span>↘</span><strong>Stock Out</strong><small>Remove inventory</small></a>
            <a href="stock_report.php" class="dashboard-action-card"><span>↬</span><strong>Stock Report</strong><small>View report</small></a>
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
            <a href="stock_report.php#current-stock-levels" class="dashboard-mini-link">View all</a>
        </div>

        <?php if (!empty($lowStockVariants)): ?>
        <div class="dashboard-alert-list">
            <?php foreach ($lowStockVariants as $row): ?>
                <?php $qty = (int)$row['quantity']; ?>
                <div class="dashboard-alert-item">
                    <div class="alert-product-info">
                        <strong><?php echo h($row['name']); ?></strong>
                        <span><?php echo h($row['color_name']); ?> / <?php echo h($row['size']); ?> · <?php echo h($row['category']); ?></span>
                    </div>
                    <span class="dashboard-stock-pill <?php echo $qty <= 0 ? 'out' : 'low'; ?>"><?php echo $qty <= 0 ? 'Out' : 'Low'; ?> · <?php echo $qty; ?></span>
                    <a class="btn btn-success btn-sm" href="stock_in.php?product_id=<?php echo (int)$row['product_id']; ?>&color_id=<?php echo (int)$row['color_id']; ?>&size=<?php echo urlencode((string)$row['size']); ?>">Stock In</a>
                </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
            <div class="dashboard-empty-state">No low stock variants found.</div>
        <?php endif; ?>
    </div>

    <div class="admin-card dashboard-panel">
        <div class="dashboard-section-head">
            <div>
                <h3 class="admin-card-title">Recent Stock Movement</h3>
                <p class="admin-card-subtitle">Latest Stock In and Stock Out activity.</p>
            </div>
            <a href="stock_report.php#stock-movement-history" class="dashboard-mini-link">View history</a>
        </div>

        <?php if (!empty($recentHistory)): ?>
        <div class="dashboard-history-list">
            <?php foreach ($recentHistory as $row): ?>
                <?php
                    $movementType = strtoupper((string)$row['type']) === 'IN' ? 'IN' : 'OUT';
                    $changePrefix = $movementType === 'IN' ? '+' : '-';
                ?>
                <div class="dashboard-history-item">
                    <div class="history-main">
                        <span class="type-badge <?php echo $movementType === 'IN' ? 'type-in' : 'type-out'; ?>"><?php echo $movementType === 'IN' ? 'Stock In' : 'Stock Out'; ?></span>
                        <strong><?php echo h($row['product_name']); ?></strong>
                        <small><?php echo h($row['color_name']); ?> / <?php echo h($row['size']); ?> · <?php echo h($row['reason']); ?></small>
                    </div>
                    <div class="history-side">
                        <strong><?php echo $changePrefix . (int)$row['quantity']; ?></strong>
                        <span><?php echo date('d M, H:i', strtotime((string)$row['created_at'])); ?></span>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
            <div class="dashboard-empty-state">No recent stock movement yet.</div>
        <?php endif; ?>
    </div>
</section>

<?php if ($isBoss && $pricingSummary): ?>
<section class="admin-card boss-pricing-panel dashboard-panel">
    <div class="dashboard-section-head">
        <div>
            <h3 class="admin-card-title">Boss Pricing Overview</h3>
            <p class="admin-card-subtitle">Cost price and online sell price are boss-only business data.</p>
        </div>
        <span class="boss-only-badge">Boss Only</span>
    </div>

    <div class="admin-stats-grid boss-dashboard-grid">
        <div class="admin-stat-card">
            <div class="admin-stat-head"><span class="admin-stat-icon">💰</span></div>
            <div class="admin-stat-number">RM <?php echo number_format((float)$pricingSummary['total_cost_value'], 2); ?></div>
            <div class="admin-stat-label">Total Cost Value</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-head"><span class="admin-stat-icon">🏷️</span></div>
            <div class="admin-stat-number">RM <?php echo number_format((float)$pricingSummary['total_store_value'], 2); ?></div>
            <div class="admin-stat-label">Store Price Value</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-head"><span class="admin-stat-icon">🛒</span></div>
            <div class="admin-stat-number">RM <?php echo number_format((float)$pricingSummary['total_online_value'], 2); ?></div>
            <div class="admin-stat-label">Online Sell Value</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-head"><span class="admin-stat-icon">📈</span></div>
            <div class="admin-stat-number">RM <?php echo number_format((float)$pricingSummary['total_store_value'] - (float)$pricingSummary['total_cost_value'], 2); ?></div>
            <div class="admin-stat-label">Potential Gross Difference</div>
        </div>
    </div>

    <?php if (!empty($bossPricingProducts)): ?>
    <div class="table-scroll-wrap">
        <table>
            <thead>
                <tr>
                    <th>Item Code</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Cost Price</th>
                    <th>Current Price</th>
                    <th>Online Sell Price</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($bossPricingProducts as $row): ?>
                <tr>
                    <td><?php echo h($row['item_code']); ?></td>
                    <td><?php echo h($row['name']); ?></td>
                    <td><?php echo (int)$row['total_quantity']; ?></td>
                    <td>RM <?php echo number_format((float)($row['cost_price'] ?? 0), 2); ?></td>
                    <td>RM <?php echo number_format((float)$row['price'], 2); ?></td>
                    <td>RM <?php echo number_format((float)($row['online_sell_price'] ?? 0), 2); ?></td>
                    <td><a class="btn btn-info btn-sm" href="edit_product.php?id=<?php echo (int)$row['id']; ?>">Edit Pricing</a></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</section>
<?php endif; ?>

<?php
require_once 'includes/footer.php';
$conn = null;
?>
