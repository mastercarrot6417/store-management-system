<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';

if (!isBossAdmin()) {
    $_SESSION['error'] = 'Only boss admins can delete products.';
    header("Location: products.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $_SESSION['error'] = 'Invalid request method.';
    header("Location: products.php");
    exit();
}

// Validate CSRF token
$token = isset($_POST['csrf_token']) ? $_POST['csrf_token'] : '';
if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
    $_SESSION['error'] = 'CSRF token validation failed.';
    header("Location: products.php");
    exit();
}

$id = isset($_POST['id']) ? intval($_POST['id']) : 0;

if ($id <= 0) {
    $_SESSION['error'] = 'Invalid product ID.';
    header("Location: products.php");
    exit();
}

// Get product to delete image file
$stmt = $conn->prepare("SELECT image FROM products WHERE id = ?");
$stmt->execute([$id]);
$product = $stmt->fetch();

if (!$product) {
    $_SESSION['error'] = 'Product not found.';
    header("Location: products.php");
    exit();
}

// Delete image file if exists
if ($product['image'] && file_exists('../' . $product['image'])) {
    unlink('../' . $product['image']);
}

// Delete stock history
$stmt = $conn->prepare("DELETE FROM stock_history WHERE product_id = ?");
$stmt->execute([$id]);

// Delete product sizes
$stmt = $conn->prepare("DELETE FROM product_sizes WHERE product_id = ?");
$stmt->execute([$id]);

// Delete product
$stmt = $conn->prepare("DELETE FROM products WHERE id = ?");

if ($stmt->execute([$id])) {
    $_SESSION['success'] = 'Product deleted successfully.';
} else {
    $_SESSION['error'] = 'Failed to delete product.';
}
header("Location: products.php");

$conn = null;
exit();
?>
