// Admin sidebar toggle (moved from the inline script in admin/includes/footer.php).
function toggleAdminSidebar(forceOpen) {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', shouldOpen);
    overlay.classList.toggle('open', shouldOpen);
}
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') toggleAdminSidebar(false);
});

// ---- Category -> sub-category dropdowns (views/admin/CategorySelects.tsx) ----
document.querySelectorAll('.js-category-select').forEach(function (categorySelect) {
    const subSelect = document.getElementById(categorySelect.dataset.subSelect);
    if (!subSelect) return;
    const map = JSON.parse(categorySelect.dataset.subcategories || '{}');
    categorySelect.addEventListener('change', function () {
        const previous = subSelect.value;
        const items = categorySelect.value
            ? (map[categorySelect.value] || [])
            : (categorySelect.dataset.mode === 'filter' ? Object.values(map).flat() : []);
        subSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = categorySelect.dataset.placeholder || '';
        subSelect.appendChild(placeholder);
        items.forEach(function (item) {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            option.selected = item.value === previous;
            subSelect.appendChild(option);
        });
    });
});

// ---- Colours page: colour picker <-> text code, and upload as soon as files are chosen ----
document.querySelectorAll('.js-colour-sync').forEach(function (picker) {
    const text = document.getElementById(picker.dataset.target);
    if (!text) return;
    picker.addEventListener('input', function () { text.value = picker.value; });
    text.addEventListener('input', function () {
        if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value.toLowerCase();
    });
});

document.querySelectorAll('.js-upload-form input[type="file"]').forEach(function (input) {
    input.addEventListener('change', function () {
        if (!input.files || input.files.length === 0) return;
        const tile = input.closest('.mpc-upload-tile');
        if (tile) tile.classList.add('is-uploading');
        input.form.submit();
    });
});

// ---- Stock In / Stock Out (views/admin/StockMovementPage.tsx) ----
(function () {
    const form = document.querySelector('.js-stock-form');
    if (!form) return;
    const isIn = form.dataset.mode === 'in';
    const page = form.dataset.page;
    const productSelect = form.querySelector('.js-stock-product');
    const colourSelect = form.querySelector('.js-stock-colour');
    const sizeSelect = form.querySelector('.js-stock-size');
    const newSizeInput = form.querySelector('.js-stock-new-size');
    const qtyInput = form.querySelector('.js-stock-qty');
    const overlay = document.getElementById('stockConfirmOverlay');

    // Choosing a product or colour reloads the page with that choice, to list its colours and sizes.
    productSelect.addEventListener('change', function () {
        if (productSelect.value) window.location.href = page + '?product_id=' + encodeURIComponent(productSelect.value);
    });
    if (colourSelect) {
        colourSelect.addEventListener('change', function () {
            if (productSelect.value && colourSelect.value) {
                window.location.href = page + '?product_id=' + encodeURIComponent(productSelect.value) +
                    '&color_id=' + encodeURIComponent(colourSelect.value);
            }
        });
    }

    function selectedOption(select) {
        return select && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    }
    function currentQty() {
        const typed = newSizeInput ? newSizeInput.value.trim().toLowerCase() : '';
        if (isIn && typed) {
            const match = Array.from(sizeSelect.options).find(function (o) { return o.value.trim().toLowerCase() === typed; });
            return match ? parseInt(match.dataset.qty || '0', 10) || 0 : 0;
        }
        const option = selectedOption(sizeSelect);
        return option && option.value ? parseInt(option.dataset.qty || '0', 10) || 0 : 0;
    }
    function chosenSize() {
        if (isIn) {
            const typed = newSizeInput ? newSizeInput.value.trim() : '';
            return typed || sizeSelect.value;
        }
        const option = selectedOption(sizeSelect);
        return option && option.value ? option.dataset.size : '';
    }
    function change() {
        return parseInt(qtyInput.value || '0', 10) || 0;
    }
    function after() {
        return isIn ? currentQty() + change() : Math.max(currentQty() - change(), 0);
    }
    function setText(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    }
    function updatePreview() {
        setText('[data-preview="current"]', currentQty() + ' unit(s)');
        setText('[data-preview="change"]', change() + ' unit(s)');
        setText('[data-preview="after"]', after() + ' unit(s)');
        if (isIn) return;
        const option = selectedOption(sizeSelect);
        const chosen = Boolean(option && option.value);
        const qty = currentQty();
        setText('#currentQtyText', chosen ? 'Current stock: ' + qty + ' unit(s)' : 'Select a size to view current stock.');
        const tooMany = chosen && change() > qty;
        const limit = document.getElementById('stockOutLimitText');
        if (limit) {
            limit.textContent = tooMany
                ? 'Cannot remove ' + change() + ' unit(s). Only ' + qty + ' unit(s) are available.'
                : 'The system will check the selected size stock before submitting.';
            limit.classList.toggle('danger-text', tooMany);
        }
        if (chosen) qtyInput.max = String(Math.max(qty, 1));
    }
    [sizeSelect, newSizeInput, qtyInput].forEach(function (el) {
        if (!el) return;
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
    });
    updatePreview();

    function closeModal() {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.hidden = true;
    }
    form.addEventListener('submit', function (event) {
        if (form.dataset.confirmed === '1') return;
        event.preventDefault();
        if (isIn && !chosenSize()) {
            const field = newSizeInput || sizeSelect;
            field.setCustomValidity('Please select an existing size or enter a new size.');
            field.reportValidity();
            field.setCustomValidity('');
            return;
        }
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        const colourOption = selectedOption(colourSelect);
        setText('[data-confirm="colour"]', colourOption && colourOption.value ? colourOption.textContent.trim() : '-');
        setText('[data-confirm="size"]', chosenSize() || '-');
        setText('[data-confirm="current"]', currentQty() + ' unit(s)');
        setText('[data-confirm="change"]', change() + ' unit(s)');
        setText('[data-confirm="after"]', after() + ' unit(s)');
        setText('[data-confirm="reason"]', form.querySelector('#reason').value || '-');
        overlay.hidden = false;
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.querySelector('.js-stock-confirm').focus();
    });
    overlay.querySelector('.js-stock-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (event) {
        if (event.target === overlay) closeModal();
    });
    overlay.querySelector('.js-stock-confirm').addEventListener('click', function () {
        form.dataset.confirmed = '1';
        this.disabled = true;
        form.submit();
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !overlay.hidden) closeModal();
    });
})();

// ---- Print view ----
document.querySelectorAll('.js-print').forEach(function (button) {
    button.addEventListener('click', function () { window.print(); });
});
