<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
ensureBossPricingSchema($conn);
ensureInventoryMovementSchema($conn);
$isBoss = isBossAdmin();

$page_title = 'Edit Product';
$error = '';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

$stmt = $conn->prepare("SELECT * FROM products WHERE id = ?");
$stmt->execute([$id]);
$product = $stmt->fetch();

if (!$product) {
    header("Location: products.php");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isValidAdminCsrfToken()) {
        $error = 'Invalid security token. Please refresh the page and try again.';
    } else {
    $name         = trim($_POST['name'] ?? '');
    $item_code    = trim($_POST['item_code'] ?? '');
    $category     = trim($_POST['category'] ?? '');
    $sub_category = trim($_POST['sub_category'] ?? '');
    $brand        = trim($_POST['brand'] ?? '');
    $status       = trim($_POST['status'] ?? 'ACTIVE');
    $price        = floatval($_POST['price'] ?? 0);
    $cost_price   = $isBoss ? floatval($_POST['cost_price'] ?? 0) : (float)($product['cost_price'] ?? 0);
    $online_sell_price = $isBoss ? floatval($_POST['online_sell_price'] ?? 0) : (float)($product['online_sell_price'] ?? 0);
    $description  = trim($_POST['description'] ?? '');

    if (empty($name) || empty($item_code) || empty($category) || empty($sub_category) || empty($brand)) {
        $error = 'Please fill in all required fields.';
    } else {
        $check = $conn->prepare("SELECT id FROM products WHERE item_code = ? AND id != ?");
        $check->execute([$item_code, $id]);
        if ($check->fetch()) {
            $error = 'Item code already exists. Please use a unique code.';
        }
    }

    if (!$error) {
        if ($isBoss) {
            $upd = $conn->prepare("UPDATE products SET item_code=?, name=?, brand=?, category=?, sub_category=?, status=?, price=?, cost_price=?, online_sell_price=?, description=? WHERE id=?");
            $updated = $upd->execute([$item_code, $name, $brand, $category, $sub_category, $status, $price, $cost_price, $online_sell_price, $description, $id]);
        } else {
            // Normal admin cannot update boss-only price fields, even if hidden inputs are submitted manually.
            $upd = $conn->prepare("UPDATE products SET item_code=?, name=?, brand=?, category=?, sub_category=?, status=?, price=?, description=? WHERE id=?");
            $updated = $upd->execute([$item_code, $name, $brand, $category, $sub_category, $status, $price, $description, $id]);
        }
        if ($updated) {
            $_SESSION['success'] = 'Product details updated successfully. Stock quantity changes must be done through Stock In or Stock Out.';
            header("Location: products.php");
            exit();
        } else {
            $error = 'Failed to update product.';
        }
    }

    // Re-populate on error
    $product['item_code']    = $item_code;
    $product['name']         = $name;
    $product['category']     = $category;
    $product['sub_category'] = $sub_category;
    $product['brand']        = $brand;
    $product['price']        = $price;
    $product['description']  = $description;
    $product['status']       = $status;
    $product['cost_price']   = $cost_price;
    $product['online_sell_price'] = $online_sell_price;
    }
}

$sizes_stmt = $conn->prepare("SELECT ps.id, ps.color_id, COALESCE(pc.color_name, 'No colour assigned') AS color_name, ps.size, ps.quantity FROM product_sizes ps LEFT JOIN product_colors pc ON pc.id = ps.color_id WHERE ps.product_id = ? ORDER BY pc.is_default DESC, pc.color_name ASC, ps.size ASC");
$sizes_stmt->execute([$id]);
$product_sizes = $sizes_stmt->fetchAll();

// Color count badge
$color_count_stmt = $conn->prepare("SELECT COUNT(*) FROM product_colors WHERE product_id = ?");
$color_count_stmt->execute([$id]);
$color_count = $color_count_stmt->fetchColumn();

require_once 'includes/header.php';
?>

<?php if ($error): ?>
<div class="alert alert-danger"><?php echo htmlspecialchars($error); ?></div>
<?php endif; ?>

<div class="form-container">

    <!-- Colors & Images CTA Banner -->
    <div class="colors-cta-banner">
        <div class="colors-cta-left">
            <div class="colors-cta-icon">🎨</div>
            <div>
                <div class="colors-cta-title">Colors &amp; Images</div>
                <div class="colors-cta-sub">
                    <?php if ($color_count > 0): ?>
                        <?php echo $color_count; ?> color<?php echo $color_count > 1 ? 's' : ''; ?> configured for this product
                    <?php else: ?>
                        No colors added yet — click to set up product colors and images
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <a href="manage_product_colors.php?product_id=<?php echo $id; ?>" class="btn-manage-colors">
            Manage Colors &amp; Images →
        </a>
    </div>

    <form method="POST" action="edit_product.php?id=<?php echo $id; ?>">
        <?php echo adminCsrfInput(); ?>

        <div class="form-section-title">Basic Information</div>

        <div class="form-row">
            <div class="form-group">
                <label for="item_code">Item Code <span class="required">*</span></label>
                <input type="text" id="item_code" name="item_code" value="<?php echo htmlspecialchars($product['item_code']); ?>" required>
            </div>
            <div class="form-group">
                <label for="name">Product Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" value="<?php echo htmlspecialchars($product['name']); ?>" required>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="brand">Brand <span class="required">*</span></label>
                <input type="text" id="brand" name="brand" value="<?php echo htmlspecialchars($product['brand']); ?>" required>
            </div>
            <div class="form-group">
                <label for="price">Price (RM) <span class="required">*</span></label>
                <input type="number" id="price" name="price" step="0.01" min="0" value="<?php echo $product['price']; ?>" required>
            </div>
        </div>

        <?php if ($isBoss): ?>
        <div class="boss-only-box">
            <div class="form-section-title">Boss-Only Pricing</div>
            <p class="boss-note">Only boss admins can view and edit cost price and online sell price.</p>
            <div class="form-row">
                <div class="form-group">
                    <label for="cost_price">Cost Price (RM)</label>
                    <input type="number" id="cost_price" name="cost_price" step="0.01" min="0"
                           value="<?php echo htmlspecialchars(number_format((float)($product['cost_price'] ?? 0), 2, '.', '')); ?>">
                </div>
                <div class="form-group">
                    <label for="online_sell_price">Online Sell Price (RM)</label>
                    <input type="number" id="online_sell_price" name="online_sell_price" step="0.01" min="0"
                           value="<?php echo htmlspecialchars(number_format((float)($product['online_sell_price'] ?? 0), 2, '.', '')); ?>">
                </div>
            </div>
        </div>
        <?php endif; ?>

        <div class="form-row">
            <div class="form-group">
                <label for="category">Main Category <span class="required">*</span></label>
                <select id="category" name="category" required onchange="updateSubCategories(this.value, document.getElementById('sub_category').dataset.selected || '')">
                    <option value="">-- Select Category --</option>
                    <option value="Helmet"      <?php echo $product['category'] === 'Helmet'      ? 'selected' : ''; ?>>Helmet</option>
                    <option value="Apparel"     <?php echo $product['category'] === 'Apparel'     ? 'selected' : ''; ?>>Apparel</option>
                    <option value="Accessories" <?php echo $product['category'] === 'Accessories' ? 'selected' : ''; ?>>Accessories</option>
                </select>
            </div>
            <div class="form-group">
                <label for="sub_category">Sub Category <span class="required">*</span></label>
                <select id="sub_category" name="sub_category" required
                        data-selected="<?php echo htmlspecialchars($product['sub_category']); ?>">
                    <option value="">-- Select Sub Category --</option>
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status">
                    <option value="ACTIVE"       <?php echo $product['status'] === 'ACTIVE'       ? 'selected' : ''; ?>>Active</option>
                    <option value="HIDDEN"       <?php echo $product['status'] === 'HIDDEN'       ? 'selected' : ''; ?>>Hidden</option>
                    <option value="OUT_OF_STOCK" <?php echo $product['status'] === 'OUT_OF_STOCK' ? 'selected' : ''; ?>>Out of Stock</option>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="4"><?php echo htmlspecialchars($product['description']); ?></textarea>
        </div>

        <div class="form-section-title" style="margin-top:28px;">Sizes &amp; Current Stock</div>

        <div class="stock-lock-note">
            <strong>Stock quantity is locked on this page.</strong>
            This page is only for editing product information. Please use <b>Stock In</b> to add quantity and <b>Stock Out</b> to remove quantity with a required reason.
        </div>

        <div class="table-scroll-wrap stock-readonly-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Colour</th>
                        <th>Size</th>
                        <th>Current Stock</th>
                        <th>Status</th>
                        <th>Stock Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($product_sizes)): ?>
                    <?php foreach ($product_sizes as $ps): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($ps['color_name'] ?? 'No colour assigned'); ?></td>
                        <td><strong><?php echo htmlspecialchars($ps['size']); ?></strong></td>
                        <td><?php echo (int)$ps['quantity']; ?></td>
                        <td>
                            <?php if ((int)$ps['quantity'] === 0): ?>
                                <span class="status-badge status-out">Out of Stock</span>
                            <?php elseif ((int)$ps['quantity'] < 5): ?>
                                <span class="status-badge status-low">Low Stock</span>
                            <?php else: ?>
                                <span class="status-badge status-in">In Stock</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <div class="action-btns">
                                <a class="btn btn-success btn-sm" href="stock_in.php?product_id=<?php echo (int)$id; ?>&color_id=<?php echo (int)($ps['color_id'] ?? 0); ?>&size=<?php echo urlencode($ps['size']); ?>">Stock In</a>
                                <a class="btn btn-danger btn-sm" href="stock_out.php?product_id=<?php echo (int)$id; ?>&color_id=<?php echo (int)($ps['color_id'] ?? 0); ?>&size_id=<?php echo (int)($ps['id'] ?? 0); ?>">Stock Out</a>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php else: ?>
                    <tr><td colspan="4" style="color:#6b7280;">No sizes have been created yet. Use Stock In to create a size and add quantity.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-lg">💾 Save Changes</button>
            <a href="products.php" class="btn btn-secondary btn-lg">Cancel</a>
        </div>

    </form>
</div>

<style>
/* Colors CTA Banner */
.colors-cta-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #1d1f22 0%, #2c2f36 100%);
    border: 1px solid #ff7a00;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 28px;
    gap: 16px;
    flex-wrap: wrap;
}
.colors-cta-left { display: flex; align-items: center; gap: 16px; }
.colors-cta-icon { font-size: 32px; line-height: 1; }
.colors-cta-title { color: #fff; font-size: 16px; font-weight: 700; margin-bottom: 3px; }
.colors-cta-sub   { color: #aaa; font-size: 13px; }
.btn-manage-colors {
    background: #ff7a00;
    color: #fff;
    padding: 12px 22px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    transition: background .2s, transform .2s;
}
.btn-manage-colors:hover { background: #e86f00; transform: translateX(2px); }

.form-section-title {
    font-size: 13px;
    font-weight: 700;
    color: #ff7a00;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e0e0e0;
}
.form-actions { display: flex; gap: 12px; margin-top: 28px; }
.boss-only-box { border: 1px solid #ff7a00; background: #fff7ef; border-radius: 10px; padding: 18px 18px 6px; margin: 18px 0 20px; }
.boss-note { margin: -6px 0 14px; color: #666; font-size: 13px; }

.stock-lock-note {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #7c2d12;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 16px;
    font-size: 14px;
    line-height: 1.55;
}
.stock-readonly-wrap table { min-width: 620px; }
</style>

<script>
const subCategories = {
    Helmet:      ['Full Face Helmet','Open Face Helmet','Flip Up Helmet','Kid Helmet'],
    Apparel:     ['Jackets','Pants','Gloves','Rain Gear'],
    Accessories: ['Bag','Disc Lock','Other'],
};

function normalizeSubCategory(value) {
    return String(value || '').trim().toLowerCase();
}

function updateSubCategories(cat, selected) {
    const sel = document.getElementById('sub_category');
    if (!sel) return;

    const saved = String(selected || sel.dataset.selected || '').trim();
    const normalizedSaved = normalizeSubCategory(saved);

    sel.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Select Sub Category --';
    sel.appendChild(placeholder);

    let matched = false;
    (subCategories[cat] || []).forEach(subCategory => {
        const option = document.createElement('option');
        option.value = subCategory;
        option.textContent = subCategory;

        if (normalizeSubCategory(subCategory) === normalizedSaved) {
            option.selected = true;
            matched = true;
        }

        sel.appendChild(option);
    });

    if (!matched) {
        placeholder.selected = true;
    }
}

// On page load: rebuild subcategory dropdown and restore saved selection
document.addEventListener('DOMContentLoaded', function () {
    const catEl = document.getElementById('category');
    const subEl = document.getElementById('sub_category');
    if (catEl && subEl && catEl.value) {
        updateSubCategories(catEl.value, subEl.dataset.selected || '');
    }
});

</script>

<?php require_once 'includes/footer.php'; $conn = null; ?>
