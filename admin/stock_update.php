<?php
require_once 'includes/auth_check.php';

// Direct stock updates are disabled because inventory is now controlled by colour + size.
// Use Stock In and Stock Out so every stock change records colour, size, reason, note, admin and before/after quantity.
$_SESSION['error'] = 'Direct stock update has been disabled. Please use Stock In or Stock Out to adjust inventory with a reason.';
header('Location: stock_report.php#stock-movement-history');
exit();
