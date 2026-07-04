<?php
session_start();
require_once 'config/database.php';
require_once 'config/maps_config.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    header("Location: index.php");
    exit();
}

function pg_bool($value): bool {
    return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
}

$stmt = $conn->prepare("SELECT p.*, COALESCE(SUM(ps.quantity), 0) as total_quantity
                        FROM products p
                        LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
                        WHERE p.id = ?
                        GROUP BY p.id");
$stmt->execute([$id]);
$product = $stmt->fetch();

if (!$product) {
    header("Location: index.php");
    exit();
}

$product_is_in_stock = ($product['status'] === 'ACTIVE' && (int)($product['total_quantity'] ?? 0) > 0);

// Size options are loaded after colours are known so the product page can show stock by product + colour + size.
$available_sizes = [];
$all_size_labels = [];
$sizes_by_color = [];
$first_in_stock_size = null;

// Load colors and images using the current normalized schema
$color_stmt = $conn->prepare("
    SELECT id, color_name, color_code, is_default
    FROM product_colors
    WHERE product_id = ?
    ORDER BY is_default DESC, id ASC
");
$color_stmt->execute([$id]);
$colors = $color_stmt->fetchAll();

$image_stmt = $conn->prepare("
    SELECT pi.id, pi.color_id, pi.image_path, pi.sort_order, pi.is_main,
           pc.color_name, pc.color_code
    FROM product_images pi
    LEFT JOIN product_colors pc ON pi.color_id = pc.id
    WHERE pi.product_id = ?
    ORDER BY COALESCE(pc.is_default, FALSE) DESC, COALESCE(pi.is_main, FALSE) DESC, pi.sort_order ASC, pi.id ASC
");
$image_stmt->execute([$id]);
$product_images = $image_stmt->fetchAll();

// Group images by color
$images_by_color = [];
foreach ($product_images as $img) {
    $key = $img['color_id'] !== null ? (string)$img['color_id'] : 'default';
    if (!isset($images_by_color[$key])) {
        $images_by_color[$key] = [];
    }
    $images_by_color[$key][] = $img;
}

// Decide default color
$default_color = null;
if (!empty($colors)) {
    foreach ($colors as $c) {
        if (pg_bool($c['is_default'])) {
            $default_color = $c;
            break;
        }
    }
    if (!$default_color) {
        $default_color = $colors[0];
    }
}

$default_color_key = $default_color ? (string)$default_color['id'] : 'default';
$current_color_images = $images_by_color[$default_color_key] ?? [];

$main_image_src = '';
$main_image_alt = $product['name'];

if (!empty($current_color_images)) {
    $main_image_src = $current_color_images[0]['image_path'];
    $main_image_alt = $current_color_images[0]['color_name'] ?: $product['name'];
} elseif (!empty($product['image'])) {
    $main_image_src = $product['image'];
}

// Load all sizes by colour. Each colour can have its own quantity for the same size.
$sizes_stmt = $conn->prepare("
    SELECT color_id, TRIM(size) AS size, COALESCE(quantity, 0) AS quantity
    FROM product_sizes
    WHERE product_id = ? AND NULLIF(TRIM(size), '') IS NOT NULL
    ORDER BY
        CASE UPPER(TRIM(size))
            WHEN 'XS' THEN 1
            WHEN 'S' THEN 2
            WHEN 'M' THEN 3
            WHEN 'L' THEN 4
            WHEN 'XL' THEN 5
            WHEN 'XXL' THEN 6
            WHEN 'XXXL' THEN 7
            WHEN 'FREE SIZE' THEN 8
            ELSE 99
        END,
        size ASC
");
$sizes_stmt->execute([$id]);
while ($row = $sizes_stmt->fetch()) {
    $size_label = trim((string)$row['size']);
    $size_quantity = (int)$row['quantity'];

    if ($size_label === '') {
        continue;
    }

    $color_key = $row['color_id'] !== null ? (string)$row['color_id'] : 'default';
    if (!isset($sizes_by_color[$color_key])) {
        $sizes_by_color[$color_key] = [];
    }

    $sizes_by_color[$color_key][] = [
        'label' => $size_label,
        'quantity' => $size_quantity,
        'is_available' => $size_quantity > 0
    ];

    $all_size_labels[$size_label] = $size_label;
}

$available_sizes = $default_color ? ($sizes_by_color[$default_color_key] ?? []) : ($sizes_by_color['default'] ?? []);
foreach ($available_sizes as $sizeRow) {
    if ($first_in_stock_size === null && !empty($sizeRow['is_available'])) {
        $first_in_stock_size = $sizeRow['label'];
    }
}
$selected_size = $first_in_stock_size ?? '—';
$selected_color_name = $default_color['color_name'] ?? 'Default';
if (empty($available_sizes) && !empty($colors)) {
    $initial_size_message = 'No available sizes for this colour. Please select another colour or contact us for availability.';
} elseif (!empty($available_sizes) && $first_in_stock_size === null) {
    $initial_size_message = 'This colour is currently out of stock.';
} elseif (!empty($available_sizes)) {
    $initial_size_message = 'Select an available size for this colour.';
} else {
    $initial_size_message = 'No size information is available for this product yet.';
}

$displayImageSql = "COALESCE(
    (SELECT pi.image_path
     FROM product_images pi
     INNER JOIN product_colors pc ON pc.id = pi.color_id
     WHERE pi.product_id = p.id
     ORDER BY pc.is_default DESC, pi.is_main DESC, pi.sort_order ASC, pi.id ASC
     LIMIT 1),
    NULLIF(p.image, '')
)";

$discover_more = [];
$selected_ids = [$id];

if (!empty($product['sub_category'])) {
    $sameSubSql = "SELECT p.*, COALESCE(SUM(ps.quantity), 0) AS total_quantity, {$displayImageSql} AS display_image
                   FROM products p
                   LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
                   WHERE p.id != ? AND p.status = 'ACTIVE' AND p.category = ? AND p.sub_category = ?
                   GROUP BY p.id
                   ORDER BY p.created_at DESC
                   LIMIT 6";
    $sameSubStmt = $conn->prepare($sameSubSql);
    $sameSubStmt->execute([$id, $product['category'], $product['sub_category']]);
    foreach ($sameSubStmt->fetchAll() as $row) {
        $discover_more[] = $row;
        $selected_ids[] = (int)$row['id'];
    }
}

if (count($discover_more) < 6 && !empty($product['category'])) {
    $placeholders = implode(',', array_fill(0, count($selected_ids), '?'));
    $sameCategorySql = "SELECT p.*, COALESCE(SUM(ps.quantity), 0) AS total_quantity, {$displayImageSql} AS display_image
                        FROM products p
                        LEFT JOIN product_sizes ps ON p.id = ps.product_id AND ps.color_id IS NOT NULL
                        WHERE p.status = 'ACTIVE' AND p.category = ? AND p.id NOT IN ($placeholders)
                        GROUP BY p.id
                        ORDER BY p.created_at DESC
                        LIMIT " . (6 - count($discover_more));
    $sameCategoryStmt = $conn->prepare($sameCategorySql);
    $sameCategoryStmt->execute(array_merge([$product['category']], $selected_ids));
    foreach ($sameCategoryStmt->fetchAll() as $row) {
        $discover_more[] = $row;
    }
}
$is_customer_logged_in = isset($_SESSION['customer_id']);
$customer_display_name = $_SESSION['customer_name'] ?? '';
$product_nav_category = $product['category'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="<?php echo htmlspecialchars($product['name']); ?> - <?php echo htmlspecialchars($product['description']); ?>">
    <title><?php echo htmlspecialchars($product['name']); ?> - My Dream Bike</title>
    <link rel="stylesheet" href="assets/css/style.css?v=51">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        .variant-box {
            margin-top: 20px;
            padding: 18px;
            background: #f8f9fa;
            border: 1px solid #eee;
            border-radius: 12px;
        }
        .variant-title {
            font-size: 14px;
            font-weight: 700;
            color: #555;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: .5px;
        }
        .simple-color-row, .simple-size-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 16px;
        }
        .simple-color-dot {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 2px solid #d8d8d8;
            cursor: pointer;
            padding: 0;
            outline: none;
            background: var(--dot-color, #ccc);
        }
        .simple-color-dot.active {
            border-color: #1a1a2e;
            box-shadow: 0 0 0 3px rgba(233,69,96,.12);
        }
        .simple-size-btn {
            border: 1px solid #ddd;
            background: #fff;
            color: #333;
            border-radius: 8px;
            padding: 8px 14px;
            font-weight: 600;
            cursor: pointer;
        }
        .simple-size-btn.active {
            background: #1a1a2e;
            color: #fff;
            border-color: #1a1a2e;
        }
        .simple-size-btn:disabled {
            opacity: .45;
            cursor: not-allowed;
            background: #f1f1f1;
        }
        .thumb-strip {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }
        .thumb-strip img {
            width: 68px;
            height: 68px;
            object-fit: cover;
            border-radius: 8px;
            border: 2px solid #ddd;
            cursor: pointer;
        }
        .thumb-strip img.active {
            border-color: #1a1a2e;
        }
        .selection-note {
            color: #666;
            font-size: 14px;
            margin-top: 8px;
        }
        .size-availability-message {
            grid-column: 1 / -1;
            margin-top: -6px;
            padding: 12px 14px;
            border-radius: 12px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            color: #4b5563;
            font-size: 14px;
            font-weight: 600;
        }
        .size-availability-message.warning {
            background: #fff7ed;
            border-color: #fed7aa;
            color: #9a3412;
        }
        .size-availability-message.danger {
            background: #fef2f2;
            border-color: #fecaca;
            color: #991b1b;
        }
        .image-nav {
            margin-top: 12px;
            display: flex;
            gap: 10px;
        }
        .image-nav button {
            border: 1px solid #ddd;
            background: #fff;
            color: #333;
            border-radius: 8px;
            padding: 8px 14px;
            cursor: pointer;
            font-weight: 600;
        }
        .image-nav button:hover {
            background: #f5f5f5;
        }

        .discover-more-section {
            max-width: 1400px;
            margin: 24px auto 70px;
            padding: 0 20px;
        }
        .discover-more-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 24px;
        }
        .discover-more-title {
            font-size: clamp(34px, 4vw, 56px);
            line-height: .95;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin: 0;
            color: #0f172a;
            font-weight: 800;
        }
        .discover-more-sub {
            margin: 8px 0 0;
            color: #6b7280;
            font-size: 15px;
        }
        .discover-arrow-wrap {
            display: flex;
            gap: 10px;
            flex-shrink: 0;
        }
        .discover-arrow {
            width: 46px;
            height: 46px;
            border: 1px solid #e5e7eb;
            border-radius: 999px;
            background: #fff;
            color: #111827;
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(15, 23, 42, .08);
        }
        .discover-arrow:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 14px 30px rgba(15, 23, 42, .12);
        }
        .discover-arrow:disabled {
            opacity: .45;
            cursor: not-allowed;
            box-shadow: none;
        }
        .discover-track {
            display: grid;
            grid-auto-flow: column;
            /* Show 4 cards on desktop; products 5 and 6 stay scrollable with the arrows */
            grid-auto-columns: calc((100% - 66px) / 4);
            gap: 22px;
            overflow-x: auto;
            scroll-behavior: smooth;
            scrollbar-width: none;
            padding-bottom: 8px;
            overscroll-behavior-inline: contain;
        }
        .discover-track::-webkit-scrollbar { display: none; }
        .discover-card {
            display: block;
            text-decoration: none;
            color: inherit;
            min-width: 0;
        }
        .discover-card-image-wrap {
            background: #f3f4f6;
            border-radius: 16px;
            overflow: hidden;
            aspect-ratio: 1 / 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .discover-card-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }
        .discover-card-no-image {
            color: #9ca3af;
            font-weight: 600;
        }
        .discover-card-body {
            padding: 16px 2px 0;
        }
        .discover-card-name {
            margin: 0 0 10px;
            font-size: 18px;
            line-height: 1.15;
            text-transform: uppercase;
            font-weight: 800;
            color: #111827;
        }
        .discover-card-price {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
        }
        @media (max-width: 1200px) {
            .discover-track { grid-auto-columns: calc((100% - 44px) / 3); }
        }
        @media (max-width: 900px) {
            .discover-track { grid-auto-columns: calc((100% - 22px) / 2); }
        }
        @media (max-width: 640px) {
            .discover-more-header { align-items: flex-start; }
            .discover-more-title { font-size: 32px; }
            .discover-track { grid-auto-columns: 76%; gap: 16px; }
            .discover-arrow { width: 42px; height: 42px; }
        }


        /* ---- Product detail redesign preview implementation ---- */
        body.public-page.product-detail-page,
        body.product-detail-page {
            background: #f5f6f8 !important;
            color: #111827;
        }
        body.product-detail-page .container,
        body.public-page.product-detail-page .container {
            max-width: 1440px;
            padding: 42px 24px 18px;
            background: transparent !important;
        }
        .product-detail {
            max-width: 1280px;
            margin: 0 auto;
            grid-template-columns: minmax(0, 1.08fr) minmax(420px, .92fr);
            gap: 44px;
            background: #ffffff !important;
            border: 1px solid #e7e9ee;
            border-radius: 22px;
            padding: 34px;
            box-shadow: 0 24px 70px rgba(15, 23, 42, .10);
        }
        .product-gallery-panel {
            min-width: 0;
        }
        .product-gallery-panel .detail-image,
        .product-detail .detail-image {
            width: 100%;
            height: clamp(360px, 42vw, 560px);
            object-fit: contain;
            background: linear-gradient(145deg, #ffffff 0%, #f7f8fb 100%);
            border: 1px solid #e9ebef;
            border-radius: 18px;
            padding: 22px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.85);
        }
        .product-gallery-panel .thumb-strip {
            gap: 14px;
            margin-top: 18px;
            align-items: center;
        }
        .product-gallery-panel .thumb-strip img {
            width: 86px;
            height: 86px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            background: #fff;
            padding: 4px;
            box-shadow: 0 8px 20px rgba(15, 23, 42, .06);
            transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }
        .product-gallery-panel .thumb-strip img:hover,
        .product-gallery-panel .thumb-strip img.active {
            border-color: #ff7a00;
            box-shadow: 0 12px 24px rgba(255, 122, 0, .16);
            transform: translateY(-1px);
        }
        .product-gallery-panel .image-nav {
            margin-top: 16px;
        }
        .product-gallery-panel .image-nav button {
            border-radius: 999px;
            border-color: #e5e7eb;
            background: #fff;
            padding: 10px 18px;
            color: #111827;
            box-shadow: 0 8px 20px rgba(15,23,42,.06);
        }
        .detail-info {
            min-width: 0;
            padding: 10px 2px 4px;
        }
        .product-detail .detail-info h1 {
            font-size: clamp(32px, 3vw, 46px);
            line-height: 1.05;
            color: #111827;
            margin: 0 0 16px;
            letter-spacing: -.02em;
        }
        .product-detail .detail-info .detail-price {
            font-family: inherit;
            font-size: clamp(30px, 3vw, 42px);
            line-height: 1.05;
            color: #ff7a00;
            font-weight: 800;
            margin-bottom: 18px;
        }
        .product-detail .badge {
            padding: 8px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
        }
        .product-detail .badge-success {
            background: #dcfce7;
            color: #15803d;
        }
        .product-detail .badge-danger {
            background: #fee2e2;
            color: #b91c1c;
        }
        .product-detail .detail-meta {
            margin: 24px 0 22px;
            border-top: 1px solid #e5e7eb;
        }
        .product-detail .detail-info .detail-meta p {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 18px;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 15px;
        }
        .product-detail .detail-info .detail-meta p strong {
            width: auto;
            color: #111827;
            font-weight: 800;
        }
        .detail-info h3.mt-20 {
            font-size: 20px;
            color: #111827;
            margin-top: 22px !important;
        }
        .variant-box {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 18px 28px;
            margin-top: 22px;
            padding: 22px;
            background: #fbfbfc;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
        }
        .variant-title {
            color: #111827;
            font-size: 14px;
            letter-spacing: .02em;
        }
        .simple-color-dot {
            width: 34px;
            height: 34px;
            border: 2px solid #fff;
            box-shadow: 0 0 0 1px #d1d5db;
        }
        .simple-color-dot.active {
            border-color: #fff;
            box-shadow: 0 0 0 3px #ff4d00;
        }
        .simple-size-btn {
            min-width: 48px;
            border-radius: 9px;
            padding: 10px 16px;
            color: #111827;
            border-color: #e5e7eb;
        }
        .simple-size-btn.active {
            background: #111827;
            border-color: #111827;
        }
        .selection-note {
            grid-column: 1 / -1;
            margin-top: 0;
            color: #6b7280;
        }
        .btn-back {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: #ffffff;
            color: #111827 !important;
            border: 1px solid #d7dbe2;
            border-radius: 12px;
            padding: 14px 26px;
            min-width: 200px;
            box-shadow: 0 10px 22px rgba(15,23,42,.06);
        }
        .btn-back:hover {
            background: #111827;
            color: #ffffff !important;
        }

        .discover-more-section {
            max-width: 1280px;
            margin: 28px auto 80px;
            padding: 0 24px;
        }
        .discover-more-title {
            font-family: 'Barlow', sans-serif;
            font-size: clamp(24px, 2vw, 34px);
            text-transform: none;
            letter-spacing: -.02em;
            color: #111827;
        }
        .discover-more-sub {
            display: none;
        }
        .discover-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, .08);
            transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .discover-card:hover {
            transform: translateY(-5px);
            border-color: rgba(255, 122, 0, .35);
            box-shadow: 0 8px 25px rgba(0, 0, 0, .12);
        }
        .discover-card-image-wrap {
            aspect-ratio: 1.28 / 1;
            border-radius: 0;
            margin: 0;
            background: #ffffff;
            border-bottom: 1px solid #eef0f4;
        }
        .discover-card-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            padding: 18px;
            transition: transform .25s ease;
            background: #ffffff;
        }
        .discover-card:hover .discover-card-image {
            transform: scale(1.03);
        }
        .discover-card-body {
            padding: 18px;
            background: #ffffff;
        }
        .discover-card-label {
            color: #ff7a00;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 6px;
        }
        .discover-card-name {
            font-family: inherit;
            margin: 0 0 8px;
            font-size: 17px;
            line-height: 1.25;
            text-transform: none;
            color: #1d1f22;
            font-weight: 700;
            letter-spacing: 0;
        }
        .discover-card-price {
            font-family: inherit;
            font-size: 20px;
            line-height: 1.2;
            font-weight: 700;
            color: #ff7a00;
        }
        .discover-card-no-image {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            color: #9ca3af;
            font-weight: 700;
            background: #ffffff;
        }
        @media (max-width: 980px) {
            .product-detail {
                grid-template-columns: 1fr;
                gap: 28px;
            }
            .product-gallery-panel .detail-image,
            .product-detail .detail-image {
                height: 420px;
            }
        }
        @media (max-width: 640px) {
            body.product-detail-page .container,
            body.public-page.product-detail-page .container {
                padding: 22px 12px 10px;
            }
            .product-detail {
                padding: 18px;
                border-radius: 18px;
            }
            .product-gallery-panel .detail-image,
            .product-detail .detail-image {
                height: 310px;
                padding: 12px;
            }
            .variant-box {
                grid-template-columns: 1fr;
            }
            .product-detail .detail-info .detail-meta p {
                grid-template-columns: 1fr;
                gap: 4px;
            }
            .discover-track {
                grid-auto-columns: 82%;
            }
        }


    </style>
</head>
<body class="public-page product-detail-page">

<nav class="navbar desktop-navbar">
    <a href="index.php" class="logo logo-image-link"><img src="company_logo/ori.logo.png" alt="My Dream Bike" class="site-logo-img"></a>

    <ul class="nav-links desktop-nav-links" id="navLinks">
        <li><a href="index.php" class="nav-menu-link">Home</a></li>
        <li class="nav-item has-dropdown">
            <a href="index.php?category=Helmet" class="nav-menu-link <?php echo ($product_nav_category==='Helmet') ? 'active' : ''; ?>">Helmets <span class="nav-caret">▾</span></a>
            <div class="nav-dropdown">
                <a href="index.php?category=Helmet&sub_category=Full+Face+Helmet">Full Face Helmet</a>
                <a href="index.php?category=Helmet&sub_category=Open+Face+Helmet">Open Face Helmet</a>
                <a href="index.php?category=Helmet&sub_category=Flip+Up+Helmet">Flip Up Helmet</a>
                <a href="index.php?category=Helmet&sub_category=Kid+Helmet">Kid Helmet</a>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="index.php?category=Apparel" class="nav-menu-link <?php echo ($product_nav_category==='Apparel') ? 'active' : ''; ?>">Apparel <span class="nav-caret">▾</span></a>
            <div class="nav-dropdown">
                <a href="index.php?category=Apparel&sub_category=Jackets">Jackets</a>
                <a href="index.php?category=Apparel&sub_category=Pants">Pants</a>
                <a href="index.php?category=Apparel&sub_category=Gloves">Gloves</a>
                <a href="index.php?category=Apparel&sub_category=Rain+Gear">Rain Gear</a>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="index.php?category=Accessories" class="nav-menu-link <?php echo ($product_nav_category==='Accessories') ? 'active' : ''; ?>">Accessories <span class="nav-caret">▾</span></a>
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
            <input type="text" name="search" placeholder="Search products…" value="">
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

<div class="container">
    <div class="product-detail">
        <div class="product-gallery-panel">
            <?php if ($main_image_src): ?>
                <img id="mainProductImage" src="<?php echo htmlspecialchars($main_image_src); ?>" alt="<?php echo htmlspecialchars($main_image_alt); ?>" class="detail-image">
            <?php else: ?>
                <div class="detail-image" id="mainProductImage" style="display:flex;align-items:center;justify-content:center;background:#eee;min-height:300px;border-radius:12px;color:#aaa;font-size:16px;">No Image Available</div>
            <?php endif; ?>

            <?php if (!empty($current_color_images)): ?>
                <div class="thumb-strip" id="thumbStrip">
                    <?php foreach ($current_color_images as $index => $img): ?>
                        <img
                            src="<?php echo htmlspecialchars($img['image_path']); ?>"
                            alt="<?php echo htmlspecialchars($img['color_name'] ?: $product['name']); ?>"
                            class="<?php echo $index === 0 ? 'active' : ''; ?>"
                            onclick="showImageByIndex(<?php echo $index; ?>)"
                        >
                    <?php endforeach; ?>
                </div>

                <?php if (count($current_color_images) > 1): ?>
                    <div class="image-nav">
                        <button type="button" onclick="prevImage()">← Prev</button>
                        <button type="button" onclick="nextImage()">Next →</button>
                    </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>

        <div class="detail-info">
            <h1><?php echo htmlspecialchars($product['name']); ?></h1>
            <div class="detail-price">RM <?php echo number_format($product['price'], 2); ?></div>

            <?php if ($product_is_in_stock): ?>
                <span class="badge badge-success">In Stock (<?php echo (int)$product['total_quantity']; ?> available)</span>
            <?php else: ?>
                <span class="badge badge-danger">Out of Stock</span>
                <div class="product-out-stock-message">This product is currently out of stock. You can still view the colours and sizes, but unavailable sizes cannot be selected.</div>
            <?php endif; ?>

            <div class="detail-meta mt-20">
                <p><strong>Brand:</strong> <?php echo htmlspecialchars($product['brand']); ?></p>
                <p><strong>Category:</strong> <?php echo htmlspecialchars($product['category']); ?> / <?php echo htmlspecialchars($product['sub_category']); ?></p>
                <p><strong>Available Sizes:</strong> <?php echo empty($all_size_labels) ? 'N/A' : htmlspecialchars(implode(', ', array_values($all_size_labels))); ?></p>
            </div>

            <?php if ($product['description']): ?>
                <h3 class="mt-20" style="margin-bottom:8px;">Description</h3>
                <p style="color:#666;line-height:1.8;"><?php echo nl2br(htmlspecialchars($product['description'])); ?></p>
            <?php endif; ?>

            <?php if (!empty($colors) || !empty($all_size_labels)): ?>
                <div class="variant-box">
                    <?php if (!empty($colors)): ?>
                        <div class="variant-title">Select Color</div>
                        <div class="simple-color-row">
                            <?php foreach ($colors as $index => $color): ?>
                                <button
                                    type="button"
                                    class="simple-color-dot <?php echo ($default_color && (int)$default_color['id'] === (int)$color['id']) ? 'active' : ''; ?>"
                                    style="--dot-color: <?php echo htmlspecialchars($color['color_code']); ?>;"
                                    title="<?php echo htmlspecialchars($color['color_name']); ?>"
                                    onclick="selectColor(<?php echo (int)$color['id']; ?>)">
                                </button>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($colors) || !empty($all_size_labels)): ?>
                        <div class="variant-title">Select Size</div>
                        <div class="simple-size-row" id="simpleSizeRow">
                            <?php foreach ($available_sizes as $size): ?>
                                <?php
                                    $size_label = $size['label'];
                                    $is_available = !empty($size['is_available']);
                                    $is_selected = ($is_available && $size_label === $selected_size);
                                ?>
                                <button
                                    type="button"
                                    class="simple-size-btn <?php echo $is_selected ? 'active' : ''; ?>"
                                    data-size="<?php echo htmlspecialchars($size_label, ENT_QUOTES); ?>"
                                    title="<?php echo $is_available ? htmlspecialchars($size_label, ENT_QUOTES) : htmlspecialchars($size_label . ' - Out of stock', ENT_QUOTES); ?>"
                                    <?php echo $is_available ? 'onclick="selectSize(this.dataset.size, this)"' : 'disabled aria-disabled="true"'; ?>>
                                    <?php echo htmlspecialchars($size_label); ?>
                                </button>
                            <?php endforeach; ?>
                        </div>
                        <div class="size-availability-message <?php echo ($first_in_stock_size === null && !empty($available_sizes)) ? 'danger' : (empty($available_sizes) ? 'warning' : ''); ?>" id="sizeAvailabilityMessage">
                            <?php echo htmlspecialchars($initial_size_message); ?>
                        </div>
                    <?php endif; ?>

                    <div class="selection-note">
                        Selected Size: <strong id="selectedSizeText"><?php echo htmlspecialchars($selected_size); ?></strong>
                        &nbsp; | &nbsp;
                        Selected Color: <strong id="selectedColorText"><?php echo htmlspecialchars($selected_color_name); ?></strong>
                    </div>
                </div>
            <?php endif; ?>

            <a href="index.php" class="btn-back mt-20">&larr; Back to Products</a>
        </div>
    </div>
</div>

<?php if (!empty($discover_more)): ?>
<section class="discover-more-section">
    <div class="discover-more-header">
        <div>
            <h2 class="discover-more-title">Discover More <?php echo htmlspecialchars($product['category'] === 'Helmet' ? 'Helmets' : $product['category']); ?></h2>
            <p class="discover-more-sub">More <?php echo htmlspecialchars($product['sub_category'] ?: $product['category']); ?> products you may like.</p>
        </div>
        <div class="discover-arrow-wrap">
            <button type="button" class="discover-arrow" id="discoverPrev" aria-label="Previous products">&#8249;</button>
            <button type="button" class="discover-arrow" id="discoverNext" aria-label="Next products">&#8250;</button>
        </div>
    </div>

    <div class="discover-track" id="discoverTrack">
        <?php foreach ($discover_more as $discoverIndex => $related): ?>
            <?php $relatedOutOfStock = ((int)($related['total_quantity'] ?? 0) <= 0 || $related['status'] !== 'ACTIVE'); ?>
            <a href="product_detail.php?id=<?php echo (int)$related['id']; ?>" class="discover-card <?php echo $relatedOutOfStock ? 'is-out-of-stock' : ''; ?>">
                <div class="discover-card-image-wrap">
                    <?php if (!empty($related['display_image'])): ?>
                        <img src="<?php echo htmlspecialchars($related['display_image']); ?>" alt="<?php echo htmlspecialchars($related['name']); ?>" class="discover-card-image" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'discover-card-no-image',textContent:'No Image'}));">
                    <?php else: ?>
                        <div class="discover-card-no-image">No Image</div>
                    <?php endif; ?>
                    <?php if ($relatedOutOfStock): ?><span class="product-stock-ribbon discover-stock-ribbon">Out of Stock</span><?php endif; ?>
                </div>
                <div class="discover-card-body">
                    <div class="discover-card-label"><?php echo htmlspecialchars($related['sub_category'] ?: $related['category']); ?></div>
                    <h3 class="discover-card-name"><?php echo htmlspecialchars($related['name']); ?></h3>
                    <div class="discover-card-price">RM <?php echo number_format($related['price'], 2); ?></div>
                </div>
            </a>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>

<?php include __DIR__ . '/includes/public_footer.php'; ?>

<script src="assets/js/app.js?v=50"></script>
<script>
const imagesByColor = <?php echo json_encode($images_by_color, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
const colorInfo = <?php
    $color_info = [];
    foreach ($colors as $c) {
        $color_info[(string)$c['id']] = ['name' => $c['color_name'], 'code' => $c['color_code']];
    }
    echo json_encode($color_info, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
?>;
const sizesByColor = <?php echo json_encode($sizes_by_color, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;

let currentColorId = <?php echo $default_color ? json_encode((string)$default_color['id']) : json_encode('default'); ?>;
let currentImageIndex = 0;

function renderCurrentColorSizes() {
    const row = document.getElementById('simpleSizeRow');
    const selectedSizeText = document.getElementById('selectedSizeText');
    const message = document.getElementById('sizeAvailabilityMessage');
    if (!row) return;

    const productHasColours = <?php echo !empty($colors) ? 'true' : 'false'; ?>;
    const sizes = sizesByColor[currentColorId] || (productHasColours ? [] : (sizesByColor.default || []));
    row.innerHTML = '';
    let firstAvailable = null;

    function setSizeMessage(text, type) {
        if (!message) return;
        message.textContent = text;
        message.classList.remove('warning', 'danger');
        if (type) message.classList.add(type);
    }

    sizes.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'simple-size-btn';
        btn.dataset.size = item.label;
        btn.textContent = item.label;
        btn.title = item.quantity > 0 ? `${item.label} - ${item.quantity} available` : `${item.label} - Out of stock`;

        if (item.quantity > 0) {
            if (!firstAvailable) firstAvailable = item.label;
            btn.onclick = () => selectSize(item.label, btn);
        } else {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
        }
        row.appendChild(btn);
    });

    if (firstAvailable) {
        const firstButton = row.querySelector('.simple-size-btn:not(:disabled)');
        if (firstButton) firstButton.classList.add('active');
        if (selectedSizeText) selectedSizeText.textContent = firstAvailable;
        setSizeMessage('Select an available size for this colour.', '');
    } else if (sizes.length) {
        if (selectedSizeText) selectedSizeText.textContent = 'Out of stock';
        setSizeMessage('This colour is currently out of stock.', 'danger');
    } else {
        if (selectedSizeText) selectedSizeText.textContent = 'N/A';
        setSizeMessage('No available sizes for this colour. Please select another colour or contact us for availability.', 'warning');
    }
}

function renderCurrentColorImages() {
    const images = imagesByColor[currentColorId] || [];
    const main = document.getElementById('mainProductImage');
    const strip = document.getElementById('thumbStrip');

    if (images.length > 0 && main && main.tagName === 'IMG') {
        main.src = images[currentImageIndex].image_path;
        main.alt = images[currentImageIndex].color_name || <?php echo json_encode($product['name']); ?>;
    }

    if (strip) {
        strip.innerHTML = '';
        images.forEach((img, idx) => {
            const el = document.createElement('img');
            el.src = img.image_path;
            el.alt = img.color_name || 'Product image';
            if (idx === currentImageIndex) el.classList.add('active');
            el.onclick = () => showImageByIndex(idx);
            strip.appendChild(el);
        });
    }

    if (colorInfo[currentColorId]) {
        document.getElementById('selectedColorText').textContent = colorInfo[currentColorId].name;
    }
}

function selectColor(colorId) {
    currentColorId = String(colorId);
    currentImageIndex = 0;

    document.querySelectorAll('.simple-color-dot').forEach((dot, idx) => {
        dot.classList.remove('active');
    });

    const dots = document.querySelectorAll('.simple-color-dot');
    dots.forEach(dot => {
        if (dot.getAttribute('onclick') === `selectColor(${colorId})`) {
            dot.classList.add('active');
        }
    });

    renderCurrentColorImages();
    renderCurrentColorSizes();
}

function selectSize(size, btn) {
    if (btn && btn.disabled) return;
    document.querySelectorAll('.simple-size-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('selectedSizeText').textContent = size;
}

function showImageByIndex(index) {
    currentImageIndex = index;
    renderCurrentColorImages();
}

function prevImage() {
    const images = imagesByColor[currentColorId] || [];
    if (!images.length) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    renderCurrentColorImages();
}

function nextImage() {
    const images = imagesByColor[currentColorId] || [];
    if (!images.length) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
    renderCurrentColorImages();
}


const discoverTrack = document.getElementById('discoverTrack');
const discoverPrev = document.getElementById('discoverPrev');
const discoverNext = document.getElementById('discoverNext');

function updateDiscoverArrows() {
    if (!discoverTrack || !discoverPrev || !discoverNext) return;
    const maxScroll = discoverTrack.scrollWidth - discoverTrack.clientWidth - 2;
    discoverPrev.disabled = discoverTrack.scrollLeft <= 2;
    discoverNext.disabled = discoverTrack.scrollLeft >= maxScroll;
}

function scrollDiscover(direction) {
    if (!discoverTrack) return;
    const firstCard = discoverTrack.querySelector('.discover-card');
    const styles = window.getComputedStyle(discoverTrack);
    const gap = parseFloat(styles.columnGap || styles.gap) || 22;
    const scrollAmount = firstCard ? firstCard.getBoundingClientRect().width + gap : 260;
    discoverTrack.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    window.setTimeout(updateDiscoverArrows, 300);
}

if (discoverPrev && discoverNext && discoverTrack) {
    discoverPrev.addEventListener('click', () => scrollDiscover(-1));
    discoverNext.addEventListener('click', () => scrollDiscover(1));
    discoverTrack.addEventListener('scroll', updateDiscoverArrows, { passive: true });
    window.addEventListener('load', updateDiscoverArrows);
    window.addEventListener('resize', updateDiscoverArrows);
    updateDiscoverArrows();
}

</script>
</body>
</html>
<?php $conn = null; ?>
