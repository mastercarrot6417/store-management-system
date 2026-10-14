// Replaces product images that fail to load with a "No Image" box.
// An <img> opts in with data-fallback-class (and optional data-fallback-text /
// data-fallback-style). Replaces the inline onerror="..." handlers from the PHP pages.
document.addEventListener('error', function (event) {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallbackClass) return;
    const box = document.createElement('div');
    box.className = img.dataset.fallbackClass;
    box.textContent = img.dataset.fallbackText || '';
    if (img.dataset.fallbackStyle) box.setAttribute('style', img.dataset.fallbackStyle);
    img.replaceWith(box);
}, true);
