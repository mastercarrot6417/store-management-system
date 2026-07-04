<?php
session_start();
if (!isset($_SESSION['admin_id'])) {
    header("Location: login.php");
    exit();
}

if (empty($_SESSION['admin_role'])) {
    $_SESSION['admin_role'] = 'admin';
}

if (!function_exists('isBossAdmin')) {
    function isBossAdmin(): bool
    {
        return isset($_SESSION['admin_role']) && $_SESSION['admin_role'] === 'boss';
    }
}

// Generate CSRF token if not exists
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
?>
