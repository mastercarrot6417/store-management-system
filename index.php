<?php
session_start();
require_once 'config/database.php';
require_once 'config/maps_config.php';

// Success/error messages from session
$success = isset($_SESSION['success']) ? $_SESSION['success'] : '';
$error   = isset($_SESSION['error'])   ? $_SESSION['error']   : '';
unset($_SESSION['success'], $_SESSION['error']);

function public_image_exists($path) {
    if (!$path) return false;
    $clean = ltrim($path, '/');
    return is_file(__DIR__ . '/' . $clean);
}

// Get filter parameters
$search       = isset($_GET['search'])       ? $_GET['search']       : '';
$category     = isset($_GET['category'])     ? $_GET['category']     : '';
$sub_category = isset($_GET['sub_category']) ? $_GET['sub_category'] : '';

// ---- Main product query ----
$displayImageSql = "COALESCE(
    (SELECT pi.image_path
    FROM product_images pi
    INNER JOIN product_colors pc ON pc.id = pi.color_id
    WHERE pi.product_id = p.id
    ORDER BY pc.is_default DESC, pi.is_main DESC, pi.sort_order ASC, pi.id ASC
    LIMIT 1),
    NULLIF(p.image, '')
)";

$sql   = "SELECT p.*, COALESCE(SUM(ps.quantity), 0) as total_quantity, {$displayImageSql} AS display_image
        FROM products p
        LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
        WHERE p.status != 'HIDDEN'";
$types  = "";
$params = [];

if ($search) {
    $sql   .= " AND (p.name ILIKE ? OR p.item_code ILIKE ? OR p.brand ILIKE ?)";
    $types .= "sss";
    $sp     = "%$search%";
    $params[] = $sp; $params[] = $sp; $params[] = $sp;
}
if ($category) {
    $sql   .= " AND p.category = ?";
    $types .= "s";
    $params[] = $category;
}
if ($sub_category) {
    $sql   .= " AND p.sub_category = ?";
    $types .= "s";
    $params[] = $sub_category;
}
$sql .= " GROUP BY p.id ORDER BY p.created_at DESC";

$stmt = $conn->prepare($sql);
$stmt->execute($params);
$products = $stmt->fetchAll();

// ---- Trending products (latest 4 active, in stock) ----
$trending_stmt = $conn->prepare(
    "SELECT p.*, COALESCE(SUM(ps.quantity),0) as total_quantity, {$displayImageSql} AS display_image
    FROM products p
    LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
    WHERE p.status = 'ACTIVE'
    GROUP BY p.id
    HAVING COALESCE(SUM(ps.quantity), 0) > 0
    ORDER BY p.created_at DESC
    LIMIT 4"
);
$trending_stmt->execute();
$trending = $trending_stmt->fetchAll();

// ---- New arrivals (latest 2) ----
$new_stmt = $conn->prepare(
    "SELECT p.*, COALESCE(SUM(ps.quantity),0) as total_quantity, {$displayImageSql} AS display_image
    FROM products p
    LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
    WHERE p.status = 'ACTIVE'
    GROUP BY p.id
    ORDER BY p.arrival_date DESC, p.created_at DESC
    LIMIT 2"
);
$new_stmt->execute();
$new_arrivals = $new_stmt->fetchAll();

$categories = ['Helmet', 'Apparel', 'Accessories'];
$is_filtered = ($search || $category || $sub_category);
$is_customer_logged_in = isset($_SESSION['customer_id']);
$customer_display_name = $_SESSION['customer_name'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="My Dream Bike — Premium motorcycle helmets, riding apparel, and accessories.">
    <title>My Dream Bike — Premium Helmet Store</title>
    <link rel="stylesheet" href="assets/css/style.css?v=51">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body class="public-page">

<!-- ============================================================
    NAVBAR
============================================================ -->
<nav class="navbar desktop-navbar">
    <a href="index.php" class="logo logo-image-link"><img src="company_logo/ori.logo.png" alt="My Dream Bike" class="site-logo-img"></a>

    <ul class="nav-links desktop-nav-links" id="navLinks">
        <li><a href="index.php" class="nav-menu-link <?php echo (!$category && !$search) ? 'active' : ''; ?>">Home</a></li>
        <li class="nav-item has-dropdown">
            <a href="index.php?category=Helmet" class="nav-menu-link <?php echo ($category==='Helmet') ? 'active' : ''; ?>">Helmets <span class="nav-caret">▾</span></a>
            <div class="nav-dropdown">
                <a href="index.php?category=Helmet&sub_category=Full+Face+Helmet">Full Face Helmet</a>
                <a href="index.php?category=Helmet&sub_category=Open+Face+Helmet">Open Face Helmet</a>
                <a href="index.php?category=Helmet&sub_category=Flip+Up+Helmet">Flip Up Helmet</a>
                <a href="index.php?category=Helmet&sub_category=Kid+Helmet">Kid Helmet</a>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="index.php?category=Apparel" class="nav-menu-link <?php echo ($category==='Apparel') ? 'active' : ''; ?>">Apparel <span class="nav-caret">▾</span></a>
            <div class="nav-dropdown">
                <a href="index.php?category=Apparel&sub_category=Jackets">Jackets</a>
                <a href="index.php?category=Apparel&sub_category=Pants">Pants</a>
                <a href="index.php?category=Apparel&sub_category=Gloves">Gloves</a>
                <a href="index.php?category=Apparel&sub_category=Rain+Gear">Rain Gear</a>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="index.php?category=Accessories" class="nav-menu-link <?php echo ($category==='Accessories') ? 'active' : ''; ?>">Accessories <span class="nav-caret">▾</span></a>
            <div class="nav-dropdown">
                <a href="index.php?category=Accessories&sub_category=Bag">Bags</a>
                <a href="index.php?category=Accessories&sub_category=Disc+Lock">Disc Lock</a>
                <a href="index.php?category=Accessories&sub_category=Helmet+Accessories">Helmet Accessories</a>
                <a href="index.php?category=Accessories&sub_category=Other">Other Accessories</a>
            </div>
        </li>
        <li><a href="index.php#new-arrivals" class="nav-menu-link">New Arrivals</a></li>
        <li><a href="index.php#location" class="nav-menu-link">Store Location</a></li>
    </ul>

    <div class="nav-right">
        <form class="nav-search" method="GET" action="index.php">
            <input type="text" name="search" placeholder="Search products…" value="<?php echo htmlspecialchars($search); ?>">
            <button type="submit" class="nav-search-btn" aria-label="Search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
        </form>
        <div class="nav-account-dropdown">
            <button type="button" class="nav-account-btn" aria-expanded="false" aria-label="Customer account">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Account</span>
                <b>▾</b>
            </button>
            <div class="nav-account-menu">
                <?php if ($is_customer_logged_in): ?>
                    <a href="user_page.php">My Account</a>
                    <a href="logout.php">Log Out</a>
                <?php else: ?>
                    <a href="login.php">Login</a>
                    <a href="signup.php">Sign Up</a>
                <?php endif; ?>
            </div>
        </div>
        <button type="button" class="hamburger" onclick="toggleNav()" aria-label="Open mobile menu" aria-controls="mobileMenuDrawer">
            <span></span><span></span><span></span>
        </button>
    </div>
</nav>
<?php include __DIR__ . '/includes/public_mobile_menu.php'; ?>

<?php if ($success): ?>
<div class="flash flash-success"><?php echo htmlspecialchars($success); ?></div>
<?php endif; ?>
<?php if ($error): ?>
<div class="flash flash-danger"><?php echo htmlspecialchars($error); ?></div>
<?php endif; ?>

<?php if (!$is_filtered): ?>

<!-- ============================================================
     HERO
============================================================ -->
<section class="hero-section reveal-on-scroll">
    <div class="hero-bg-accent"></div>
    <div class="hero-content">
        <div class="hero-text">
            <p class="hero-eyebrow">MY DREAM BIKE RIDING STORE</p>
            <h1 class="hero-headline">Ride With<br><span>Confidence</span></h1>
            <p class="hero-sub">Explore quality helmets, riding apparel, and accessories made to support your daily rides and long-distance journeys.</p>
            <div class="hero-actions">
                <a href="#trending" class="btn-hero-primary">Shop Helmets</a>
                <a href="index.php?category=Helmet" class="btn-hero-ghost">Browse Helmets</a>
            </div>
        </div>
        <div class="hero-visual">
            <div class="hero-img-wrapper">
                <img src="company_logo/Hero.image.webp" alt="Premium motorcycle helmet hero image">
            </div>
            <div class="hero-badge-float">
                <span class="badge-float-num">200+</span>
                <span class="badge-float-txt">Products</span>
            </div>
        </div>
    </div>
</section>

<!-- ============================================================
     MOVING BRAND LOGO STRIP
============================================================ -->
<?php
$brandLogos = [
    ['name' => 'LS2',      'file' => 'assets/brand-logos/Ls2-Logo-Vector.svg-.png'],
    ['name' => 'KYT',      'file' => 'assets/brand-logos/Logo-KYT-Helmet-3.png'],
    ['name' => 'GRACSHAW', 'file' => 'assets/brand-logos/gracshaw-logo.png'],
    ['name' => 'GRAYFOSH', 'file' => 'assets/brand-logos/grayfosh.png'],
    ['name' => 'MHR',      'file' => 'assets/brand-logos/mhr.png'],
    ['name' => 'XDOT',     'file' => 'assets/brand-logos/xdot.png'],
    ['name' => 'SGV',      'file' => 'assets/brand-logos/sgv.png'],
];
?>
<section class="brand-logo-marquee reveal-on-scroll" aria-label="Helmet brand logo banner">
    <div class="brand-logo-marquee-head">
        <span>Trusted Riding Brands</span>
    </div>
    <div class="brand-logo-marquee-window">
        <div class="brand-logo-marquee-track">
            <?php for ($set = 0; $set < 2; $set++): ?>
                <?php foreach ($brandLogos as $brand): ?>
                    <div class="brand-logo-item" title="<?php echo htmlspecialchars($brand['name']); ?>">
                        <?php
                            $brandFile = $brand['file'];
                            $brandHasImage = $brandFile && file_exists(__DIR__ . '/' . $brandFile);
                        ?>
                        <?php if ($brandHasImage): ?>
                            <img src="<?php echo htmlspecialchars($brandFile); ?>" alt="<?php echo htmlspecialchars($brand['name']); ?> logo">
                        <?php else: ?>
                            <span class="brand-logo-fallback"><?php echo htmlspecialchars($brand['name']); ?></span>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            <?php endfor; ?>
        </div>
    </div>
</section>

<!-- ============================================================
     NEW ARRIVALS
============================================================ -->
<section class="arrivals-section reveal-on-scroll" id="new-arrivals">
    <div class="section-header">
        <div>
            <p class="section-eyebrow">Just landed</p>
            <h2 class="section-title-dark">New Arrivals</h2>
        </div>
        <a href="index.php?category=Helmet" class="view-all-link">View All &rarr;</a>
    </div>
    <div class="arrivals-grid">
        <?php if (!empty($new_arrivals)):
            foreach ($new_arrivals as $p): ?>
        <?php $arrivalOutOfStock = ((int)($p['total_quantity'] ?? 0) <= 0 || $p['status'] !== 'ACTIVE'); ?>
        <a href="product_detail.php?id=<?php echo $p['id']; ?>" class="arrival-card <?php echo $arrivalOutOfStock ? 'is-out-of-stock' : ''; ?>">
            <?php if ($p['display_image'] && public_image_exists($p['display_image'])): ?>
                <img src="<?php echo htmlspecialchars($p['display_image']); ?>" alt="<?php echo htmlspecialchars($p['name']); ?>" class="arrival-img" onerror="this.style.display='none'">
            <?php else: ?>
                <div class="arrival-img arrival-no-img"></div>
            <?php endif; ?>
            <?php if ($arrivalOutOfStock): ?><span class="product-stock-ribbon">Out of Stock</span><?php endif; ?>
            <div class="arrival-overlay">
                <span class="arrival-tag <?php echo $arrivalOutOfStock ? 'arrival-tag-out' : ''; ?>"><?php echo $arrivalOutOfStock ? 'OUT OF STOCK' : 'NEW'; ?></span>
                <h3 class="arrival-name"><?php echo htmlspecialchars($p['name']); ?></h3>
                <p class="arrival-price">RM <?php echo number_format($p['price'], 2); ?></p>
                <span class="arrival-cta"><?php echo $arrivalOutOfStock ? 'View Details &rarr;' : 'View Product &rarr;'; ?></span>
            </div>
        </a>
        <?php endforeach; else: ?>
        <p style="color:#888; grid-column:1/-1;">No new arrivals yet.</p>
        <?php endif; ?>
    </div>
</section>


<!-- ============================================================
     TRENDING PRODUCTS
============================================================ -->
<section class="trending-section reveal-on-scroll" id="trending">
    <div class="section-header">
        <div>
            <p class="section-eyebrow">Hand-picked</p>
            <h2 class="section-title-dark">Featured Helmet Collection</h2>
            <p class="section-sub">Large-image product cards designed for quick browsing and a premium helmet-store feel.</p>
        </div>
        <a href="index.php?category=Helmet" class="view-all-link">View All &rarr;</a>
    </div>

    <div class="trending-grid">
        <?php if (!empty($trending)):
            foreach ($trending as $p): ?>
        <a href="product_detail.php?id=<?php echo $p['id']; ?>" class="tcard">
            <div class="tcard-img-wrap">
                <?php if ($p['display_image'] && public_image_exists($p['display_image'])): ?>
                    <img src="<?php echo htmlspecialchars($p['display_image']); ?>" alt="<?php echo htmlspecialchars($p['name']); ?>" class="tcard-img" onerror="this.parentElement.innerHTML='<div class=\'tcard-no-img\'>No Image</div>'">
                <?php else: ?>
                    <div class="tcard-no-img">No Image</div>
                <?php endif; ?>
                <span class="tcard-badge">NEW</span>
            </div>
            <div class="tcard-body">
                <p class="tcard-cat"><?php echo htmlspecialchars($p['sub_category']); ?></p>
                <h3 class="tcard-name"><?php echo htmlspecialchars($p['name']); ?></h3>
                <div class="tcard-stars">★★★★★</div>
                <p class="tcard-price">RM <?php echo number_format($p['price'], 2); ?></p>
            </div>
        </a>
        <?php endforeach; else: ?>
        <p style="color:#888; grid-column:1/-1; padding:20px 0;">No featured products are available yet.</p>
        <?php endif; ?>
    </div>
</section>



<!-- ============================================================
     SHOP BY CATEGORY
============================================================ -->
<section class="categories-section reveal-on-scroll">
    <div class="section-header">
        <div>
            <p class="section-eyebrow">Browse by type</p>
            <h2 class="section-title-dark">Shop By Riding Category</h2>
        </div>
    </div>
    <div class="cat-grid">
        <a href="index.php?category=Helmet" class="cat-item">
            <div class="cat-card cat-helmet">
                <div class="cat-img-wrap">
                    <img src="company_logo/helmet.jpg" alt="Helmet" class="cat-card-img">
                </div>
                <div class="cat-card-body">
                    <h3 class="cat-name">Helmet</h3>
                    <p class="cat-cta">Shop now &rarr;</p>
                </div>
            </div>
        </a>
        <a href="index.php?category=Apparel" class="cat-item">
            <div class="cat-card cat-apparel">
                <div class="cat-img-wrap">
                    <img src="company_logo/apparel.jpg" alt="Apparel" class="cat-card-img">
                </div>
                <div class="cat-card-body">
                    <h3 class="cat-name">Apparel</h3>
                    <p class="cat-cta">Shop now &rarr;</p>
                </div>
            </div>
        </a>
        <a href="index.php?category=Accessories" class="cat-item">
            <div class="cat-card cat-accessories">
                <div class="cat-img-wrap">
                    <img src="company_logo/accessories1.png" alt="Accessories" class="cat-card-img">
                </div>
                <div class="cat-card-body">
                    <h3 class="cat-name">Accessories</h3>
                    <p class="cat-cta">Shop now &rarr;</p>
                </div>
            </div>
        </a>
    </div>
</section>


<!-- ============================================================
     EXPERT ADVICE CTA
============================================================ -->
<!-- ============================================================
     LOCATION SECTION
============================================================ -->
<section class="company-location-section reveal-on-scroll" id="location">
    <div class="location-inner">
        <div class="location-copy">
            <p class="section-eyebrow">Visit Our Showroom</p>
            <h2 class="section-title-dark">Our Location</h2>
            <p>Come visit My Dream Bike showroom! Explore our extensive range of premium motorcycle helmets, riding gear, and accessories in person. Our friendly team is here to help you choose the best equipment for your safety and comfort.</p>
            <div class="location-details">
                <span>📍 Johor, Malaysia</span>
                <span>📞 +60 13-930 3655</span>
                <span>✉️ hello@mydreambike.my</span>
            </div>
            <a href="<?php echo htmlspecialchars(COMPANY_MAP_LINK); ?>" target="_blank" rel="noopener noreferrer" class="location-map-btn">Visit Our Store</a>
        </div>
        <div class="location-map-wrapper">
            <?php if (defined('GOOGLE_MAPS_API_KEY') && GOOGLE_MAPS_API_KEY !== 'PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE'): ?>
                <iframe
                    src="https://www.google.com/maps/embed/v1/place?key=<?php echo urlencode(GOOGLE_MAPS_API_KEY); ?>&q=<?php echo urlencode(COMPANY_MAP_QUERY); ?>"
                    style="border:0;"
                    allowfullscreen=""
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade">
                </iframe>
            <?php else: ?>
                <div class="map-placeholder-box">
                    <span>📍</span>
                    <h3>Find us in-store</h3>
                    <p>Johor, Malaysia</p>
                </div>
            <?php endif; ?>
        </div>
    </div>
</section>



<?php else: ?>

<!-- ============================================================
     FILTERED / SEARCH RESULTS VIEW
============================================================ -->
<div class="results-container">
    <div class="results-header">
        <h2>
            <?php
            if ($category) {
                echo htmlspecialchars($category);
                if ($sub_category) echo ' &rsaquo; ' . htmlspecialchars($sub_category);
            } elseif ($search) {
                echo 'Results for &ldquo;' . htmlspecialchars($search) . '&rdquo;';
            }
            ?>
        </h2>
        <a href="index.php" class="results-back">&larr; Back to Home</a>
    </div>

    <form class="filter-bar" method="GET" action="index.php">
        <input type="text" name="search" placeholder="Search products…" value="<?php echo htmlspecialchars($search); ?>">
        <select name="category" onchange="this.form.submit()">
            <option value="">All Categories</option>
            <?php foreach ($categories as $cat): ?>
            <option value="<?php echo $cat; ?>" <?php echo ($category===$cat)?'selected':''; ?>><?php echo $cat; ?></option>
            <?php endforeach; ?>
        </select>
        <button type="submit">Search</button>
    </form>

    <?php if (!empty($products)): ?>
    <div class="product-grid">
        <?php foreach ($products as $product): ?>
        <?php $productOutOfStock = ((int)($product['total_quantity'] ?? 0) <= 0 || $product['status'] !== 'ACTIVE'); ?>
        <a href="product_detail.php?id=<?php echo $product['id']; ?>" class="product-card <?php echo $productOutOfStock ? 'is-out-of-stock' : ''; ?>">
            <?php if ($product['display_image'] && public_image_exists($product['display_image'])): ?>
                <img src="<?php echo htmlspecialchars($product['display_image']); ?>" alt="<?php echo htmlspecialchars($product['name']); ?>" class="card-image" onerror="this.parentElement.innerHTML='<div class=\'card-image\' style=\'display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;\'>No Image</div>'">
            <?php else: ?>
                <div class="card-image" style="display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;background:#1e1e2e;">No Image</div>
            <?php endif; ?>
            <?php if ($productOutOfStock): ?><span class="product-stock-ribbon product-card-ribbon">Out of Stock</span><?php endif; ?>
            <div class="card-body">
                <div class="card-category"><?php echo htmlspecialchars($product['sub_category']); ?></div>
                <div class="card-title"><?php echo htmlspecialchars($product['name']); ?></div>
                <div class="card-price">RM <?php echo number_format($product['price'], 2); ?></div>
                <div class="card-meta">
                    <span><?php echo htmlspecialchars($product['brand']); ?></span>
                    <?php if ($product['status']==='ACTIVE' && $product['total_quantity']>0): ?>
                        <span class="badge badge-success">In Stock</span>
                    <?php else: ?>
                        <span class="badge badge-danger">Out of Stock</span>
                    <?php endif; ?>
                </div>
            </div>
        </a>
        <?php endforeach; ?>
    </div>
    <?php else: ?>
    <div class="no-products"><p>No products found.</p></div>
    <?php endif; ?>
</div>

<?php endif; ?>

<!-- ============================================================
     FOOTER
============================================================ -->
<?php include __DIR__ . '/includes/public_footer.php'; ?>

<script src="assets/js/app.js?v=50"></script>
</body>
</html>
<?php $conn = null; ?>