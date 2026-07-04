<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
ensureBossPricingSchema($conn);
$isBoss = isBossAdmin();

$page_title = 'Manage Products';

// Get filter parameters
$search = isset($_GET['search']) ? $_GET['search'] : '';
$category = isset($_GET['category']) ? $_GET['category'] : '';
$subcategory = isset($_GET['subcategory']) ? $_GET['subcategory'] : '';

// Build query
$displayImageSql = "COALESCE(
        (SELECT pi.image_path
         FROM product_images pi
         INNER JOIN product_colors pc ON pc.id = pi.color_id
         WHERE pi.product_id = p.id
         ORDER BY pc.is_default DESC, pi.is_main DESC, pi.sort_order ASC, pi.id ASC
         LIMIT 1),
        NULLIF(p.image, '')
    )";

$sql = "SELECT p.*, 
        COALESCE(SUM(ps.quantity), 0) as total_quantity,
        STRING_AGG(DISTINCT ps.size::text, ', ') as all_sizes,
        {$displayImageSql} as display_image
        FROM products p 
        LEFT JOIN product_sizes ps ON p.id = ps.product_id 
        WHERE 1=1";

$types = "";
$params = [];

if ($search) {
    $sql .= " AND (p.name ILIKE ? OR p.item_code ILIKE ? OR p.brand ILIKE ? OR p.category ILIKE ? OR p.sub_category ILIKE ?)";
    $types .= "sss";
    $search_param = "%$search%";
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
}
if ($category) {
    $sql .= " AND p.category = ?";
    $types .= "s";
    $params[] = $category;
}
if ($subcategory) {
    $sql .= " AND p.sub_category = ?";
    $types .= "s";
    $params[] = $subcategory;
}
$sql .= " GROUP BY p.id ORDER BY p.created_at DESC";

$stmt = $conn->prepare($sql);
$stmt->execute($params);
$products = $stmt->fetchAll();

// Success/error messages from session
$success = isset($_SESSION['success']) ? $_SESSION['success'] : '';
$error = isset($_SESSION['error']) ? $_SESSION['error'] : '';
unset($_SESSION['success'], $_SESSION['error']);

require_once 'includes/header.php';
?>
<?php if ($success): ?>
    <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
<?php endif; ?>

<?php if ($error): ?>
    <div class="alert alert-danger"><?php echo htmlspecialchars($error); ?></div>
<?php endif; ?>

<div class="admin-card">
    <h3 class="admin-card-title">Product Filters</h3>
    <form class="filter-bar" method="GET" action="products.php">
        <input type="text" name="search" placeholder="Search by name, item code or brand..." value="<?php echo htmlspecialchars($search); ?>">
        <select name="category" id="productFilterCategory" onchange="updateProductFilterSubcategories(this.value, '')">
            <option value="">All Categories</option>
            <option value="Helmet" <?php echo ($category === 'Helmet') ? 'selected' : ''; ?>>Helmet</option>
            <option value="Apparel" <?php echo ($category === 'Apparel') ? 'selected' : ''; ?>>Apparel</option>
            <option value="Accessories" <?php echo ($category === 'Accessories') ? 'selected' : ''; ?>>Accessories</option>
        </select>
        <select name="subcategory" id="productFilterSubcategory">
            <option value="">All Subcategories</option>
        </select>
        <button type="submit" class="btn btn-primary">Search</button>
        <a href="products.php" class="btn btn-secondary">Reset</a>
        <a href="add_product.php" class="btn btn-success">+ Add Product</a>
    </form>
</div>

<div class="admin-card">
    <h3 class="admin-card-title">Products (<?php echo count($products); ?> items)</h3>
    <?php if (!empty($products)): ?>
    <div class="table-scroll-wrap">
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Item Code</th>
                    <th>Name</th>
                    <th>Category / Subcategory</th>
                    <?php if ($isBoss): ?>
                    <th>Cost Price</th>
                    <?php endif; ?>
                    <th>Price</th>
                    <th>Online Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($products as $row): ?>
                <tr>
                    <td>
                        <?php
                            $adminImage = $row['display_image'] ?? '';
                            $adminImageFile = $adminImage ? ('../' . ltrim($adminImage, '/')) : '';
                        ?>
                        <?php if ($adminImage && file_exists($adminImageFile)): ?>
                            <img src="../<?php echo htmlspecialchars(ltrim($adminImage, '/')); ?>" alt="" class="admin-product-thumb">
                        <?php else: ?>
                            <div class="admin-thumb-placeholder">N/A</div>
                        <?php endif; ?>
                    </td>
                    <td><?php echo htmlspecialchars($row['item_code']); ?></td>
                    <td>
                        <strong><?php echo htmlspecialchars($row['name']); ?></strong><br>
                        <span style="color:#6b7280;font-size:12px;"><?php echo htmlspecialchars($row['brand']); ?></span>
                    </td>
                    <td><?php echo htmlspecialchars($row['category']); ?> / <?php echo htmlspecialchars($row['sub_category']); ?></td>
                    <?php if ($isBoss): ?>
                    <td>RM <?php echo number_format((float)($row['cost_price'] ?? 0), 2); ?></td>
                    <?php endif; ?>
                    <td>RM <?php echo number_format((float)$row['price'], 2); ?></td>
                    <td>RM <?php echo number_format((float)($row['online_sell_price'] ?? 0), 2); ?></td>
                    <td class="<?php echo ($row['total_quantity'] < 5) ? 'low-stock' : ''; ?>"><?php echo (int)$row['total_quantity']; ?></td>
                    <td>
                        <?php if (($row['status'] ?? '') === 'ACTIVE'): ?>
                            <span class="status-badge status-active">Active</span>
                        <?php elseif (($row['status'] ?? '') === 'HIDDEN'): ?>
                            <span class="status-badge status-hidden">Hidden</span>
                        <?php else: ?>
                            <span class="status-badge status-out">Out of Stock</span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <div class="action-btns">
                            <a href="edit_product.php?id=<?php echo $row['id']; ?>" class="btn btn-info btn-sm">Edit</a>
                            <?php if ($isBoss): ?>
                            <button type="button" class="btn btn-danger btn-sm" onclick="confirmDelete(<?php echo $row['id']; ?>, '<?php echo htmlspecialchars($row['name'], ENT_QUOTES); ?>')">Delete</button>
                            <?php endif; ?>
                        </div>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
        <p style="color:#888;padding:20px 0;">No products found. <a href="add_product.php" style="color:#ff7a00;">Add your first product</a>.</p>
    <?php endif; ?>
</div>


<script>
const productFilterSubcategories = {
    Helmet: ['Full Face Helmet', 'Open Face Helmet', 'Flip Up Helmet', 'Off Road Helmet', 'Kid Helmet'],
    Apparel: ['Jackets', 'Pants', 'Gloves', 'Rain Gear'],
    Accessories: ['Bags', 'Disc Lock', 'Helmet Accessories', 'Other Accessories']
};

function updateProductFilterSubcategories(category, selected) {
    const select = document.getElementById('productFilterSubcategory');
    if (!select) return;

    select.innerHTML = '<option value="">All Subcategories</option>';
    const values = category ? (productFilterSubcategories[category] || []) : Object.values(productFilterSubcategories).flat();

    values.forEach(function(item) {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        if (item === selected) option.selected = true;
        select.appendChild(option);
    });
}

updateProductFilterSubcategories(<?php echo json_encode($category); ?>, <?php echo json_encode($subcategory); ?>);
</script>

<?php
require_once 'includes/footer.php';
$conn = null;
?>

