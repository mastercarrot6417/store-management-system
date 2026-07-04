<?php
$mobileIsLoggedIn = !empty($is_customer_logged_in);
$mobileCustomerName = trim($customer_display_name ?? '');
?>
<div class="mobile-menu-overlay" id="mobileMenuOverlay" hidden></div>
<aside class="mobile-menu-drawer" id="mobileMenuDrawer" aria-hidden="true" aria-label="Mobile navigation" hidden>
    <div class="mobile-menu-top">
        <a href="index.php" class="mobile-menu-logo" aria-label="My Dream Bike home">
            <img src="company_logo/ori.logo.png" alt="My Dream Bike">
        </a>
        <button type="button" class="mobile-menu-close" onclick="closeMobileMenu()" aria-label="Close menu">&times;</button>
    </div>

    <form class="mobile-menu-search" method="GET" action="index.php">
        <span aria-hidden="true">⌕</span>
        <input type="text" name="search" placeholder="Search products...">
        <button type="submit">Search</button>
    </form>

    <div class="mobile-menu-section">
        <p class="mobile-menu-title">Main Menu</p>
        <a href="index.php" class="mobile-menu-link"><span class="mobile-link-icon">⌂</span><span>Home</span><b>›</b></a>
        <a href="index.php?category=Helmet" class="mobile-menu-link"><span class="mobile-link-icon">◒</span><span>Helmets</span><b>›</b></a>
        <a href="index.php?category=Apparel" class="mobile-menu-link"><span class="mobile-link-icon">◫</span><span>Apparel</span><b>›</b></a>
        <a href="index.php?category=Accessories" class="mobile-menu-link"><span class="mobile-link-icon">✋</span><span>Accessories</span><b>›</b></a>
        <a href="index.php#new-arrivals" class="mobile-menu-link"><span class="mobile-link-icon">✦</span><span>New Arrivals</span><em>NEW</em><b>›</b></a>
        <a href="index.php#location" class="mobile-menu-link"><span class="mobile-link-icon">⌖</span><span>Store Location</span><b>›</b></a>
    </div>

    <div class="mobile-menu-section">
        <p class="mobile-menu-title">My Account</p>
        <?php if ($mobileIsLoggedIn): ?>
            <a href="user_page.php" class="mobile-menu-link"><span class="mobile-link-icon">♙</span><span><?php echo $mobileCustomerName ? htmlspecialchars($mobileCustomerName) : 'My Account'; ?></span><b>›</b></a>
            <a href="logout.php" class="mobile-menu-link"><span class="mobile-link-icon">⇥</span><span>Log Out</span><b>›</b></a>
        <?php else: ?>
            <a href="login.php" class="mobile-menu-link"><span class="mobile-link-icon">♙</span><span>Login</span><b>›</b></a>
            <a href="signup.php" class="mobile-menu-link"><span class="mobile-link-icon">＋</span><span>Sign Up</span><b>›</b></a>
        <?php endif; ?>
        <span class="mobile-menu-link mobile-menu-disabled"><span class="mobile-link-icon">🛒</span><span>Cart</span><small>Coming Soon</small></span>
    </div>

    <div class="mobile-menu-section mobile-menu-follow">
        <p class="mobile-menu-title">Follow Us</p>
        <div class="mobile-socials">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">◎</a>
            <a href="#" aria-label="TikTok">♪</a>
        </div>
    </div>
</aside>
