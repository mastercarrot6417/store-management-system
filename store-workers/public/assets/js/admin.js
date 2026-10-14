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
