<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
ensureInventoryMovementSchema($conn);

$page_title = 'Stock Out';
$error = '';
$success = '';

function h($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function selected_attr($a, $b) {
    return ((string)$a === (string)$b) ? 'selected' : '';
}

function color_belongs_to_product(PDO $conn, int $colorId, int $productId): bool {
    $stmt = $conn->prepare("SELECT 1 FROM product_colors WHERE id = ? AND product_id = ? LIMIT 1");
    $stmt->execute([$colorId, $productId]);
    return (bool)$stmt->fetchColumn();
}

$selectedProductId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
$selectedColorId = isset($_GET['color_id']) ? (int)$_GET['color_id'] : 0;
$selectedSize = isset($_GET['size']) ? trim((string)$_GET['size']) : '';
$selectedSizeId = isset($_GET['size_id']) ? (int)$_GET['size_id'] : 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrfToken = (string)($_POST['csrf_token'] ?? '');
    if (empty($csrfToken) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
        $error = 'Invalid security token. Please refresh the page and try again.';
    } else {
    $productId = (int)($_POST['product_id'] ?? 0);
    $colorId = (int)($_POST['color_id'] ?? 0);
    $sizeId = (int)($_POST['size_id'] ?? 0);
    $quantity = (int)($_POST['quantity'] ?? 0);
    $reason = trim((string)($_POST['reason'] ?? ''));
    $note = trim((string)($_POST['note'] ?? ''));

    $selectedProductId = $productId;
    $selectedColorId = $colorId;
    $selectedSizeId = $sizeId;

    if ($productId <= 0) {
        $error = 'Please select a product.';
    } elseif ($colorId <= 0) {
        $error = 'Please select a colour.';
    } elseif ($sizeId <= 0) {
        $error = 'Please select a size.';
    } elseif ($quantity <= 0) {
        $error = 'Stock Out quantity must be more than 0.';
    } elseif ($reason === '') {
        $error = 'Please select a reason for the Stock Out.';
    } else {
        try {
            $productCheck = $conn->prepare("SELECT id FROM products WHERE id = ?");
            $productCheck->execute([$productId]);
            if (!$productCheck->fetch()) {
                throw new Exception('Selected product does not exist.');
            }
            if (!color_belongs_to_product($conn, $colorId, $productId)) {
                throw new Exception('Selected colour does not belong to this product.');
            }

            $conn->beginTransaction();

            $sizeStmt = $conn->prepare("SELECT id, size, quantity FROM product_sizes WHERE id = ? AND product_id = ? AND color_id = ? FOR UPDATE");
            $sizeStmt->execute([$sizeId, $productId, $colorId]);
            $sizeRow = $sizeStmt->fetch();
            if (!$sizeRow) {
                throw new Exception('Selected size does not exist for this colour.');
            }

            $size = (string)$sizeRow['size'];
            $selectedSize = $size;
            $beforeQty = (int)$sizeRow['quantity'];
            if ($quantity > $beforeQty) {
                throw new Exception('Cannot remove ' . $quantity . ' unit(s). Only ' . $beforeQty . ' unit(s) are available for this colour and size.');
            }
            $afterQty = $beforeQty - $quantity;

            $update = $conn->prepare("UPDATE product_sizes SET quantity = ? WHERE id = ?");
            $update->execute([$afterQty, (int)$sizeRow['id']]);

            $editedByAdminId = $_SESSION['admin_id'] ?? null;
            $editedByAdminName = currentAdminDisplayName();
            $history = $conn->prepare("INSERT INTO stock_history (product_id, color_id, size, type, quantity, reason, quantity_before, quantity_after, note, edited_by_admin_id, edited_by_admin_name) VALUES (?, ?, ?, 'OUT', ?, ?, ?, ?, ?, ?, ?)");
            $history->execute([$productId, $colorId, $size, $quantity, $reason, $beforeQty, $afterQty, $note, $editedByAdminId, $editedByAdminName]);

            $conn->commit();
            $_SESSION['success'] = 'Stock Out recorded successfully.';
            header('Location: stock_out.php?product_id=' . $productId . '&color_id=' . $colorId . '&size=' . urlencode($size));
            exit();
        } catch (Exception $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            $error = 'Failed to record Stock Out: ' . $e->getMessage();
        }
    }
    }
}

if (isset($_SESSION['success'])) {
    $success = $_SESSION['success'];
    unset($_SESSION['success']);
}

$products = $conn->query("SELECT id, item_code, name, category, sub_category FROM products ORDER BY name ASC")->fetchAll();

$colors = [];
$sizes = [];
$selectedProduct = null;
$currentQty = null;
$selectedColorName = '';
if ($selectedProductId > 0) {
    $pstmt = $conn->prepare("SELECT id, item_code, name, category, sub_category FROM products WHERE id = ?");
    $pstmt->execute([$selectedProductId]);
    $selectedProduct = $pstmt->fetch();

    $cstmt = $conn->prepare("SELECT id, color_name, color_code, is_default FROM product_colors WHERE product_id = ? ORDER BY is_default DESC, color_name ASC, id ASC");
    $cstmt->execute([$selectedProductId]);
    $colors = $cstmt->fetchAll();

    if ($selectedColorId <= 0 && !empty($colors)) {
        $selectedColorId = (int)$colors[0]['id'];
    }

    foreach ($colors as $colorRow) {
        if ((int)$colorRow['id'] === (int)$selectedColorId) {
            $selectedColorName = (string)$colorRow['color_name'];
            break;
        }
    }

    if ($selectedColorId > 0) {
        $sstmt = $conn->prepare("SELECT id, size, quantity FROM product_sizes WHERE product_id = ? AND color_id = ? ORDER BY size ASC");
        $sstmt->execute([$selectedProductId, $selectedColorId]);
        $sizes = $sstmt->fetchAll();

        foreach ($sizes as $sizeRow) {
            if (($selectedSizeId > 0 && (int)$sizeRow['id'] === $selectedSizeId) || ((string)$sizeRow['size'] === (string)$selectedSize)) {
                $selectedSizeId = (int)$sizeRow['id'];
                $selectedSize = (string)$sizeRow['size'];
                $currentQty = (int)$sizeRow['quantity'];
                break;
            }
        }
    }
}

$reasons = ['Damaged item', 'Lost item', 'Used for display/demo', 'Supplier defect', 'Sold outside system', 'Stock correction', 'Other'];

require_once 'includes/header.php';
?>

<?php if ($success): ?><div class="alert alert-success"><?php echo h($success); ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-danger"><?php echo h($error); ?></div><?php endif; ?>

<div class="admin-card inventory-action-card">
    <div class="report-section-head">
        <div>
            <h3 class="admin-card-title">Stock Out</h3>
        </div>
        <a href="stock_report.php#stock-movement-history" class="btn btn-info">View Stock History</a>
    </div>


    <form method="POST" action="stock_out.php" class="inventory-form" id="stockOutForm" onsubmit="return showStockOutModal(event);">
        <input type="hidden" name="csrf_token" value="<?php echo h($_SESSION['csrf_token'] ?? ''); ?>">
        <div class="form-row inventory-form-row">
            <div class="form-group">
                <label>Product <span class="required">*</span></label>
                <select name="product_id" id="product_id" required onchange="changeInventoryProduct('stock_out.php', this.value)">
                    <option value="">-- Select Product --</option>
                    <?php foreach ($products as $product): ?>
                    <option value="<?php echo (int)$product['id']; ?>" <?php echo selected_attr($selectedProductId, $product['id']); ?>>
                        <?php echo h($product['item_code'] . ' - ' . $product['name']); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label>Colour <span class="required">*</span></label>
                <select name="color_id" id="color_id" required onchange="changeInventoryColor('stock_out.php')" <?php echo empty($colors) ? 'disabled' : ''; ?>>
                    <option value="">-- Select Colour --</option>
                    <?php foreach ($colors as $colorRow): ?>
                    <option value="<?php echo (int)$colorRow['id']; ?>" <?php echo selected_attr($selectedColorId, $colorRow['id']); ?>>
                        <?php echo h($colorRow['color_name']); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                <?php if ($selectedProduct && empty($colors)): ?>
                    <small class="field-help">No colours found for this product. Please add colours first from Colors &amp; Images.</small>
                <?php endif; ?>
            </div>
        </div>

        <div class="form-row inventory-form-row">
            <div class="form-group">
                <label>Size <span class="required">*</span></label>
                <select name="size_id" id="size_id" required onchange="updateStockOutPreview()">
                    <option value="">-- Select Size --</option>
                    <?php foreach ($sizes as $sizeRow): ?>
                    <option value="<?php echo (int)$sizeRow['id']; ?>" data-size="<?php echo h($sizeRow['size']); ?>" data-qty="<?php echo (int)$sizeRow['quantity']; ?>" <?php echo selected_attr($selectedSizeId, $sizeRow['id']); ?>>
                        <?php echo h($sizeRow['size']); ?> — Current: <?php echo (int)$sizeRow['quantity']; ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                <small class="field-help" id="currentQtyText"><?php echo $currentQty !== null ? 'Current stock: ' . (int)$currentQty . ' unit(s)' : 'Select a size to view current stock.'; ?></small>
            </div>
            <div class="form-group">
                <label>Quantity Removed <span class="required">*</span></label>
                <input type="number" name="quantity" id="quantity" min="1" required placeholder="Enter quantity" oninput="updateStockOutPreview()">
                <small class="field-help" id="stockOutLimitText">The system will check the selected size stock before submitting.</small>
            </div>
        </div>

        <div class="form-row inventory-form-row">
            <div class="form-group">
                <label>Reason <span class="required">*</span></label>
                <select name="reason" id="reason" required>
                    <option value="">-- Select Reason --</option>
                    <?php foreach ($reasons as $reason): ?>
                    <option value="<?php echo h($reason); ?>"><?php echo h($reason); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label>Additional Note</label>
                <textarea name="note" rows="3" placeholder="Optional note, explanation, staff comment, or supporting detail"></textarea>
            </div>
        </div>

        <div class="inventory-stock-preview danger-preview" id="stockOutPreview">
            <div><span>Current Stock</span><strong id="stockOutCurrentQty"><?php echo $currentQty !== null ? (int)$currentQty : 0; ?> unit(s)</strong></div>
            <div><span>Quantity Removed</span><strong id="stockOutRemovedQty">0 unit(s)</strong></div>
            <div><span>After Stock Out</span><strong id="stockOutAfterQty"><?php echo $currentQty !== null ? (int)$currentQty : 0; ?> unit(s)</strong></div>
        </div>


        <div class="form-actions inventory-actions">
            <button type="submit" class="btn btn-danger btn-lg">Confirm Stock Out</button>
            <a href="products.php" class="btn btn-secondary btn-lg">Cancel</a>
        </div>
    </form>
</div>

<div class="inventory-confirm-overlay" id="stockOutConfirmOverlay" aria-hidden="true" hidden>
    <div class="inventory-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="stockOutConfirmTitle">
        <div class="inventory-confirm-icon danger">!</div>
        <h3 id="stockOutConfirmTitle">Confirm Stock Out</h3>
        <p class="inventory-confirm-text">Please check the details before removing stock.</p>
        <div class="inventory-confirm-summary">
            <div><span>Colour</span><strong id="stockOutConfirmColor">-</strong></div>
            <div><span>Size</span><strong id="stockOutConfirmSize">-</strong></div>
            <div><span>Current Stock</span><strong id="stockOutConfirmCurrent">-</strong></div>
            <div><span>Quantity Removed</span><strong id="stockOutConfirmQty">-</strong></div>
            <div><span>After Stock Out</span><strong id="stockOutConfirmAfter">-</strong></div>
            <div><span>Reason</span><strong id="stockOutConfirmReason">-</strong></div>
        </div>
        <div class="inventory-confirm-actions">
            <button type="button" class="btn btn-secondary" onclick="closeStockOutModal()">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="submitStockOutForm()">Yes, Confirm</button>
        </div>
    </div>
</div>

<?php if ($selectedProduct): ?>
<div class="admin-card">
    <h3 class="admin-card-title">Current Stock for <?php echo h($selectedProduct['name']); ?><?php echo $selectedColorName ? ' - ' . h($selectedColorName) : ''; ?></h3>
    <?php if (!empty($sizes)): ?>
    <div class="table-scroll-wrap">
        <table>
            <thead><tr><th>Colour</th><th>Size</th><th>Current Quantity</th><th>Status</th></tr></thead>
            <tbody>
                <?php foreach ($sizes as $sizeRow): ?>
                <tr>
                    <td><?php echo h($selectedColorName ?: 'N/A'); ?></td>
                    <td><?php echo h($sizeRow['size']); ?></td>
                    <td><?php echo (int)$sizeRow['quantity']; ?></td>
                    <td><?php if ((int)$sizeRow['quantity'] === 0): ?><span class="status-badge status-out">Out of Stock</span><?php elseif ((int)$sizeRow['quantity'] < 5): ?><span class="status-badge status-low">Low Stock</span><?php else: ?><span class="status-badge status-in">In Stock</span><?php endif; ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
    <p style="color:#6b7280;">No sizes exist for this colour. Use Stock In to create a size before using Stock Out.</p>
    <?php endif; ?>
</div>
<?php endif; ?>

<script>
function changeInventoryProduct(page, productId) {
    if (productId) {
        window.location.href = page + '?product_id=' + encodeURIComponent(productId);
    }
}
function changeInventoryColor(page) {
    const productId = document.getElementById('product_id')?.value || '';
    const colorId = document.getElementById('color_id')?.value || '';
    if (productId && colorId) {
        window.location.href = page + '?product_id=' + encodeURIComponent(productId) + '&color_id=' + encodeURIComponent(colorId);
    }
}
function selectedText(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.tagName === 'SELECT') {
        return el.options[el.selectedIndex]?.textContent.trim() || '';
    }
    return el.value || '';
}
function getStockOutCurrentQty() {
    const select = document.getElementById('size_id');
    const option = select?.options[select.selectedIndex];
    return parseInt(option?.getAttribute('data-qty') || '0', 10) || 0;
}
function updateStockOutPreview() {
    const select = document.getElementById('size_id');
    const text = document.getElementById('currentQtyText');
    const option = select?.options[select.selectedIndex];
    const qty = getStockOutCurrentQty();
    const quantityInput = document.getElementById('quantity');
    const removed = parseInt(quantityInput?.value || '0', 10) || 0;
    const after = Math.max(qty - removed, 0);
    const limitText = document.getElementById('stockOutLimitText');
    if (quantityInput && qty > 0) quantityInput.max = qty;
    if (text) text.textContent = option && option.value ? 'Current stock: ' + qty + ' unit(s)' : 'Select a size to view current stock.';
    if (limitText) {
        limitText.textContent = removed > qty && qty >= 0 ? 'Cannot remove ' + removed + ' unit(s). Only ' + qty + ' unit(s) are available.' : 'The system will check the selected size stock before submitting.';
        limitText.classList.toggle('danger-text', removed > qty && qty >= 0);
    }
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value + ' unit(s)'; };
    setText('stockOutCurrentQty', qty);
    setText('stockOutRemovedQty', removed);
    setText('stockOutAfterQty', after);
}
function updateCurrentQtyText() { updateStockOutPreview(); }
function showStockOutModal(event) {
    event.preventDefault();
    const form = document.getElementById('stockOutForm');
    if (form && !form.checkValidity()) {
        form.reportValidity();
        return false;
    }

    const sizeSelect = document.getElementById('size_id');
    const selectedOption = sizeSelect?.options[sizeSelect.selectedIndex];
    const size = selectedOption?.getAttribute('data-size') || '';
    updateStockOutPreview();
    const current = getStockOutCurrentQty();
    const quantityInput = document.getElementById('quantity');
    const qty = parseInt(quantityInput?.value || '0', 10) || 0;
    if (qty > current) {
        if (quantityInput) {
            quantityInput.setCustomValidity('Cannot remove more than the current stock.');
            quantityInput.reportValidity();
            quantityInput.setCustomValidity('');
        }
        return false;
    }
    const after = Math.max(current - qty, 0);
    const reason = document.getElementById('reason')?.value || '';
    const overlay = document.getElementById('stockOutConfirmOverlay');

    document.getElementById('stockOutConfirmColor').textContent = selectedText('color_id') || '-';
    document.getElementById('stockOutConfirmSize').textContent = size || '-';
    document.getElementById('stockOutConfirmCurrent').textContent = current + ' unit(s)';
    document.getElementById('stockOutConfirmQty').textContent = qty ? qty + ' unit(s)' : '-';
    document.getElementById('stockOutConfirmAfter').textContent = after + ' unit(s)';
    document.getElementById('stockOutConfirmReason').textContent = reason || '-';
    overlay.hidden = false;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    return false;
}
function closeStockOutModal() {
    const overlay = document.getElementById('stockOutConfirmOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
}
function submitStockOutForm() {
    document.getElementById('stockOutForm').submit();
}
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeStockOutModal();
    }
});
document.addEventListener('DOMContentLoaded', updateStockOutPreview);
</script>

<?php require_once 'includes/footer.php'; $conn = null; ?>
