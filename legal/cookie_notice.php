<?php
session_start();
$is_customer_logged_in = isset($_SESSION['customer_id']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cookie Notice — My Dream Bike</title>
    <link rel="stylesheet" href="../assets/css/style.css?v=31">
    <link rel="stylesheet" href="../assets/css/legal_pages.css?v=31">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body class="public-page legal-page legal-cookie-page">
<nav class="navbar">
    <a href="../index.php" class="logo logo-image-link"><img src="../company_logo/ori.logo.png" alt="My Dream Bike" class="site-logo-img"></a>
    <ul class="nav-links">
        <li><a href="../index.php">Home</a></li>
        <li><a href="../index.php?category=Helmet">Helmets</a></li>
        <li><a href="../index.php?category=Apparel">Apparel</a></li>
        <li><a href="../index.php?category=Accessories">Accessories</a></li>
    </ul>
    <div class="nav-right">
        <?php if ($is_customer_logged_in): ?>
            <a href="../user_page.php" class="nav-admin-btn">My Account</a>
        <?php else: ?>
            <a href="../login.php" class="nav-admin-btn">Login</a>
        <?php endif; ?>
    </div>
</nav>

<header class="legal-hero-section">
    <div class="legal-hero-overlay"></div>
    <div class="legal-hero-content">
        <p class="legal-page-label">Website Notice</p>
        <h1>Cookie Notice</h1>
        <div class="legal-breadcrumb">
            <a href="../index.php">Home</a>
            <span>›</span>
            <span>Cookie Notice</span>
        </div>
    </div>
</header>

<main class="legal-formal-shell">
    <section class="legal-formal-intro">
        <p class="legal-kicker">How We Use Cookies</p>
        <h2>Cookies help us keep the website secure, functional, and easier to use.</h2>
        <p>This Cookie Notice explains how My Dream Bike uses cookies and similar technologies when you visit or interact with our website.</p>
    </section>

    <div class="legal-document-panel">
        <section class="legal-formal-section">
            <div class="legal-section-number">01</div>
            <div>
                <h3>What Are Cookies?</h3>
                <p>Cookies are small text files placed on your device when you visit a website. They help the website function properly, remember preferences, support login features, and improve the browsing experience.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">02</div>
            <div>
                <h3>How We Use Cookies</h3>
                <p>My Dream Bike uses cookies to maintain website operation, support customer login sessions, remember cookie preferences, improve website performance, and support third-party features such as Google Maps and Google Login.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">03</div>
            <div>
                <h3>Types of Cookies We Use</h3>
                <p>Necessary cookies are required for the website to function properly and may be used for login sessions, security, and basic website operations. Preference cookies help remember your choices, such as whether you have accepted the cookie notice. Third-party cookies may be used by external services such as Google Maps or Google Login according to their respective policies.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">04</div>
            <div>
                <h3>Managing Cookies</h3>
                <p>You may control or delete cookies through your browser settings. However, disabling certain cookies may affect website functionality, including login features, account sessions, and map display.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">05</div>
            <div>
                <h3>Third-Party Services</h3>
                <p>Our website may include third-party services that support account login, location display, or other website functions. These services may process information according to their own privacy and cookie policies.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">06</div>
            <div>
                <h3>Changes to This Notice</h3>
                <p>We may update this Cookie Notice from time to time to reflect changes in website features, technology, or business practices. Any updated version will be posted on this page.</p>
            </div>
        </section>
    </div>

    <section class="legal-contact-box">
        <h3>Contact Us</h3>
        <p>For questions regarding this Cookie Notice, please contact My Dream Bike.</p>
        <p><strong>Email:</strong> hello@mydreambike.my</p>
        <p><strong>Phone:</strong> +60 1X-XXX XXXX</p>
        <p><strong>Address:</strong> [Insert Company Address]</p>
    </section>
</main>

<?php include __DIR__ . '/../includes/public_footer.php'; ?>
<script src="../assets/js/app.js"></script>
</body>
</html>
