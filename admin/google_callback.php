<?php
session_start();
require_once '../config/database.php';
require_once '../config/google_oauth.php';
require_once 'includes/schema_helpers.php';
ensureBossPricingSchema($conn);

// Verify state to prevent CSRF
if (empty($_GET['state']) || empty($_SESSION['oauth_state']) || $_GET['state'] !== $_SESSION['oauth_state']) {
    $_SESSION['login_error'] = 'Invalid state parameter. Please try again.';
    header('Location: login.php');
    exit();
}

if (!empty($_GET['error'])) {
    $_SESSION['login_error'] = 'Google login cancelled or failed: ' . htmlspecialchars($_GET['error']);
    header('Location: login.php');
    exit();
}

$code = $_GET['code'] ?? null;
if (!$code) {
    $_SESSION['login_error'] = 'Authorization code not found.';
    header('Location: login.php');
    exit();
}

// Exchange auth code for access token
$accessToken = getGoogleAccessToken($code);
if (!$accessToken) {
    $_SESSION['login_error'] = 'Failed to obtain access token from Google.';
    header('Location: login.php');
    exit();
}

// Fetch user profile from Google using the access token
$userInfo = getGoogleUserInfo($accessToken);
if (!$userInfo || empty($userInfo['email'])) {
    $_SESSION['login_error'] = 'Failed to fetch user email from Google.';
    header('Location: login.php');
    exit();
}

$email = $userInfo['email'];
$email_verified = $userInfo['email_verified'] ?? false;

if (!$email_verified) {
    $_SESSION['login_error'] = 'Please use a verified Google account.';
    header('Location: login.php');
    exit();
}

// Check if this email exists in our admin table
$stmt = $conn->prepare("SELECT id, email, COALESCE(role, 'admin') AS role, COALESCE(NULLIF(display_name, ''), email) AS admin_name FROM admin WHERE email = ?");
$stmt->execute([$email]);
$admin = $stmt->fetch();

if ($admin) {
    // User is an admin, log them in
    $_SESSION['admin_id'] = $admin['id'];
    $_SESSION['admin_email'] = $admin['email'];
    $_SESSION['admin_role'] = $admin['role'] ?? 'admin';
    $_SESSION['admin_name'] = $admin['admin_name'] ?? $admin['email'];
    
    // Clear oauth state and any login errors
    unset($_SESSION['oauth_state']);
    unset($_SESSION['login_error']);
    
    header("Location: dashboard.php");
    exit();
} else {
    // User is not an admin
    $_SESSION['login_error'] = "Access Denied: The Google account ({$email}) is not registered as an administrator.";
    header('Location: login.php');
    exit();
}

$conn = null;
