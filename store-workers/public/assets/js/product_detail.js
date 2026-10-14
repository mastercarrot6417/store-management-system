// Product page: colour / size / image switching and the "Discover more" carousel.
// Ported from the inline script in product_detail.php. Product data comes from the
// <script type="application/json" id="product-data"> block rendered by the server.
(function () {
    const dataEl = document.getElementById('product-data');
    if (!dataEl) return;
    const data = JSON.parse(dataEl.textContent);

    let currentColorKey = data.defaultColorKey;
    let currentImageIndex = 0;

    function imagesForColor() {
        return data.imagesByColor[currentColorKey] || [];
    }

    function setSizeMessage(text, type) {
        const message = document.getElementById('sizeAvailabilityMessage');
        if (!message) return;
        message.textContent = text;
        message.classList.remove('warning', 'danger');
        if (type) message.classList.add(type);
    }

    function selectSize(size, btn) {
        if (btn && btn.disabled) return;
        document.querySelectorAll('.simple-size-btn').forEach(function (b) { b.classList.remove('active'); });
        if (btn) btn.classList.add('active');
        const selectedSizeText = document.getElementById('selectedSizeText');
        if (selectedSizeText) selectedSizeText.textContent = size;
    }

    function renderSizes() {
        const row = document.getElementById('simpleSizeRow');
        const selectedSizeText = document.getElementById('selectedSizeText');
        if (!row) return;

        const sizes = data.sizesByColor[currentColorKey] || (data.hasColours ? [] : (data.sizesByColor['default'] || []));
        row.innerHTML = '';
        let firstAvailable = null;

        sizes.forEach(function (item) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'simple-size-btn';
            btn.dataset.size = item.label;
            btn.textContent = item.label;
            btn.title = item.quantity > 0 ? item.label + ' - ' + item.quantity + ' available' : item.label + ' - Out of stock';
            if (item.quantity > 0) {
                if (!firstAvailable) firstAvailable = item.label;
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

    function renderImages() {
        const images = imagesForColor();
        const main = document.getElementById('mainProductImage');
        const strip = document.getElementById('thumbStrip');

        if (images.length > 0 && main && main.tagName === 'IMG') {
            main.src = images[currentImageIndex].src;
            main.alt = images[currentImageIndex].alt || data.productName;
        }

        if (strip) {
            strip.innerHTML = '';
            images.forEach(function (img, idx) {
                const el = document.createElement('img');
                el.src = img.src;
                el.alt = img.alt || 'Product image';
                el.dataset.imageIndex = String(idx);
                if (idx === currentImageIndex) el.classList.add('active');
                strip.appendChild(el);
            });
        }

        const selectedColorText = document.getElementById('selectedColorText');
        if (selectedColorText && data.colorNames[currentColorKey]) {
            selectedColorText.textContent = data.colorNames[currentColorKey];
        }
    }

    function selectColor(colorKey) {
        currentColorKey = colorKey;
        currentImageIndex = 0;
        document.querySelectorAll('.simple-color-dot').forEach(function (dot) {
            dot.classList.toggle('active', dot.dataset.colorId === colorKey);
        });
        renderImages();
        renderSizes();
    }

    function stepImage(direction) {
        const images = imagesForColor();
        if (!images.length) return;
        currentImageIndex = (currentImageIndex + direction + images.length) % images.length;
        renderImages();
    }

    // One click handler for colour dots, size buttons, thumbnails and prev/next.
    document.addEventListener('click', function (event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const dot = target.closest('.simple-color-dot');
        if (dot) return selectColor(dot.dataset.colorId);

        const sizeBtn = target.closest('.simple-size-btn');
        if (sizeBtn) return selectSize(sizeBtn.dataset.size, sizeBtn);

        const thumb = target.closest('#thumbStrip img');
        if (thumb) {
            currentImageIndex = Number(thumb.dataset.imageIndex) || 0;
            return renderImages();
        }

        const step = target.closest('[data-image-step]');
        if (step) return stepImage(Number(step.dataset.imageStep));
    });

    // ---- Discover more carousel ----
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
        discoverPrev.addEventListener('click', function () { scrollDiscover(-1); });
        discoverNext.addEventListener('click', function () { scrollDiscover(1); });
        discoverTrack.addEventListener('scroll', updateDiscoverArrows, { passive: true });
        window.addEventListener('load', updateDiscoverArrows);
        window.addEventListener('resize', updateDiscoverArrows);
        updateDiscoverArrows();
    }
})();
