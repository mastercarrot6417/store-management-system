<?php
session_start();
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/customer_helpers.php';

if (!isset($_SESSION['customer_id'])) {
    header('Location: login.php');
    exit();
}

ensureCustomersTable($conn);

$stmt = $conn->prepare('SELECT * FROM customers WHERE id = ? LIMIT 1');
$stmt->execute([$_SESSION['customer_id']]);
$customer = $stmt->fetch();

if (!$customer) {
    header('Location: logout.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Account - My Dream Bike</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="public-page account-page">
<nav class="navbar">
    <a href="index.php" class="logo logo-image-link"><img src="company_logo/ori.logo.png" alt="My Dream Bike" class="site-logo-img"></a>
    <ul class="nav-links" id="navLinks">
        <li><a href="index.php">Home</a></li>
        <li><a href="index.php?category=Helmet">Helmets</a></li>
        <li><a href="index.php?category=Apparel">Apparel</a></li>
        <li><a href="index.php?category=Accessories">Accessories</a></li>
    </ul>
    <div class="nav-right">
        <a href="user_page.php" class="nav-admin-btn">My Account</a>
        <button class="hamburger" onclick="toggleNav()" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
</nav>

<main class="account-shell">
    <section class="account-hero reveal-on-scroll">
        <p class="section-eyebrow">Customer Account</p>
        <h1>Welcome, <?php echo htmlspecialchars($customer['full_name']); ?></h1>
        <p>Manage your customer profile and continue browsing premium helmets and riding gear.</p>
    </section>

    <section class="account-card reveal-on-scroll">
        <div class="account-avatar">
            <?php if (!empty($customer['profile_picture'])): ?>
                <img src="<?php echo htmlspecialchars($customer['profile_picture']); ?>" alt="Profile picture">
            <?php else: ?>
                <span><?php echo strtoupper(substr($customer['full_name'], 0, 1)); ?></span>
            <?php endif; ?>
        </div>
        <div class="account-info-grid">
            <div><strong>Full Name</strong><span><?php echo htmlspecialchars($customer['full_name']); ?></span></div>
            <div><strong>Email</strong><span><?php echo htmlspecialchars($customer['email']); ?></span></div>
            <div><strong>Phone</strong><span><?php echo $customer['phone'] ? htmlspecialchars($customer['phone']) : 'Not added'; ?></span></div>
            <div><strong>Login Type</strong><span><?php echo htmlspecialchars(ucfirst($customer['auth_provider'] ?? 'email')); ?></span></div>
            <div><strong>Joined</strong><span><?php echo htmlspecialchars(date('d M Y', strtotime($customer['created_at']))); ?></span></div>
        </div>
        <div class="account-actions">
            <a href="index.php" class="btn-hero-primary">Continue Shopping</a>
            <a href="logout.php" class="btn-hero-ghost account-logout-btn">Log Out</a>
        </div>
    </section>
</main>

<script src="assets/js/app.js"></script>
</body>
</html>
