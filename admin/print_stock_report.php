<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
require_once 'includes/stock_report_queries.php';
ensureInventoryMovementSchema($conn);

function h($value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
}

$reportType = strtolower(trim((string)($_GET['report_type'] ?? 'all')));
if (!in_array($reportType, ['all', 'current', 'history'], true)) {
    $reportType = 'all';
}

$currentRows = [];
$historyRows = [];
if ($reportType === 'all' || $reportType === 'current') {
    $currentRows = stock_report_current_rows($conn);
}
if ($reportType === 'all' || $reportType === 'history') {
    $historyRows = stock_report_history_rows($conn);
}

$currentFilters = stock_report_current_filters();
$historyFilters = stock_report_history_filters();

function render_filter_value($value, $fallback = 'All'): string
{
    $value = trim((string)$value);
    return $value === '' || $value === '0' ? $fallback : $value;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Print Stock Report - My Dream Bike Admin</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #f3f4f6; }
        .print-shell { max-width: 1180px; margin: 24px auto; background: #fff; padding: 28px; border-radius: 16px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12); }
        .print-topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 18px; margin-bottom: 22px; }
        .print-brand { display: flex; align-items: center; gap: 14px; }
        .print-brand img { width: 74px; height: 74px; object-fit: contain; }
        .print-brand h1 { margin: 0; font-size: 26px; letter-spacing: -0.02em; }
        .print-brand p, .print-meta p { margin: 4px 0; color: #4b5563; font-size: 13px; }
        .print-actions { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 18px; }
        .print-btn { border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 700; text-decoration: none; color: #fff; background: #f97316; display: inline-block; }
        .print-btn.secondary { background: #374151; }
        .filter-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 14px 0 20px; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 12px; }
        .filter-summary span { color: #6b7280; display: block; margin-bottom: 3px; }
        .report-section { margin-top: 30px; }
        .report-section h2 { margin: 0 0 8px; font-size: 18px; color: #111827; }
        .report-count { color: #6b7280; margin-bottom: 12px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th { background: #111827; color: #fff; text-align: left; padding: 9px 7px; border: 1px solid #111827; }
        td { padding: 8px 7px; border: 1px solid #d1d5db; vertical-align: top; }
        tr:nth-child(even) td { background: #f9fafb; }
        .badge { display: inline-block; padding: 3px 7px; border-radius: 999px; font-size: 10px; font-weight: 700; }
        .badge.in { background: #dcfce7; color: #166534; }
        .badge.low { background: #fef3c7; color: #92400e; }
        .badge.out { background: #fee2e2; color: #991b1b; }
        .badge.stock-in { background: #dcfce7; color: #166534; }
        .badge.stock-out { background: #fee2e2; color: #991b1b; }
        .empty { padding: 18px; border: 1px dashed #d1d5db; color: #6b7280; border-radius: 12px; background: #f9fafb; }
        @media print {
            body { background: #fff; }
            .print-shell { max-width: none; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }
            .print-actions { display: none; }
            .report-section { break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
        }
    </style>
</head>
<body>
    <div class="print-shell">
        <div class="print-actions">
            <button class="print-btn" type="button" onclick="window.print()">Print Report</button>
            <a class="print-btn secondary" href="stock_report.php">Back to Stock Report</a>
        </div>

        <div class="print-topbar">
            <div class="print-brand">
                <img src="../company_logo/ori.logo.png" alt="My Dream Bike">
                <div>
                    <h1>My Dream Bike Stock Report</h1>
                    <p>Inventory report generated from the admin panel.</p>
                </div>
            </div>
            <div class="print-meta">
                <p><strong>Generated:</strong> <?php echo h(date('d M Y H:i')); ?></p>
                <p><strong>Report Type:</strong> <?php echo h(ucfirst($reportType)); ?></p>
                <p><strong>Generated By:</strong> <?php echo h($_SESSION['admin_name'] ?? $_SESSION['admin_email'] ?? 'Admin'); ?></p>
            </div>
        </div>

        <?php if ($reportType === 'all' || $reportType === 'current'): ?>
        <section class="report-section">
            <h2>Current Stock Levels</h2>
            <div class="report-count"><?php echo number_format(count($currentRows)); ?> current stock row(s)</div>
            <div class="filter-summary">
                <div><span>Search</span><?php echo h(render_filter_value($currentFilters['search'])); ?></div>
                <div><span>Product ID</span><?php echo h(render_filter_value((string)$currentFilters['product_id'])); ?></div>
                <div><span>Colour ID</span><?php echo h(render_filter_value((string)$currentFilters['color_id'])); ?></div>
                <div><span>Size</span><?php echo h(render_filter_value($currentFilters['size'])); ?></div>
                <div><span>Category</span><?php echo h(render_filter_value($currentFilters['category'])); ?></div>
                <div><span>Subcategory</span><?php echo h(render_filter_value($currentFilters['subcategory'])); ?></div>
                <div><span>Status</span><?php echo h(render_filter_value($currentFilters['status'])); ?></div>
            </div>
            <?php if (!empty($currentRows)): ?>
            <table>
                <thead>
                    <tr>
                        <th>Item Code</th><th>Product</th><th>Category</th><th>Subcategory</th><th>Colour</th><th>Size</th><th>Qty</th><th>Price</th><th>Online Price</th><th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($currentRows as $row): ?>
                    <?php $qty = (int)($row['quantity'] ?? 0); $status = stock_report_status_label($qty); ?>
                    <tr>
                        <td><?php echo h($row['item_code'] ?? ''); ?></td>
                        <td><?php echo h($row['name'] ?? ''); ?><br><small><?php echo h($row['brand'] ?? ''); ?></small></td>
                        <td><?php echo h($row['category'] ?? ''); ?></td>
                        <td><?php echo h($row['sub_category'] ?? ''); ?></td>
                        <td><?php echo h($row['color_name'] ?? 'No colour assigned'); ?></td>
                        <td><?php echo h($row['size'] ?? ''); ?></td>
                        <td><?php echo $qty; ?></td>
                        <td>RM <?php echo number_format((float)($row['price'] ?? 0), 2); ?></td>
                        <td>RM <?php echo number_format((float)($row['online_sell_price'] ?? 0), 2); ?></td>
                        <td><span class="badge <?php echo $qty === 0 ? 'out' : ($qty < 5 ? 'low' : 'in'); ?>"><?php echo h($status); ?></span></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
                <div class="empty">No current stock rows match the selected filters.</div>
            <?php endif; ?>
        </section>
        <?php endif; ?>

        <?php if ($reportType === 'all' || $reportType === 'history'): ?>
        <section class="report-section">
            <h2>Stock Movement History</h2>
            <div class="report-count"><?php echo number_format(count($historyRows)); ?> movement record(s)</div>
            <div class="filter-summary">
                <div><span>Search</span><?php echo h(render_filter_value($historyFilters['search'])); ?></div>
                <div><span>Product ID</span><?php echo h(render_filter_value((string)$historyFilters['product_id'])); ?></div>
                <div><span>Colour ID</span><?php echo h(render_filter_value((string)$historyFilters['color_id'])); ?></div>
                <div><span>Size</span><?php echo h(render_filter_value($historyFilters['size'])); ?></div>
                <div><span>Type</span><?php echo h(render_filter_value($historyFilters['type'])); ?></div>
                <div><span>Date From</span><?php echo h(render_filter_value($historyFilters['date_from'])); ?></div>
                <div><span>Date To</span><?php echo h(render_filter_value($historyFilters['date_to'])); ?></div>
            </div>
            <?php if (!empty($historyRows)): ?>
            <table>
                <thead>
                    <tr>
                        <th>Date</th><th>Item Code</th><th>Product</th><th>Colour</th><th>Size</th><th>Type</th><th>Before</th><th>Change</th><th>After</th><th>Reason / Note</th><th>Edited By</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($historyRows as $row): ?>
                    <?php $isIn = ($row['type'] ?? '') === 'IN'; $changeSign = $isIn ? '+' : '-'; ?>
                    <tr>
                        <td><?php echo !empty($row['created_at']) ? h(date('d M Y H:i', strtotime($row['created_at']))) : ''; ?></td>
                        <td><?php echo h($row['item_code'] ?? ''); ?></td>
                        <td><?php echo h($row['product_name'] ?? ''); ?></td>
                        <td><?php echo h($row['color_name'] ?? 'No colour recorded'); ?></td>
                        <td><?php echo h($row['size'] ?? ''); ?></td>
                        <td><span class="badge <?php echo $isIn ? 'stock-in' : 'stock-out'; ?>"><?php echo $isIn ? 'Stock In' : 'Stock Out'; ?></span></td>
                        <td><?php echo (int)($row['quantity_before'] ?? 0); ?></td>
                        <td><?php echo h($changeSign . (int)($row['quantity'] ?? 0)); ?></td>
                        <td><?php echo (int)($row['quantity_after'] ?? 0); ?></td>
                        <td><?php echo h($row['reason'] ?? ''); ?><?php if (!empty($row['note'])): ?><br><small>Note: <?php echo h($row['note']); ?></small><?php endif; ?></td>
                        <td><?php echo h($row['edited_by_admin_name'] ?? 'Not recorded'); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
                <div class="empty">No stock movement records match the selected filters.</div>
            <?php endif; ?>
        </section>
        <?php endif; ?>
    </div>
</body>
</html>
<?php
$conn = null;
?>
