<?php
require_once 'includes/auth_check.php';
require_once '../config/database.php';
require_once 'includes/schema_helpers.php';
ensureInventoryMovementSchema($conn);

$page_title = 'Stock In';
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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrfToken = (string)($_POST['csrf_token'] ?? '');
    if (empty($csrfToken) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
        $error = 'Invalid security token. Please refresh the page and try again.';
    } else {
    $productId = (int)($_POST['product_id'] ?? 0);
    $colorId = (int)($_POST['color_id'] ?? 0);
    $existingSize = trim((string)($_POST['existing_size'] ?? ''));
    $newSize = trim((string)($_POST['new_size'] ?? ''));
    $size = $newSize !== '' ? $newSize : $existingSize;
    $quantity = (int)($_POST['quantity'] ?? 0);
    $reason = trim((string)($_POST['reason'] ?? ''));
    $note = trim((string)($_POST['note'] ?? ''));

    $selectedProductId = $productId;
    $selectedColorId = $colorId;
    $selectedSize = $size;

    if ($productId <= 0) {
        $error = 'Please select a product.';
    } elseif ($colorId <= 0) {
        $error = 'Please select a colour.';
    } elseif ($size === '') {
        $error = 'Please select an existing size or enter a new size.';
    } elseif ($quantity <= 0) {
        $error = 'Stock In quantity must be more than 0.';
    } elseif ($reason === '') {
        $error = 'Please select a reason for the Stock In.';
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

            $sizeStmt = $conn->prepare("SELECT id, quantity FROM product_sizes WHERE product_id = ? AND color_id = ? AND LOWER(TRIM(size)) = LOWER(TRIM(?)) FOR UPDATE");
            $sizeStmt->execute([$productId, $colorId, $size]);
            $sizeRow = $sizeStmt->fetch();
            $beforeQty = $sizeRow ? (int)$sizeRow['quantity'] : 0;
            $afterQty = $beforeQty + $quantity;

            if ($sizeRow) {
                $update = $conn->prepare("UPDATE product_sizes SET quantity = ?, size = ? WHERE id = ?");
                $update->execute([$afterQty, $size, (int)$sizeRow['id']]);
            } else {
                $insert = $conn->prepare("INSERT INTO product_sizes (product_id, color_id, size, quantity) VALUES (?, ?, ?, ?)");
                $insert->execute([$productId, $colorId, $size, $afterQty]);
            }

            $editedByAdminId = $_SESSION['admin_id'] ?? null;
            $editedByAdminName = currentAdminDisplayName();
            $history = $conn->prepare("INSERT INTO stock_history (product_id, color_id, size, type, quantity, reason, quantity_before, quantity_after, note, edited_by_admin_id, edited_by_admin_name) VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?)");
            $history->execute([$productId, $colorId, $size, $quantity, $reason, $beforeQty, $afterQty, $note, $editedByAdminId, $editedByAdminName]);

            $conn->commit();
            $_SESSION['success'] = 'Stock In recorded successfully.';
            header('Location: stock_in.php?product_id=' . $productId . '&color_id=' . $colorId . '&size=' . urlencode($size));
            exit();
        } catch (Exception $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            $error = 'Failed to record Stock In: ' . $e->getMessage();
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
    }
}

$reasons = ['New supplier stock', 'Restock', 'Returned item added back', 'Stock correction', 'Opening stock', 'Other'];

require_once 'includes/header.php';
?>

<?php if ($success): ?><div class="alert alert-success"><?php echo h($success); ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-danger"><?php echo h($error); ?></div><?php endif; ?>

<div class="admin-card inventory-action-card">
    <div class="report-section-head">
        <div>
            <h3 class="admin-card-title">Stock In</h3>
        </div>
        <a href="stock_report.php#stock-movement-history" class="btn btn-info">View Stock History</a>
    </div>


    <form method="POST" action="stock_in.php" class="inventory-form" id="stockInForm" onsubmit="return showStockInModal(event);">
        <input type="hidden" name="csrf_token" value="<?php echo h($_SESSION['csrf_token'] ?? ''); ?>">
        <div class="form-row inventory-form-row">
            <div class="form-group">
                <label>Product <span class="required">*</span></label>
                <select name="product_id" id="product_id" required onchange="changeInventoryProduct('stock_in.php', this.value)">
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
                <select name="color_id" id="color_id" required onchange="changeInventoryColor('stock_in.php')" <?php echo empty($colors) ? 'disabled' : ''; ?>>
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
                <label>Existing Size</label>
                <select name="existing_size" id="existing_size" onchange="updateStockInPreview()">
                    <option value="">-- Select Existing Size --</option>
                    <?php foreach ($sizes as $sizeRow): ?>
                    <option value="<?php echo h($sizeRow['size']); ?>" data-qty="<?php echo (int)$sizeRow['quantity']; ?>" <?php echo selected_attr($selectedSize, $sizeRow['size']); ?>>
                        <?php echo h($sizeRow['size']); ?> — Current: <?php echo (int)$sizeRow['quantity']; ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                <small class="field-help">Existing sizes shown here belong to the selected colour only.</small>
            </div>
            <div class="form-group">
                <label>New Size Optional</label>
                <input type="text" name="new_size" id="new_size" placeholder="Example: XS, XXL, Free Size" oninput="updateStockInPreview()">
                <small class="field-help">Only fill this when you want to create a new size for the selected colour.</small>
            </div>
        </div>

        <div class="form-row inventory-form-row">
            <div class="form-group">
                <label>Quantity Added <span class="required">*</span></label>
                <input type="number" name="quantity" id="quantity" min="1" required placeholder="Enter quantity" oninput="updateStockInPreview()">
            </div>
            <div class="form-group">
                <label>Reason <span class="required">*</span></label>
                <select name="reason" id="reason" required>
                    <option value="">-- Select Reason --</option>
                    <?php foreach ($reasons as $reason): ?>
                    <option value="<?php echo h($reason); ?>"><?php echo h($reason); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label>Additional Note</label>
            <textarea name="note" rows="3" placeholder="Optional note, supplier reference, invoice no., or explanation"></textarea>
        </div>

        <div class="inventory-stock-preview" id="stockInPreview">
            <div><span>Current Stock</span><strong id="stockInCurrentQty">0 unit(s)</strong></div>
            <div><span>Quantity Added</span><strong id="stockInAddedQty">0 unit(s)</strong></div>
            <div><span>After Stock In</span><strong id="stockInAfterQty">0 unit(s)</strong></div>
        </div>


        <div class="form-actions inventory-actions">
            <button type="submit" class="btn btn-primary btn-lg">Confirm Stock In</button>
            <a href="products.php" class="btn btn-secondary btn-lg">Cancel</a>
        </div>
    </form>
</div>

<div class="inventory-confirm-overlay" id="stockInConfirmOverlay" aria-hidden="true" hidden>
    <div class="inventory-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="stockInConfirmTitle">
        <div class="inventory-confirm-icon">✓</div>
        <h3 id="stockInConfirmTitle">Confirm Stock In</h3>
        <p class="inventory-confirm-text">Please check the details before adding stock.</p>
        <div class="inventory-confirm-summary">
            <div><span>Colour</span><strong id="stockInConfirmColor">-</strong></div>
            <div><span>Size</span><strong id="stockInConfirmSize">-</strong></div>
            <div><span>Current Stock</span><strong id="stockInConfirmCurrent">-</strong></div>
            <div><span>Quantity Added</span><strong id="stockInConfirmQty">-</strong></div>
            <div><span>After Stock In</span><strong id="stockInConfirmAfter">-</strong></div>
            <div><span>Reason</span><strong id="stockInConfirmReason">-</strong></div>
        </div>
        <div class="inventory-confirm-actions">
            <button type="button" class="btn btn-secondary" onclick="closeStockInModal()">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitStockInForm()">Yes, Confirm</button>
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
    <p style="color:#6b7280;">No sizes yet for this colour. Enter a new size above to create it.</p>
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
function getStockInCurrentQty() {
    const existingSelect = document.getElementById('existing_size');
    const newSize = document.getElementById('new_size')?.value.trim() || '';
    if (newSize !== '' && existingSelect) {
        const matched = Array.from(existingSelect.options).find(option => option.value.trim().toLowerCase() === newSize.toLowerCase());
        if (matched) return parseInt(matched.getAttribute('data-qty') || '0', 10) || 0;
        return 0;
    }
    const option = existingSelect?.options[existingSelect.selectedIndex];
    return parseInt(option?.getAttribute('data-qty') || '0', 10) || 0;
}
function getStockInFinalSize() {
    const existingSize = selectedText('existing_size').replace(/\s+—\s+Current:.*/, '').trim();
    const newSize = document.getElementById('new_size')?.value.trim() || '';
    return newSize || existingSize;
}
function updateStockInPreview() {
    const current = getStockInCurrentQty();
    const added = parseInt(document.getElementById('quantity')?.value || '0', 10) || 0;
    const after = current + added;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value + ' unit(s)'; };
    setText('stockInCurrentQty', current);
    setText('stockInAddedQty', added);
    setText('stockInAfterQty', after);
}
function showStockInModal(event) {
    event.preventDefault();
    const form = document.getElementById('stockInForm');
    if (form && !form.checkValidity()) {
        form.reportValidity();
        return false;
    }

    updateStockInPreview();
    const finalSize = getStockInFinalSize();
    const current = getStockInCurrentQty();
    const qty = parseInt(document.getElementById('quantity')?.value || '0', 10) || 0;
    const after = current + qty;
    const reason = document.getElementById('reason')?.value || '';
    const overlay = document.getElementById('stockInConfirmOverlay');

    document.getElementById('stockInConfirmColor').textContent = selectedText('color_id') || '-';
    document.getElementById('stockInConfirmSize').textContent = finalSize || '-';
    document.getElementById('stockInConfirmCurrent').textContent = current + ' unit(s)';
    document.getElementById('stockInConfirmQty').textContent = qty ? qty + ' unit(s)' : '-';
    document.getElementById('stockInConfirmAfter').textContent = after + ' unit(s)';
    document.getElementById('stockInConfirmReason').textContent = reason || '-';
    overlay.hidden = false;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    return false;
}
function closeStockInModal() {
    const overlay = document.getElementById('stockInConfirmOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
}
function submitStockInForm() {
    document.getElementById('stockInForm').submit();
}
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeStockInModal();
    }
});
document.addEventListener('DOMContentLoaded', updateStockInPreview);
</script>

<?php require_once 'includes/footer.php'; $conn = null; ?>
