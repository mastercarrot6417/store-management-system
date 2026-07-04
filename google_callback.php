<?php
session_start();
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/google_customer.php';
require_once __DIR__ . '/customer_helpers.php';

ensureCustomersTable($conn);

if (empty($_GET['state']) || empty($_SESSION['customer_oauth_state']) || $_GET['state'] !== $_SESSION['customer_oauth_state']) {
    $_SESSION['customer_login_error'] = 'Invalid Google login request. Please try again.';
    header('Location: login.php');
    exit();
}

if (!empty($_GET['error'])) {
    $_SESSION['customer_login_error'] = 'Google login cancelled or failed.';
    header('Location: login.php');
    exit();
}

$code = $_GET['code'] ?? null;
if (!$code) {
    $_SESSION['customer_login_error'] = 'Google authorization code was not found.';
    header('Location: login.php');
    exit();
}

$accessToken = getCustomerGoogleAccessToken($code);
if (!$accessToken) {
    $_SESSION['customer_login_error'] = 'Unable to get Google access token. Please check your Client Secret and Redirect URI.';
    header('Location: login.php');
    exit();
}

$userInfo = getCustomerGoogleUserInfo($accessToken);
if (!$userInfo || empty($userInfo['email'])) {
    $_SESSION['customer_login_error'] = 'Unable to get your Google account details.';
    header('Location: login.php');
    exit();
}

if (isset($userInfo['email_verified']) && !$userInfo['email_verified']) {
    $_SESSION['customer_login_error'] = 'Please use a verified Google account.';
    header('Location: login.php');
    exit();
}

$googleId = $userInfo['sub'] ?? null;
$email = $userInfo['email'];
$name = $userInfo['name'] ?? $email;
$picture = $userInfo['picture'] ?? null;

if (!$googleId) {
    $_SESSION['customer_login_error'] = 'Google account ID was not found.';
    header('Location: login.php');
    exit();
}

$stmt = $conn->prepare('SELECT * FROM customers WHERE google_id = ? OR email = ? LIMIT 1');
$stmt->execute([$googleId, $email]);
$customer = $stmt->fetch();

if ($customer) {
    $update = $conn->prepare("UPDATE customers SET google_id = ?, auth_provider = 'google', profile_picture = ?, full_name = COALESCE(NULLIF(full_name, ''), ?) WHERE id = ?");
    $update->execute([$googleId, $picture, $name, $customer['id']]);

    $stmt = $conn->prepare('SELECT * FROM customers WHERE id = ? LIMIT 1');
    $stmt->execute([$customer['id']]);
    $customer = $stmt->fetch();
} else {
    $randomPassword = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $insert = $conn->prepare("INSERT INTO customers (full_name, email, phone, password, google_id, auth_provider, profile_picture) VALUES (?, ?, '', ?, ?, 'google', ?) RETURNING *");
    $insert->execute([$name, $email, $randomPassword, $googleId, $picture]);
    $customer = $insert->fetch();
}

setCustomerSession($customer);
unset($_SESSION['customer_oauth_state'], $_SESSION['customer_login_error']);

header('Location: user_page.php');
exit();
