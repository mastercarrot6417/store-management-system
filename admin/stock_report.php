<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
ensureInventoryMovementSchema($conn);

$page_title = 'Stock Report';
$isBoss = isBossAdmin();

function h($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function get_param($key, $default = '') {
    return isset($_GET[$key]) ? trim((string)$_GET[$key]) : $default;
}

function build_page_url($pageKey, $pageValue, $anchor = '') {
    $params = $_GET;
    $params[$pageKey] = $pageValue;
    $url = '?' . http_build_query($params);

    if ($anchor !== '') {
        $url .= '#' . ltrim($anchor, '#');
    }

    return $url;
}

function build_report_tool_url($file, $extra = []) {
    $params = $_GET;
    foreach ($extra as $key => $value) {
        $params[$key] = $value;
    }
    return $file . '?' . http_build_query($params);
}

function render_pagination($pageKey, $currentPage, $totalPages, $anchor = '') {
    if ($totalPages <= 1) {
        return;
    }

    echo '<div class="report-pagination">';
    if ($currentPage > 1) {
        echo '<a href="' . h(build_page_url($pageKey, $currentPage - 1, $anchor)) . '">Previous</a>';
    } else {
        echo '<span class="disabled">Previous</span>';
    }

    $start = max(1, $currentPage - 2);
    $end = min($totalPages, $currentPage + 2);

    if ($start > 1) {
        echo '<a href="' . h(build_page_url($pageKey, 1, $anchor)) . '">1</a>';
        if ($start > 2) {
            echo '<span class="dots">...</span>';
        }
    }

    for ($i = $start; $i <= $end; $i++) {
        if ($i == $currentPage) {
            echo '<span class="active">' . $i . '</span>';
        } else {
            echo '<a href="' . h(build_page_url($pageKey, $i, $anchor)) . '">' . $i . '</a>';
        }
    }

    if ($end < $totalPages) {
        if ($end < $totalPages - 1) {
            echo '<span class="dots">...</span>';
        }
        echo '<a href="' . h(build_page_url($pageKey, $totalPages, $anchor)) . '">' . $totalPages . '</a>';
    }

    if ($currentPage < $totalPages) {
        echo '<a href="' . h(build_page_url($pageKey, $currentPage + 1, $anchor)) . '">Next</a>';
    } else {
        echo '<span class="disabled">Next</span>';
    }
    echo '</div>';
}

// Dropdown values from database
$categories = $conn->query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC")->fetchAll(PDO::FETCH_COLUMN);
$subcategories = $conn->query("SELECT DISTINCT sub_category FROM products WHERE sub_category IS NOT NULL AND sub_category != '' ORDER BY sub_category ASC")->fetchAll(PDO::FETCH_COLUMN);
$stockProductOptions = $conn->query("SELECT id, item_code, name FROM products ORDER BY name ASC")->fetchAll();
$stockColorOptions = $conn->query("SELECT DISTINCT pc.id, pc.color_name FROM product_colors pc INNER JOIN product_sizes ps ON ps.color_id = pc.id ORDER BY pc.color_name ASC")->fetchAll();
$stockSizeOptions = $conn->query("SELECT DISTINCT TRIM(size) AS size FROM product_sizes WHERE NULLIF(TRIM(size), '') IS NOT NULL ORDER BY TRIM(size) ASC")->fetchAll(PDO::FETCH_COLUMN);

// Summary cards
$totalProducts = (int)$conn->query("SELECT COUNT(*) FROM products")->fetchColumn();
$totalStockQty = (int)$conn->query("SELECT COALESCE(SUM(quantity), 0) FROM product_sizes")->fetchColumn();
$lowStockVariants = (int)$conn->query("SELECT COUNT(*) FROM product_sizes WHERE quantity > 0 AND quantity < 5")->fetchColumn();
$outOfStockVariants = (int)$conn->query("SELECT COUNT(*) FROM product_sizes WHERE quantity = 0")->fetchColumn();
$goodStockVariants = (int)$conn->query("SELECT COUNT(*) FROM product_sizes WHERE quantity >= 5")->fetchColumn();
$totalStockValue = 0.0;
if ($isBoss) {
    $totalStockValue = (float)$conn->query("
        SELECT COALESCE(SUM(ps.quantity * CASE WHEN COALESCE(p.online_sell_price, 0) > 0 THEN p.online_sell_price ELSE p.price END), 0)
        FROM product_sizes ps
        JOIN products p ON p.id = ps.product_id
    ")->fetchColumn();
}
$legacyStockRows = (int)$conn->query("SELECT COUNT(*) FROM product_sizes WHERE color_id IS NULL")->fetchColumn();
$legacyHistoryRows = (int)$conn->query("SELECT COUNT(*) FROM stock_history WHERE color_id IS NULL")->fetchColumn();

// Current Stock filters
$currentSearch = get_param('current_search');
$currentProductId = max(0, (int)get_param('current_product_id', '0'));
$currentColorId = max(0, (int)get_param('current_color_id', '0'));
$currentSize = get_param('current_size');
$currentCategory = get_param('current_category');
$currentSubcategory = get_param('current_subcategory');
$currentStatus = get_param('current_status');
$currentSort = get_param('current_sort', 'name_asc');
$currentPage = max(1, (int)get_param('current_page', '1'));
$currentPerPage = 10;

$currentWhere = ['1=1'];
$currentParams = [];

if ($currentSearch !== '') {
    $currentWhere[] = "(p.item_code ILIKE ? OR p.name ILIKE ? OR p.brand ILIKE ? OR p.category ILIKE ? OR p.sub_category ILIKE ? OR ps.size ILIKE ? OR pc.color_name ILIKE ?)";
    $like = '%' . $currentSearch . '%';
    array_push($currentParams, $like, $like, $like, $like, $like, $like, $like);
}
if ($currentProductId > 0) {
    $currentWhere[] = 'p.id = ?';
    $currentParams[] = $currentProductId;
}
if ($currentColorId > 0) {
    $currentWhere[] = 'ps.color_id = ?';
    $currentParams[] = $currentColorId;
}
if ($currentSize !== '') {
    $currentWhere[] = 'LOWER(TRIM(ps.size)) = LOWER(TRIM(?))';
    $currentParams[] = $currentSize;
}
if ($currentCategory !== '') {
    $currentWhere[] = 'p.category = ?';
    $currentParams[] = $currentCategory;
}
if ($currentSubcategory !== '') {
    $currentWhere[] = 'p.sub_category = ?';
    $currentParams[] = $currentSubcategory;
}
if ($currentStatus === 'out') {
    $currentWhere[] = 'ps.quantity = 0';
} elseif ($currentStatus === 'low') {
    $currentWhere[] = 'ps.quantity > 0 AND ps.quantity < 5';
} elseif ($currentStatus === 'in') {
    $currentWhere[] = 'ps.quantity >= 5';
}

$currentSortOptions = [
    'name_asc' => 'p.name ASC, pc.color_name ASC, ps.size ASC',
    'item_code_asc' => 'p.item_code ASC, pc.color_name ASC, ps.size ASC',
    'category_asc' => 'p.category ASC, p.sub_category ASC, p.name ASC, pc.color_name ASC',
    'qty_asc' => 'ps.quantity ASC, p.name ASC, pc.color_name ASC',
    'qty_desc' => 'ps.quantity DESC, p.name ASC, pc.color_name ASC',
    'arrival_desc' => 'p.arrival_date DESC, p.name ASC, pc.color_name ASC'
];
$currentOrderBy = $currentSortOptions[$currentSort] ?? $currentSortOptions['name_asc'];
$currentWhereSql = implode(' AND ', $currentWhere);

$currentCountStmt = $conn->prepare("SELECT COUNT(*) FROM products p JOIN product_sizes ps ON p.id = ps.product_id LEFT JOIN product_colors pc ON pc.id = ps.color_id WHERE {$currentWhereSql}");
$currentCountStmt->execute($currentParams);
$currentTotalRows = (int)$currentCountStmt->fetchColumn();
$currentTotalPages = max(1, (int)ceil($currentTotalRows / $currentPerPage));
$currentPage = min($currentPage, $currentTotalPages);
$currentOffset = ($currentPage - 1) * $currentPerPage;

$displayImageSql = "COALESCE(
        (SELECT pi.image_path
         FROM product_images pi
         LEFT JOIN product_colors pic ON pic.id = pi.color_id
         WHERE pi.product_id = p.id AND (pi.color_id = ps.color_id OR ps.color_id IS NULL)
         ORDER BY CASE WHEN pi.color_id = ps.color_id THEN 0 ELSE 1 END, COALESCE(pic.is_default, FALSE) DESC, pi.is_main DESC, pi.sort_order ASC, pi.id ASC
         LIMIT 1),
        (SELECT pi2.image_path
         FROM product_images pi2
         LEFT JOIN product_colors pc2 ON pc2.id = pi2.color_id
         WHERE pi2.product_id = p.id
         ORDER BY COALESCE(pc2.is_default, FALSE) DESC, pi2.is_main DESC, pi2.sort_order ASC, pi2.id ASC
         LIMIT 1),
        NULLIF(p.image, '')
    )";

$currentSql = "
    SELECT p.id, p.item_code, p.name, p.brand, p.category, p.sub_category, p.price, p.online_sell_price, p.arrival_date,
           ps.id AS size_id, ps.color_id, COALESCE(pc.color_name, 'No colour assigned') AS color_name, ps.size, ps.quantity, {$displayImageSql} AS display_image
    FROM products p
    JOIN product_sizes ps ON p.id = ps.product_id
    LEFT JOIN product_colors pc ON pc.id = ps.color_id
    WHERE {$currentWhereSql}
    ORDER BY {$currentOrderBy}
    LIMIT {$currentPerPage} OFFSET {$currentOffset}
";
$currentStmt = $conn->prepare($currentSql);
$currentStmt->execute($currentParams);
$products = $currentStmt->fetchAll();

// Stock Movement filters
$historySearch = get_param('history_search');
$historyProductId = max(0, (int)get_param('history_product_id', '0'));
$historyColorId = max(0, (int)get_param('history_color_id', '0'));
$historySize = get_param('history_size');
$historyType = strtoupper(get_param('history_type'));
$historyCategory = get_param('history_category');
$historySubcategory = get_param('history_subcategory');
$dateFrom = get_param('date_from');
$dateTo = get_param('date_to');
$historyPage = max(1, (int)get_param('history_page', '1'));
$historyPerPage = 10;

$historyWhere = ['1=1'];
$historyParams = [];

if ($historySearch !== '') {
    $historyWhere[] = "(p.item_code ILIKE ? OR p.name ILIKE ? OR p.category ILIKE ? OR p.sub_category ILIKE ? OR sh.size ILIKE ? OR pc.color_name ILIKE ? OR sh.reason ILIKE ? OR sh.note ILIKE ? OR sh.edited_by_admin_name ILIKE ?)";
    $like = '%' . $historySearch . '%';
    array_push($historyParams, $like, $like, $like, $like, $like, $like, $like, $like, $like);
}
if ($historyProductId > 0) {
    $historyWhere[] = 'p.id = ?';
    $historyParams[] = $historyProductId;
}
if ($historyColorId > 0) {
    $historyWhere[] = 'sh.color_id = ?';
    $historyParams[] = $historyColorId;
}
if ($historySize !== '') {
    $historyWhere[] = 'LOWER(TRIM(sh.size)) = LOWER(TRIM(?))';
    $historyParams[] = $historySize;
}
if ($historyType === 'IN' || $historyType === 'OUT') {
    $historyWhere[] = 'sh.type = ?';
    $historyParams[] = $historyType;
}
if ($historyCategory !== '') {
    $historyWhere[] = 'p.category = ?';
    $historyParams[] = $historyCategory;
}
if ($historySubcategory !== '') {
    $historyWhere[] = 'p.sub_category = ?';
    $historyParams[] = $historySubcategory;
}
if ($dateFrom !== '') {
    $historyWhere[] = 'date(sh.created_at) >= date(?)';
    $historyParams[] = $dateFrom;
}
if ($dateTo !== '') {
    $historyWhere[] = 'date(sh.created_at) <= date(?)';
    $historyParams[] = $dateTo;
}

$historyWhereSql = implode(' AND ', $historyWhere);
$historyCountStmt = $conn->prepare("SELECT COUNT(*) FROM stock_history sh JOIN products p ON sh.product_id = p.id LEFT JOIN product_colors pc ON pc.id = sh.color_id WHERE {$historyWhereSql}");
$historyCountStmt->execute($historyParams);
$historyTotalRows = (int)$historyCountStmt->fetchColumn();
$historyTotalPages = max(1, (int)ceil($historyTotalRows / $historyPerPage));
$historyPage = min($historyPage, $historyTotalPages);
$historyOffset = ($historyPage - 1) * $historyPerPage;

$historySql = "
    SELECT sh.*, p.name AS product_name, p.item_code, p.category, p.sub_category, COALESCE(pc.color_name, 'No colour recorded') AS color_name
    FROM stock_history sh
    JOIN products p ON sh.product_id = p.id
    LEFT JOIN product_colors pc ON pc.id = sh.color_id
    WHERE {$historyWhereSql}
    ORDER BY sh.created_at DESC
    LIMIT {$historyPerPage} OFFSET {$historyOffset}
";
$historyStmt = $conn->prepare($historySql);
$historyStmt->execute($historyParams);
$history = $historyStmt->fetchAll();

require_once 'includes/header.php';
?>

<section class="stock-report-hero no-print">
    <div>
        <span class="stock-report-eyebrow">Inventory Reporting</span>
        <h2>Stock Report</h2>
        <p>Monitor product stock levels, colour and size variants, and every Stock In / Stock Out movement record.</p>
    </div>
    <div class="stock-report-hero-actions">
        <a class="btn btn-secondary" href="dashboard.php">Back to Dashboard</a>
        <a class="btn btn-primary" href="<?php echo h(build_report_tool_url('print_stock_report.php', ['report_type' => 'all'])); ?>" target="_blank" rel="noopener">Print Full Report</a>
    </div>
</section>

<!-- Summary Cards -->
<div class="admin-stats-grid stock-report-stats-grid">
    <div class="admin-stat-card report-stat-card report-stat-total">
        <div class="admin-stat-head"><span class="admin-stat-icon">📦</span><span class="report-stat-tag">Products</span></div>
        <div class="admin-stat-number"><?php echo number_format($totalProducts); ?></div>
        <div class="admin-stat-label">Total Products</div>
    </div>
    <div class="admin-stat-card report-stat-card report-stat-stock">
        <div class="admin-stat-head"><span class="admin-stat-icon">📊</span><span class="report-stat-tag">Units</span></div>
        <div class="admin-stat-number"><?php echo number_format($totalStockQty); ?></div>
        <div class="admin-stat-label">Total Stock Units</div>
    </div>
    <div class="admin-stat-card report-stat-card report-stat-low">
        <div class="admin-stat-head"><span class="admin-stat-icon">⚠️</span><span class="report-stat-tag">1-4 units</span></div>
        <div class="admin-stat-number"><?php echo number_format($lowStockVariants); ?></div>
        <div class="admin-stat-label">Low Stock Variants</div>
    </div>
    <div class="admin-stat-card report-stat-card report-stat-out">
        <div class="admin-stat-head"><span class="admin-stat-icon">⛔</span><span class="report-stat-tag">0 units</span></div>
        <div class="admin-stat-number"><?php echo number_format($outOfStockVariants); ?></div>
        <div class="admin-stat-label">Out of Stock Variants</div>
    </div>
    <?php if ($isBoss): ?>
    <div class="admin-stat-card report-stat-card report-stat-value">
        <div class="admin-stat-head"><span class="admin-stat-icon">💰</span><span class="report-stat-tag">Boss Only</span></div>
        <div class="admin-stat-number">RM <?php echo number_format($totalStockValue, 2); ?></div>
        <div class="admin-stat-label">Total Stock Value</div>
    </div>
    <?php endif; ?>
</div>

<?php if ($legacyStockRows > 0 || $legacyHistoryRows > 0): ?>
<div class="alert alert-warning inventory-legacy-warning">
    <strong>Legacy colour data needs review.</strong>
    <?php if ($legacyStockRows > 0): ?><?php echo (int)$legacyStockRows; ?> current stock row(s) still have no colour assigned.<?php endif; ?>
    <?php if ($legacyHistoryRows > 0): ?><?php echo (int)$legacyHistoryRows; ?> stock history row(s) still have no colour recorded.<?php endif; ?>
    Run <code>database/latest_database_schema.sql</code> in Supabase. If rows still appear after that, re-add the correct quantity through Stock In under the correct colour and review the old legacy row manually.
</div>
<?php endif; ?>

<div class="admin-card stock-health-panel no-print">
    <div class="stock-health-head">
        <div>
            <h3 class="admin-card-title">Stock Health Overview</h3>
            <p class="report-tool-note">Current variant status based on product colour and size quantities.</p>
        </div>
        <a class="btn btn-primary btn-sm" href="stock_in.php">Stock In</a>
    </div>
    <div class="stock-health-grid">
        <div class="stock-health-item good"><strong><?php echo number_format($goodStockVariants); ?></strong><span>Good Stock</span></div>
        <div class="stock-health-item low"><strong><?php echo number_format($lowStockVariants); ?></strong><span>Low Stock</span></div>
        <div class="stock-health-item out"><strong><?php echo number_format($outOfStockVariants); ?></strong><span>Out of Stock</span></div>
    </div>
</div>

<div class="admin-card" id="current-stock-levels">
    <div class="report-section-head">
        <div>
            <h3 class="admin-card-title">Current Stock Levels</h3>
            <div class="report-count">Showing <?php echo count($products); ?> of <?php echo number_format($currentTotalRows); ?> stock rows</div>
        </div>
        <div class="section-report-actions no-print">
            <a class="btn btn-secondary btn-sm" href="<?php echo h(build_report_tool_url('print_stock_report.php', ['report_type' => 'current'])); ?>" target="_blank" rel="noopener">Print Current</a>
            <a class="btn btn-success btn-sm" href="<?php echo h(build_report_tool_url('export_stock_report.php', ['report_type' => 'current'])); ?>">Export Current CSV</a>
        </div>
    </div>

    <form class="stock-report-toolbar current-toolbar" method="GET" action="stock_report.php#current-stock-levels">
        <input type="hidden" name="current_page" value="1">
        <input type="hidden" name="history_search" value="<?php echo h($historySearch); ?>">
        <input type="hidden" name="history_product_id" value="<?php echo (int)$historyProductId; ?>">
        <input type="hidden" name="history_color_id" value="<?php echo (int)$historyColorId; ?>">
        <input type="hidden" name="history_size" value="<?php echo h($historySize); ?>">
        <input type="hidden" name="history_type" value="<?php echo h($historyType); ?>">
        <input type="hidden" name="history_category" value="<?php echo h($historyCategory); ?>">
        <input type="hidden" name="history_subcategory" value="<?php echo h($historySubcategory); ?>">
        <input type="hidden" name="date_from" value="<?php echo h($dateFrom); ?>">
        <input type="hidden" name="date_to" value="<?php echo h($dateTo); ?>">
        <input type="hidden" name="history_page" value="<?php echo (int)$historyPage; ?>">
        <div class="field"><label>Search Current Stock</label><input type="text" name="current_search" placeholder="Search item code, name, colour, category, size..." value="<?php echo h($currentSearch); ?>"></div>
        <div class="field"><label>Product</label><select name="current_product_id"><option value="0">All Products</option><?php foreach ($stockProductOptions as $option): ?><option value="<?php echo (int)$option['id']; ?>" <?php echo ((int)$currentProductId === (int)$option['id']) ? 'selected' : ''; ?>><?php echo h(($option['item_code'] ? $option['item_code'] . ' - ' : '') . $option['name']); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Colour</label><select name="current_color_id"><option value="0">All Colours</option><?php foreach ($stockColorOptions as $option): ?><option value="<?php echo (int)$option['id']; ?>" <?php echo ((int)$currentColorId === (int)$option['id']) ? 'selected' : ''; ?>><?php echo h($option['color_name']); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Size</label><select name="current_size"><option value="">All Sizes</option><?php foreach ($stockSizeOptions as $option): ?><option value="<?php echo h($option); ?>" <?php echo ($currentSize === $option) ? 'selected' : ''; ?>><?php echo h($option); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Category</label><select name="current_category"><option value="">All Categories</option><?php foreach ($categories as $cat): ?><option value="<?php echo h($cat); ?>" <?php echo ($currentCategory === $cat) ? 'selected' : ''; ?>><?php echo h($cat); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Subcategory</label><select name="current_subcategory"><option value="">All Subcategories</option><?php foreach ($subcategories as $sub): ?><option value="<?php echo h($sub); ?>" <?php echo ($currentSubcategory === $sub) ? 'selected' : ''; ?>><?php echo h($sub); ?></option><?php endforeach; ?></select></div>
        <div class="filter-row-break"></div>
        <div class="field"><label>Stock Status</label><select name="current_status"><option value="" <?php echo ($currentStatus === '') ? 'selected' : ''; ?>>All Status</option><option value="low" <?php echo ($currentStatus === 'low') ? 'selected' : ''; ?>>Low Stock</option><option value="out" <?php echo ($currentStatus === 'out') ? 'selected' : ''; ?>>Out of Stock</option><option value="in" <?php echo ($currentStatus === 'in') ? 'selected' : ''; ?>>In Stock</option></select></div>
        <div class="field"><label>Sort By</label><select name="current_sort"><option value="name_asc" <?php echo ($currentSort === 'name_asc') ? 'selected' : ''; ?>>Name A-Z</option><option value="item_code_asc" <?php echo ($currentSort === 'item_code_asc') ? 'selected' : ''; ?>>Item Code A-Z</option><option value="category_asc" <?php echo ($currentSort === 'category_asc') ? 'selected' : ''; ?>>Category</option><option value="qty_asc" <?php echo ($currentSort === 'qty_asc') ? 'selected' : ''; ?>>Quantity Low to High</option><option value="qty_desc" <?php echo ($currentSort === 'qty_desc') ? 'selected' : ''; ?>>Quantity High to Low</option><option value="arrival_desc" <?php echo ($currentSort === 'arrival_desc') ? 'selected' : ''; ?>>Newest Arrival</option></select></div>
        <div class="filter-actions-right">
            <button type="submit" class="btn btn-primary">Search</button>
            <a href="stock_report.php#current-stock-levels" class="btn btn-secondary">Reset</a>
        </div>
    </form>

    <?php if (!empty($products)): ?>
    <div class="table-scroll-wrap">
        <table>
            <thead><tr><th>Image</th><th>Item Code</th><th>Product Name</th><th>Category</th><th>Subcategory</th><th>Colour</th><th>Size</th><th>Quantity</th><th>Price (RM)</th><th>Online Price (RM)</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            <?php foreach ($products as $row): ?>
            <tr>
                <td><?php $img = $row['display_image'] ?? ''; $imgFile = $img ? ('../' . ltrim($img, '/')) : ''; if ($img && file_exists($imgFile)): ?><img src="../<?php echo h(ltrim($img, '/')); ?>" alt="" class="admin-product-thumb"><?php else: ?><div class="admin-thumb-placeholder">N/A</div><?php endif; ?></td>
                <td><?php echo h($row['item_code']); ?></td>
                <td><strong><?php echo h($row['name']); ?></strong><br><span style="color:#6b7280;font-size:12px;"><?php echo h($row['brand']); ?></span></td>
                <td><?php echo h($row['category']); ?></td>
                <td><?php echo h($row['sub_category']); ?></td>
                <td>
                    <?php if (empty($row['color_id'])): ?>
                        <span class="status-badge status-low">Legacy / No colour</span>
                    <?php else: ?>
                        <?php echo h($row['color_name'] ?? 'No colour assigned'); ?>
                    <?php endif; ?>
                </td>
                <td><?php echo h($row['size']); ?></td>
                <td class="<?php echo ((int)$row['quantity'] < 5) ? 'low-stock' : ''; ?>"><?php echo (int)$row['quantity']; ?></td>
                <td><?php echo number_format((float)$row['price'], 2); ?></td>
                <td><?php echo number_format((float)($row['online_sell_price'] ?? 0), 2); ?></td>
                <td class="stock-status-cell"><?php if ((int)$row['quantity'] === 0): ?><span class="status-badge status-out">Out of Stock</span><?php elseif ((int)$row['quantity'] < 5): ?><span class="status-badge status-low">Low Stock</span><?php else: ?><span class="status-badge status-in">In Stock</span><?php endif; ?></td>
                <td>
                    <div class="action-btns">
                        <?php if (empty($row['color_id'])): ?>
                            <a class="btn btn-secondary btn-sm" href="manage_product_colors.php?product_id=<?php echo (int)$row['id']; ?>">Review Colour</a>
                        <?php else: ?>
                            <a class="btn btn-success btn-sm" href="stock_in.php?product_id=<?php echo (int)$row['id']; ?>&color_id=<?php echo (int)$row['color_id']; ?>&size=<?php echo urlencode($row['size']); ?>">Stock In</a>
                            <a class="btn btn-danger btn-sm" href="stock_out.php?product_id=<?php echo (int)$row['id']; ?>&color_id=<?php echo (int)$row['color_id']; ?>&size_id=<?php echo (int)($row['size_id'] ?? 0); ?>">Stock Out</a>
                        <?php endif; ?>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php render_pagination('current_page', $currentPage, $currentTotalPages, 'current-stock-levels'); ?>
    <?php else: ?><p style="color:#888;padding:20px 0;">No stock rows match your search/filter.</p><?php endif; ?>
</div>

<div class="admin-card" id="stock-movement-history">
    <div class="report-section-head">
        <div>
            <h3 class="admin-card-title">Stock Movement History</h3>
            <div class="report-count">Showing <?php echo count($history); ?> of <?php echo number_format($historyTotalRows); ?> movement records · Page <?php echo (int)$historyPage; ?> of <?php echo (int)$historyTotalPages; ?></div>
        </div>
        <div class="section-report-actions no-print">
            <a class="btn btn-secondary btn-sm" href="<?php echo h(build_report_tool_url('print_stock_report.php', ['report_type' => 'history'])); ?>" target="_blank" rel="noopener">Print Movement</a>
            <a class="btn btn-success btn-sm" href="<?php echo h(build_report_tool_url('export_stock_report.php', ['report_type' => 'history'])); ?>">Export Movement CSV</a>
        </div>
    </div>
    <div class="stock-history-audit-note no-print">
        Stock Movement History is view-only. To correct stock, use Stock In or Stock Out with a clear reason so the audit trail stays accurate.
    </div>
    <form class="stock-report-toolbar history-toolbar" method="GET" action="stock_report.php#stock-movement-history">
        <input type="hidden" name="history_page" value="1"><input type="hidden" name="current_search" value="<?php echo h($currentSearch); ?>"><input type="hidden" name="current_product_id" value="<?php echo (int)$currentProductId; ?>"><input type="hidden" name="current_color_id" value="<?php echo (int)$currentColorId; ?>"><input type="hidden" name="current_size" value="<?php echo h($currentSize); ?>"><input type="hidden" name="current_category" value="<?php echo h($currentCategory); ?>"><input type="hidden" name="current_subcategory" value="<?php echo h($currentSubcategory); ?>"><input type="hidden" name="current_status" value="<?php echo h($currentStatus); ?>"><input type="hidden" name="current_sort" value="<?php echo h($currentSort); ?>"><input type="hidden" name="current_page" value="<?php echo (int)$currentPage; ?>">
        <div class="field"><label>Search Movement</label><input type="text" name="history_search" placeholder="Search item code, name, colour, size, reason, note, edited by..." value="<?php echo h($historySearch); ?>"></div>
        <div class="field"><label>Product</label><select name="history_product_id"><option value="0">All Products</option><?php foreach ($stockProductOptions as $option): ?><option value="<?php echo (int)$option['id']; ?>" <?php echo ((int)$historyProductId === (int)$option['id']) ? 'selected' : ''; ?>><?php echo h(($option['item_code'] ? $option['item_code'] . ' - ' : '') . $option['name']); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Colour</label><select name="history_color_id"><option value="0">All Colours</option><?php foreach ($stockColorOptions as $option): ?><option value="<?php echo (int)$option['id']; ?>" <?php echo ((int)$historyColorId === (int)$option['id']) ? 'selected' : ''; ?>><?php echo h($option['color_name']); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Size</label><select name="history_size"><option value="">All Sizes</option><?php foreach ($stockSizeOptions as $option): ?><option value="<?php echo h($option); ?>" <?php echo ($historySize === $option) ? 'selected' : ''; ?>><?php echo h($option); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Type</label><select name="history_type"><option value="" <?php echo ($historyType === '') ? 'selected' : ''; ?>>All Types</option><option value="IN" <?php echo ($historyType === 'IN') ? 'selected' : ''; ?>>Stock In</option><option value="OUT" <?php echo ($historyType === 'OUT') ? 'selected' : ''; ?>>Stock Out</option></select></div>
        <div class="field"><label>Category</label><select name="history_category"><option value="">All Categories</option><?php foreach ($categories as $cat): ?><option value="<?php echo h($cat); ?>" <?php echo ($historyCategory === $cat) ? 'selected' : ''; ?>><?php echo h($cat); ?></option><?php endforeach; ?></select></div>
        <div class="field"><label>Subcategory</label><select name="history_subcategory"><option value="">All Subcategories</option><?php foreach ($subcategories as $sub): ?><option value="<?php echo h($sub); ?>" <?php echo ($historySubcategory === $sub) ? 'selected' : ''; ?>><?php echo h($sub); ?></option><?php endforeach; ?></select></div>
        <div class="filter-row-break"></div>
        <div class="field"><label>From Date</label><input type="date" name="date_from" value="<?php echo h($dateFrom); ?>"></div>
        <div class="field"><label>To Date</label><input type="date" name="date_to" value="<?php echo h($dateTo); ?>"></div>
        <div class="filter-actions-right">
            <button type="submit" class="btn btn-primary">Search</button>
            <a href="stock_report.php#stock-movement-history" class="btn btn-secondary">Reset</a>
        </div>
    </form>

    <?php if (!empty($history)): ?>
    <div class="table-scroll-wrap">
        <table>
            <thead><tr><th>Date</th><th>Item Code</th><th>Product</th><th>Category</th><th>Subcategory</th><th>Colour</th><th>Size</th><th>Type</th><th>Before</th><th>Change</th><th>After</th><th>Reason / Note</th></tr></thead>
            <tbody><?php foreach ($history as $row): ?>
            <?php $changeSign = ($row['type'] === 'IN') ? '+' : '-'; ?>
            <tr>
                <td><?php echo h(date('d M Y H:i', strtotime($row['created_at']))); ?></td>
                <td><?php echo h($row['item_code']); ?></td>
                <td><?php echo h($row['product_name']); ?></td>
                <td><?php echo h($row['category']); ?></td>
                <td><?php echo h($row['sub_category']); ?></td>
                <td><?php echo h($row['color_name'] ?? 'No colour assigned'); ?></td>
                <td><?php echo h($row['size']); ?></td>
                <td><span class="type-badge <?php echo ($row['type'] === 'IN') ? 'type-in' : 'type-out'; ?>"><?php echo ($row['type'] === 'IN') ? 'Stock In' : 'Stock Out'; ?></span></td>
                <td><?php echo (int)($row['quantity_before'] ?? 0); ?></td>
                <td><?php echo h($changeSign . (int)$row['quantity']); ?></td>
                <td><?php echo (int)($row['quantity_after'] ?? 0); ?></td>
                <td>
                    <?php echo h($row['reason']); ?>
                    <?php if (!empty($row['note'])): ?><div class="audit-meta">Note: <?php echo h($row['note']); ?></div><?php endif; ?>
                    <div class="audit-meta">Edited by: <?php echo h($row['edited_by_admin_name'] ?? 'Not recorded'); ?></div>
                </td>
            </tr>
            <?php endforeach; ?></tbody>
        </table>
    </div>
    <?php render_pagination('history_page', $historyPage, $historyTotalPages, 'stock-movement-history'); ?>
    <?php else: ?><p style="color:#888;padding:20px 0;">No stock movements match your search/filter.</p><?php endif; ?>
</div>

<?php
require_once 'includes/footer.php';
$conn = null;
?>
