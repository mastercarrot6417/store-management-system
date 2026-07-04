<?php
session_start();
$is_customer_logged_in = isset($_SESSION['customer_id']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms & Conditions — My Dream Bike</title>
    <link rel="stylesheet" href="../assets/css/style.css?v=31">
    <link rel="stylesheet" href="../assets/css/legal_pages.css?v=31">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body class="public-page legal-page legal-terms-page">
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
        <h1>Terms &amp; Conditions</h1>
        <div class="legal-breadcrumb">
            <a href="../index.php">Home</a>
            <span>›</span>
            <span>Terms &amp; Conditions</span>
        </div>
    </div>
</header>

<main class="legal-formal-shell">
    <section class="legal-formal-intro">
        <p class="legal-kicker">Using Our Website</p>
        <h2>Please read these Terms and Conditions carefully before using the My Dream Bike website.</h2>
        <p>By accessing or using this website, you agree to comply with these Terms and Conditions.</p>
    </section>

    <div class="legal-document-panel">
        <section class="legal-formal-section">
            <div class="legal-section-number">01</div>
            <div>
                <h3>Use of Website</h3>
                <p>You agree to use this website only for lawful purposes and in a manner that does not damage, interrupt, or interfere with the website’s operation or security. You must not misuse the website, attempt unauthorized access, upload harmful content, or use the website for fraudulent activities.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">02</div>
            <div>
                <h3>Product Information</h3>
                <p>We aim to provide accurate product information, including product names, categories, images, descriptions, and prices. However, product images are for illustration purposes only, and actual product appearance, color, size, or details may vary.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">03</div>
            <div>
                <h3>Pricing and Availability</h3>
                <p>All prices displayed on the website are subject to change. Product availability may vary depending on stock levels. If any information is incorrect due to error, system issue, or outdated data, we reserve the right to correct such information.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">04</div>
            <div>
                <h3>Customer Accounts</h3>
                <p>Customers may create an account or log in using available login methods, including Google Login where applicable. You are responsible for maintaining the confidentiality of your account login details and for all activities under your account.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">05</div>
            <div>
                <h3>Guest Browsing</h3>
                <p>Customers may browse the website as guests without creating an account. Certain features may require account login.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">06</div>
            <div>
                <h3>Third-Party Services</h3>
                <p>Our website may include third-party services such as Google Maps or Google Login. These services are provided by third parties and may be subject to their own terms and policies. We are not responsible for the availability, content, or practices of third-party services.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">07</div>
            <div>
                <h3>Intellectual Property</h3>
                <p>All website content, including text, layout, images, logos, graphics, and design elements, belongs to My Dream Bike or the respective rights holders, unless otherwise stated. You may not copy, reproduce, distribute, or use website content for commercial purposes without prior written permission.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">08</div>
            <div>
                <h3>Limitation of Liability</h3>
                <p>To the maximum extent permitted by law, My Dream Bike shall not be liable for any loss, damage, or inconvenience arising from your use of the website, reliance on website information, technical interruptions, or third-party service issues.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">09</div>
            <div>
                <h3>Website Changes</h3>
                <p>We may update, modify, suspend, or discontinue any part of the website at any time without prior notice.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">10</div>
            <div>
                <h3>Privacy</h3>
                <p>Your use of this website is also subject to our Privacy Policy and Cookie Notice.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">11</div>
            <div>
                <h3>Changes to These Terms</h3>
                <p>We may update these Terms and Conditions from time to time. Any updated version will be posted on this page.</p>
            </div>
        </section>
    </div>

    <section class="legal-contact-box">
        <h3>Contact Us</h3>
        <p>For questions regarding these Terms and Conditions, please contact My Dream Bike.</p>
        <p><strong>Email:</strong> hello@mydreambike.my</p>
        <p><strong>Phone:</strong> +60 1X-XXX XXXX</p>
        <p><strong>Address:</strong> [Insert Company Address]</p>
    </section>
</main>

<?php include __DIR__ . '/../includes/public_footer.php'; ?>
<script src="../assets/js/app.js"></script>
</body>
</html>
