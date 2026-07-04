<?php
session_start();
$is_customer_logged_in = isset($_SESSION['customer_id']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy — My Dream Bike</title>
    <link rel="stylesheet" href="../assets/css/style.css?v=31">
    <link rel="stylesheet" href="../assets/css/legal_pages.css?v=31">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body class="public-page legal-page legal-privacy-page">
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
        <h1>Privacy Policy</h1>
        <div class="legal-breadcrumb">
            <a href="../index.php">Home</a>
            <span>›</span>
            <span>Privacy Policy</span>
        </div>
    </div>
</header>

<main class="legal-formal-shell">
    <section class="legal-formal-intro">
        <p class="legal-kicker">Your Information Matters</p>
        <h2>We collect and use personal information responsibly to support your website experience.</h2>
        <p>This Privacy Policy explains how My Dream Bike collects, uses, stores, and protects personal information when you use our website and related services.</p>
    </section>

    <div class="legal-document-panel">
        <section class="legal-formal-section">
            <div class="legal-section-number">01</div>
            <div>
                <h3>Personal Information We Collect</h3>
                <p>We may collect personal information that you voluntarily provide to us, including your full name, email address, phone number, account login details, Google account information if you use Google Login, and information submitted through contact forms, account pages, or website features.</p>
                <p>We may also collect technical information such as browser type, device information, IP address, pages visited, and website usage data.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">02</div>
            <div>
                <h3>Purpose of Collecting Information</h3>
<ul>
                    <li>To create and manage customer accounts;</li>
                    <li>To allow customer login and Google Login access;</li>
                    <li>To respond to enquiries or requests;</li>
                    <li>To improve website functionality and user experience;</li>
                    <li>To manage website security and prevent misuse;</li>
                    <li>To comply with legal, regulatory, or administrative requirements.</li>
                </ul>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">03</div>
            <div>
                <h3>Google Login and Third-Party Services</h3>
                <p>If you choose to sign in using Google Login, we may receive information from your Google account, such as your name, email address, and profile picture, depending on the permission granted by you. Our website may also use Google Maps to display store location information.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">04</div>
            <div>
                <h3>Disclosure of Personal Information</h3>
                <p>We do not sell your personal information. However, we may disclose information where necessary to website hosting providers, database or technical service providers, third-party service providers supporting website functions, legal or regulatory authorities where required, or parties involved in protecting our rights, safety, or website security.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">05</div>
            <div>
                <h3>Security of Personal Information</h3>
                <p>We take reasonable steps to protect your personal information from unauthorized access, loss, misuse, alteration, or disclosure. However, no method of internet transmission or electronic storage is completely secure, and we cannot guarantee absolute security.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">06</div>
            <div>
                <h3>Retention of Personal Information</h3>
                <p>We will retain your personal information for as long as necessary to fulfil the purposes stated in this Privacy Policy, unless a longer retention period is required or permitted by law.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">07</div>
            <div>
                <h3>Access and Correction</h3>
                <p>You may request access to, correction of, or updating of your personal information by contacting us. We may require verification of your identity before processing such requests.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">08</div>
            <div>
                <h3>Cookies</h3>
                <p>Our website uses cookies and similar technologies to support login sessions, remember preferences, and improve website performance. Please refer to our Cookie Notice for more information.</p>
            </div>
        </section>

        <section class="legal-formal-section">
            <div class="legal-section-number">09</div>
            <div>
                <h3>Changes to This Policy</h3>
                <p>We may update this Privacy Policy from time to time. Any updated version will be posted on this page.</p>
            </div>
        </section>
    </div>

    <section class="legal-contact-box">
        <h3>Contact Us</h3>
        <p>If you have any questions regarding this Privacy Policy or your personal information, please contact us.</p>
        <p><strong>Email:</strong> hello@mydreambike.my</p>
        <p><strong>Phone:</strong> +60 1X-XXX XXXX</p>
        <p><strong>Address:</strong> [Insert Company Address]</p>
    </section>
</main>

<?php include __DIR__ . '/../includes/public_footer.php'; ?>
<script src="../assets/js/app.js"></script>
</body>
</html>
