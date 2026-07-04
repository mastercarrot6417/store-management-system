<?php
// Determine current page for active highlighting
$current_page = basename($_SERVER['PHP_SELF']);
$adminRole = $_SESSION['admin_role'] ?? 'admin';
$isBossHeader = ($adminRole === 'boss');
$adminDisplayName = $_SESSION['admin_name'] ?? $_SESSION['admin_email'] ?? 'Admin';
$roleLabel = $isBossHeader ? 'Boss Admin' : 'Staff Admin';

function adminIcon($name) {
    $icons = [
        'dashboard' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 13h8V3H3v10Z"/><path d="M13 21h8V11h-8v10Z"/><path d="M13 3v6h8V3h-8Z"/><path d="M3 21h8v-6H3v6Z"/></svg>',
        'products' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
        'add' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
        'stock' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11h6"/><path d="M9 15h6"/><path d="M9 7h6"/><path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/></svg>',
        'stock_in' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14"/><path d="M5 12h14"/><path d="M4 4h16v16H4z"/></svg>',
        'stock_out' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/><path d="M4 4h16v16H4z"/></svg>',
        'store' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9h18l-1.5-5h-15L3 9Z"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 20v-6h6v6"/></svg>',
        'logout' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg>'
    ];
    return $icons[$name] ?? '';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($page_title) ? $page_title . ' - ' : ''; ?>My Dream Bike Admin</title>
    <meta name="csrf-token" content="<?php echo $_SESSION['csrf_token']; ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../assets/css/style.css">
    <link rel="stylesheet" href="assets/admin.css?v=49">
</head>
<body class="admin-panel-body">
<div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleAdminSidebar(false)"></div>
<div class="admin-wrapper">

    <aside id="admin-sidebar" class="sidebar">
        <div class="sidebar-brand">
            <img src="../company_logo/ori.logo.png" alt="My Dream Bike" class="sidebar-logo-img">
            <div class="sidebar-brand-text">
                <strong>My Dream Bike</strong>
                <span>Admin Panel</span>
                <span class="admin-role-pill <?php echo $isBossHeader ? 'boss' : ''; ?>"><?php echo htmlspecialchars($roleLabel); ?></span>
            </div>
        </div>
        <ul class="nav-menu">
            <li><a href="dashboard.php" class="<?php echo ($current_page === 'dashboard.php') ? 'active' : ''; ?>"><?php echo adminIcon('dashboard'); ?> Dashboard</a></li>
            <li><a href="products.php" class="<?php echo ($current_page === 'products.php') ? 'active' : ''; ?>"><?php echo adminIcon('products'); ?> Products</a></li>
            <li><a href="add_product.php" class="<?php echo ($current_page === 'add_product.php') ? 'active' : ''; ?>"><?php echo adminIcon('add'); ?> Add Product</a></li>
            <li><a href="stock_report.php" class="<?php echo ($current_page === 'stock_report.php') ? 'active' : ''; ?>"><?php echo adminIcon('stock'); ?> Stock Report</a></li>
            <li><a href="stock_in.php" class="<?php echo ($current_page === 'stock_in.php') ? 'active' : ''; ?>"><?php echo adminIcon('stock_in'); ?> Stock In</a></li>
            <li><a href="stock_out.php" class="<?php echo ($current_page === 'stock_out.php') ? 'active' : ''; ?>"><?php echo adminIcon('stock_out'); ?> Stock Out</a></li>
            <li><a href="../index.php"><?php echo adminIcon('store'); ?> View Website</a></li>
            <li class="sidebar-divider"></li>
            <li><a href="logout.php"><?php echo adminIcon('logout'); ?> Logout</a></li>
        </ul>
    </aside>

    <main class="admin-content">
        <div class="admin-topbar">
            <div class="admin-topbar-left">
                <button class="admin-mobile-toggle" type="button" onclick="toggleAdminSidebar(true)" aria-label="Open admin menu"><span></span><span></span><span></span></button>
                <div>
                    <h1><?php echo isset($page_title) ? $page_title : 'Dashboard'; ?></h1>
                    <p class="admin-topbar-subtitle">Manage store products, inventory and reports.</p>
                </div>
            </div>
            <div class="admin-user">
                <span>Welcome, <?php echo htmlspecialchars($adminDisplayName); ?></span>
                <span class="admin-role-badge <?php echo $isBossHeader ? 'boss' : ''; ?>"><?php echo htmlspecialchars($roleLabel); ?></span>
            </div>
        </div>
