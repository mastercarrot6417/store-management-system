<?php
if (!defined('COMPANY_MAP_LINK')) {
    $mapsConfig = __DIR__ . '/../config/maps_config.php';
    if (file_exists($mapsConfig)) {
        require_once $mapsConfig;
    }
}

$footerMapLink = defined('COMPANY_MAP_LINK') ? COMPANY_MAP_LINK : 'https://www.google.com/maps/search/?api=1&query=My%20Dream%20Bike';
$footerYear = date('Y');

function public_base_path() {
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $dir = trim(dirname($script), '/');
    if ($dir === '') {
        return '';
    }
    $parts = explode('/', $dir);
    $last = end($parts);
    return ($last === 'legal') ? '../' : '';
}

function public_url($path) {
    return public_base_path() . ltrim($path, '/');
}

function footer_category_url($category, $subcategory = '') {
    $params = ['category' => $category];
    if ($subcategory !== '') {
        $params['sub_category'] = $subcategory;
    }
    return public_url('index.php') . '?' . http_build_query($params);
}
?>
<footer class="site-footer premium-footer brand-directory-footer">
    <div class="footer-inner footer-directory-grid">
        <div class="footer-brand-panel">
            <a href="<?php echo htmlspecialchars(public_url('index.php')); ?>" class="footer-logo footer-logo-image" aria-label="My Dream Bike home">
                <img src="<?php echo htmlspecialchars(public_url('company_logo/ori.logo.png')); ?>" alt="My Dream Bike" class="footer-logo-img">
            </a>

            <div class="footer-socials" aria-label="Social media links">
                <a href="#" aria-label="Facebook">f</a>
                <a href="#" aria-label="Instagram">◎</a>
                <a href="#" aria-label="YouTube">▶</a>
                <a href="#" aria-label="TikTok">♪</a>
            </div>
        </div>

        <div class="footer-links">
            <h4>Helmets</h4>
            <ul>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Helmet', 'Full Face Helmet')); ?>">Full Face Helmet</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Helmet', 'Open Face Helmet')); ?>">Open Face Helmet</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Helmet', 'Flip Up Helmet')); ?>">Flip Up Helmet</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Helmet', 'Kid Helmet')); ?>">Kid Helmet</a></li>
            </ul>
        </div>

        <div class="footer-links">
            <h4>Apparel</h4>
            <ul>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Apparel', 'Jackets')); ?>">Jackets</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Apparel', 'Pants')); ?>">Pants</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Apparel', 'Gloves')); ?>">Gloves</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Apparel', 'Rain Gear')); ?>">Rain Gear</a></li>
            </ul>
        </div>

        <div class="footer-links">
            <h4>Accessories</h4>
            <ul>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Accessories', 'Bag')); ?>">Bags</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Accessories', 'Disc Lock')); ?>">Disc Lock</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Accessories', 'Helmet Accessories')); ?>">Helmet Accessories</a></li>
                <li><a href="<?php echo htmlspecialchars(footer_category_url('Accessories', 'Other')); ?>">Other Accessories</a></li>
            </ul>
        </div>

        <div class="footer-links">
            <h4>Support</h4>
            <ul>
                <li><a href="mailto:hello@mydreambike.my">Contact</a></li>
                <li><a href="<?php echo htmlspecialchars($footerMapLink); ?>" target="_blank" rel="noopener">Store Location</a></li>
                <li><a href="<?php echo htmlspecialchars(public_url('legal/privacy_policy.php')); ?>">Privacy Policy</a></li>
                <li><a href="<?php echo htmlspecialchars(public_url('legal/terms_conditions.php')); ?>">Terms &amp; Conditions</a></li>
                <li><a href="<?php echo htmlspecialchars(public_url('legal/cookie_notice.php')); ?>">Cookie Notice</a></li>
            </ul>
        </div>
    </div>

    <div class="footer-legal-row">
        <a href="<?php echo htmlspecialchars(public_url('legal/cookie_notice.php')); ?>">Cookie Notice</a>
        <span>|</span>
        <a href="<?php echo htmlspecialchars(public_url('legal/privacy_policy.php')); ?>">Privacy Policy</a>
        <span>|</span>
        <a href="<?php echo htmlspecialchars(public_url('legal/terms_conditions.php')); ?>">Terms &amp; Conditions</a>
    </div>

    <div class="footer-bottom footer-disclaimer">
        <p>&copy; <?php echo $footerYear; ?> <span>My Dream Bike</span>. All rights reserved.</p>
        <p class="footer-note">Product images are for illustration purposes only. Actual product details, stock, and pricing may vary.</p>
    </div>
</footer>

<div class="cookie-banner" id="cookieBanner" hidden>
    <div class="cookie-copy">
        <strong>Cookies on My Dream Bike</strong>
        <p>We use necessary cookies to keep you logged in and support website features such as Google Maps.</p>
    </div>
    <div class="cookie-actions">
        <a href="<?php echo htmlspecialchars(public_url('legal/cookie_notice.php')); ?>">Learn More</a>
        <button type="button" id="cookieAcceptBtn">Accept</button>
    </div>
</div>
