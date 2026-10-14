// ---- Category & Sub-Category Mapping ----
const categoryMap = {
    'Helmet': ['Full Face Helmet', 'Open Face Helmet', 'Flip Up Helmet', 'Kid Helmet'],
    'Apparel': ['Jackets', 'Pants', 'Gloves', 'Rain Gear'],
    'Accessories': ['Bag', 'Disc Lock', 'Other'],
    'Brand': []
};

// ---- Update Sub-Category Dropdown ----
function updateSubCategory(categorySelect, subCategorySelect, preselected) {
    const cat = categorySelect.value;
    subCategorySelect.innerHTML = '<option value="">-- Select Sub Category --</option>';

    if (categoryMap[cat]) {
        categoryMap[cat].forEach(function (sub) {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            if (preselected && preselected === sub) {
                opt.selected = true;
            }
            subCategorySelect.appendChild(opt);
        });
    }
}

// ---- Image Preview ----
function previewImage(input, previewEl) {
    const preview = document.getElementById(previewEl);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ---- Custom Admin Confirmation Modal ----
function ensureAdminConfirmModal() {
    let overlay = document.getElementById('adminConfirmOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'adminConfirmOverlay';
    overlay.className = 'admin-confirm-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    overlay.innerHTML = `
        <div class="admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="adminConfirmTitle">
            <div class="admin-confirm-icon" id="adminConfirmIcon">!</div>
            <h3 id="adminConfirmTitle">Confirm Action</h3>
            <p id="adminConfirmMessage">Are you sure you want to continue?</p>
            <div class="admin-confirm-actions">
                <button type="button" class="btn btn-secondary" id="adminConfirmCancel">Cancel</button>
                <button type="button" class="btn btn-danger" id="adminConfirmProceed">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function showAdminConfirm(options) {
    const overlay = ensureAdminConfirmModal();
    const title = document.getElementById('adminConfirmTitle');
    const message = document.getElementById('adminConfirmMessage');
    const icon = document.getElementById('adminConfirmIcon');
    const cancelBtn = document.getElementById('adminConfirmCancel');
    const proceedBtn = document.getElementById('adminConfirmProceed');

    title.textContent = options.title || 'Confirm Action';
    message.textContent = options.message || 'Are you sure you want to continue?';
    proceedBtn.textContent = options.confirmText || 'Confirm';
    proceedBtn.className = 'btn ' + (options.type === 'danger' ? 'btn-danger' : 'btn-primary');
    icon.className = 'admin-confirm-icon ' + (options.type === 'danger' ? 'danger' : '');
    icon.textContent = options.type === 'danger' ? '!' : '✓';

    function closeModal() {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.hidden = true;
        proceedBtn.onclick = null;
    }

    cancelBtn.onclick = closeModal;
    overlay.onclick = function (event) {
        if (event.target === overlay) closeModal();
    };
    proceedBtn.onclick = function () {
        closeModal();
        if (typeof options.onConfirm === 'function') {
            options.onConfirm();
        }
    };

    overlay.hidden = false;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
}

// ---- Delete Confirmation ----
function confirmDelete(id, name) {
    showAdminConfirm({
        title: 'Delete Product',
        message: 'Are you sure you want to delete "' + name + '"? This action cannot be undone.',
        confirmText: 'Yes, Delete',
        type: 'danger',
        onConfirm: function () {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'delete_product.php';

            const inputId = document.createElement('input');
            inputId.type = 'hidden';
            inputId.name = 'id';
            inputId.value = id;

            const inputCsrf = document.createElement('input');
            inputCsrf.type = 'hidden';
            inputCsrf.name = 'csrf_token';
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            inputCsrf.value = csrfToken || '';

            form.appendChild(inputId);
            form.appendChild(inputCsrf);
            document.body.appendChild(form);
            form.submit();
        }
    });
}

// ---- Mobile Sidebar Toggle ----
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// ---- Public Mobile Menu Toggle ----
function openMobileMenu() {
    const drawer = document.getElementById('mobileMenuDrawer');
    const overlay = document.getElementById('mobileMenuOverlay');
    if (!drawer || !overlay) return false;

    drawer.hidden = false;
    overlay.hidden = false;
    window.requestAnimationFrame(function () {
        drawer.classList.add('show');
        overlay.classList.add('show');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('mobile-menu-active');
    });
    return true;
}

function closeMobileMenu() {
    const drawer = document.getElementById('mobileMenuDrawer');
    const overlay = document.getElementById('mobileMenuOverlay');
    if (!drawer || !overlay) return false;

    drawer.classList.remove('show');
    overlay.classList.remove('show');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mobile-menu-active');

    window.setTimeout(function () {
        if (!drawer.classList.contains('show')) drawer.hidden = true;
        if (!overlay.classList.contains('show')) overlay.hidden = true;
    }, 280);
    return true;
}

// ---- Mobile Nav Toggle ----
function toggleNav() {
    if (document.getElementById('mobileMenuDrawer')) {
        return openMobileMenu();
    }

    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('open');
    }
}

// (Stock Modal functions removed as HTML is currently not present)

// ---- Init on page load ----
document.addEventListener('DOMContentLoaded', function () {
    // Category dropdown init
    const catSelect = document.getElementById('category');
    const subCatSelect = document.getElementById('sub_category');
    if (catSelect && subCatSelect) {
        const preselected = subCatSelect.getAttribute('data-selected');
        catSelect.addEventListener('change', function () {
            updateSubCategory(catSelect, subCatSelect);
        });
        // If editing, populate subcategories
        if (catSelect.value) {
            updateSubCategory(catSelect, subCatSelect, preselected);
        }
    }

    // Image preview init
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', function () {
            previewImage(this, 'imagePreview');
        });
    }

    document.querySelectorAll('.admin-confirm-form').forEach(function (form) {
        form.addEventListener('submit', function (event) {
            if (form.dataset.confirmed === '1') {
                return true;
            }
            event.preventDefault();
            showAdminConfirm({
                title: form.dataset.confirmTitle || 'Confirm Action',
                message: form.dataset.confirmMessage || 'Are you sure you want to continue?',
                confirmText: form.dataset.confirmText || 'Confirm',
                type: form.dataset.confirmType || 'danger',
                onConfirm: function () {
                    form.dataset.confirmed = '1';
                    form.submit();
                }
            });
            return false;
        });
    });

    // (Modal overlay click listener removed)
});
// ---- Soft scroll reveal for customer-facing sections ----
document.addEventListener('DOMContentLoaded', function () {
    const revealItems = document.querySelectorAll('.reveal-on-scroll');
    if (!revealItems.length) return;

    if (!('IntersectionObserver' in window)) {
        revealItems.forEach(function (item) {
            item.classList.add('is-visible');
        });
        return;
    }

    const revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
    });

    revealItems.forEach(function (item) {
        revealObserver.observe(item);
    });
});

// ---- Cookie Banner ----
document.addEventListener('DOMContentLoaded', function () {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('cookieAcceptBtn');
    if (!banner || !acceptBtn) return;

    try {
        if (localStorage.getItem('mdb_cookie_accepted') !== 'yes') {
            banner.removeAttribute('hidden');
        }

        acceptBtn.addEventListener('click', function () {
            localStorage.setItem('mdb_cookie_accepted', 'yes');
            banner.setAttribute('hidden', 'hidden');
        });
    } catch (e) {
        banner.removeAttribute('hidden');
        acceptBtn.addEventListener('click', function () {
            banner.setAttribute('hidden', 'hidden');
        });
    }
});


// ---- Public mobile menu interactions ----
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('mobileMenuOverlay');
    const drawer = document.getElementById('mobileMenuDrawer');

    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }

    if (drawer) {
        drawer.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                closeMobileMenu();
            });
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeMobileMenu();
        }
    });
});

// ---- Desktop public account dropdown ----
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.nav-account-dropdown').forEach(function (dropdown) {
        const button = dropdown.querySelector('.nav-account-btn');
        if (!button) return;

        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            document.querySelectorAll('.nav-account-dropdown.open').forEach(function (openDropdown) {
                if (openDropdown !== dropdown) {
                    openDropdown.classList.remove('open');
                    const openButton = openDropdown.querySelector('.nav-account-btn');
                    if (openButton) openButton.setAttribute('aria-expanded', 'false');
                }
            });

            const isOpen = dropdown.classList.toggle('open');
            button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    document.addEventListener('click', function () {
        document.querySelectorAll('.nav-account-dropdown.open').forEach(function (dropdown) {
            dropdown.classList.remove('open');
            const button = dropdown.querySelector('.nav-account-btn');
            if (button) button.setAttribute('aria-expanded', 'false');
        });
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            document.querySelectorAll('.nav-account-dropdown.open').forEach(function (dropdown) {
                dropdown.classList.remove('open');
                const button = dropdown.querySelector('.nav-account-btn');
                if (button) button.setAttribute('aria-expanded', 'false');
            });
        }
    });
});
