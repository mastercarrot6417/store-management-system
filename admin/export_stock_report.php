<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
require_once 'includes/stock_report_queries.php';
ensureInventoryMovementSchema($conn);

function csv_safe($value): string
{
    $value = (string)($value ?? '');
    if ($value !== '' && preg_match('/^[=+\-@]/', $value)) {
        return "\t" . $value;
    }
    return $value;
}

$reportType = strtolower(trim((string)($_GET['report_type'] ?? 'current')));
if (!in_array($reportType, ['current', 'history'], true)) {
    $reportType = 'current';
}

$filenameDate = date('Ymd_His');
$filename = $reportType === 'history'
    ? "stock_movement_history_{$filenameDate}.csv"
    : "current_stock_levels_{$filenameDate}.csv";

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

echo "\xEF\xBB\xBF"; // UTF-8 BOM for Excel compatibility
$output = fopen('php://output', 'w');

if ($reportType === 'history') {
    fputcsv($output, [
        'Date',
        'Item Code',
        'Product',
        'Category',
        'Subcategory',
        'Colour',
        'Size',
        'Movement Type',
        'Quantity Before',
        'Quantity Change',
        'Quantity After',
        'Reason',
        'Note',
        'Edited By'
    ]);

    foreach (stock_report_history_rows($conn) as $row) {
        $changeSign = (($row['type'] ?? '') === 'IN') ? '+' : '-';
        fputcsv($output, [
            !empty($row['created_at']) ? date('Y-m-d H:i:s', strtotime($row['created_at'])) : '',
            csv_safe($row['item_code'] ?? ''),
            csv_safe($row['product_name'] ?? ''),
            csv_safe($row['category'] ?? ''),
            csv_safe($row['sub_category'] ?? ''),
            csv_safe($row['color_name'] ?? 'No colour recorded'),
            csv_safe($row['size'] ?? ''),
            (($row['type'] ?? '') === 'IN') ? 'Stock In' : 'Stock Out',
            (int)($row['quantity_before'] ?? 0),
            $changeSign . (int)($row['quantity'] ?? 0),
            (int)($row['quantity_after'] ?? 0),
            csv_safe($row['reason'] ?? ''),
            csv_safe($row['note'] ?? ''),
            csv_safe($row['edited_by_admin_name'] ?? 'Not recorded'),
        ]);
    }
} else {
    fputcsv($output, [
        'Item Code',
        'Product Name',
        'Brand',
        'Category',
        'Subcategory',
        'Colour',
        'Size',
        'Quantity',
        'Price (RM)',
        'Online Price (RM)',
        'Stock Status',
        'Arrival Date'
    ]);

    foreach (stock_report_current_rows($conn) as $row) {
        $quantity = (int)($row['quantity'] ?? 0);
        fputcsv($output, [
            csv_safe($row['item_code'] ?? ''),
            csv_safe($row['name'] ?? ''),
            csv_safe($row['brand'] ?? ''),
            csv_safe($row['category'] ?? ''),
            csv_safe($row['sub_category'] ?? ''),
            csv_safe($row['color_name'] ?? 'No colour assigned'),
            csv_safe($row['size'] ?? ''),
            $quantity,
            number_format((float)($row['price'] ?? 0), 2, '.', ''),
            number_format((float)($row['online_sell_price'] ?? 0), 2, '.', ''),
            stock_report_status_label($quantity),
            csv_safe($row['arrival_date'] ?? ''),
        ]);
    }
}

fclose($output);
$conn = null;
exit;
