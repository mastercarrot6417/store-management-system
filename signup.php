<?php
session_start();
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/customer_helpers.php';

ensureCustomersTable($conn);

if (isset($_SESSION['customer_id'])) {
    header('Location: user_page.php');
    exit();
}

$error = '';
$full_name = '';
$email = '';
$phone = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $full_name = trim($_POST['full_name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $password = trim($_POST['password'] ?? '');
    $confirm_password = trim($_POST['confirm_password'] ?? '');

    if ($full_name === '' || $email === '' || $password === '' || $confirm_password === '') {
        $error = 'Please fill in all required fields.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Please enter a valid email address.';
    } elseif (strlen($password) < 6) {
        $error = 'Password must be at least 6 characters.';
    } elseif ($password !== $confirm_password) {
        $error = 'Password and confirm password do not match.';
    } else {
        $check = $conn->prepare('SELECT id FROM customers WHERE email = ? LIMIT 1');
        $check->execute([$email]);

        if ($check->fetch()) {
            $error = 'This email is already registered. Please login instead.';
        } else {
            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $conn->prepare("INSERT INTO customers (full_name, email, phone, password, auth_provider) VALUES (?, ?, ?, ?, 'email')");
            $stmt->execute([$full_name, $email, $phone, $hashed]);

            $_SESSION['customer_success'] = 'Account created successfully. Please login.';
            header('Location: login.php');
            exit();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Customer Sign Up - My Dream Bike</title>
    <link rel="stylesheet" href="assets/css/style.css?v=49">
</head>
<body>
<div class="login-container customer-auth-page">
    <div class="login-box customer-auth-box">
        <div class="auth-brand-logo"><img src="company_logo/ori.logo.png" alt="My Dream Bike"></div>
        <h2>Create Account</h2>
        <p class="login-subtitle">Join My Dream Bike for a faster shopping experience</p>

        <?php if ($error): ?>
            <div class="error-msg"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <form method="POST" action="">
            <div class="form-group">
                <label for="full_name">Full Name *</label>
                <input type="text" id="full_name" name="full_name" placeholder="Your full name" value="<?php echo htmlspecialchars($full_name); ?>" required>
            </div>
            <div class="form-group">
                <label for="email">Email Address *</label>
                <input type="email" id="email" name="email" placeholder="you@example.com" value="<?php echo htmlspecialchars($email); ?>" required>
            </div>
            <div class="form-group">
                <label for="phone">Phone Number</label>
                <input type="text" id="phone" name="phone" placeholder="01X-XXX XXXX" value="<?php echo htmlspecialchars($phone); ?>">
            </div>
            <div class="form-group">
                <label for="password">Password *</label>
                <input type="password" id="password" name="password" placeholder="At least 6 characters" required>
            </div>
            <div class="form-group">
                <label for="confirm_password">Confirm Password *</label>
                <input type="password" id="confirm_password" name="confirm_password" placeholder="Retype your password" required>
            </div>
            <button type="submit" class="btn-login">Create Account</button>
        </form>

        <div class="auth-divider"><span>OR</span></div>
        <a href="google_login.php" class="btn-google-auth">Continue with Google</a>
        <a href="index.php" class="btn-guest-auth">Continue as Guest</a>

        <p class="auth-switch">Already have an account? <a href="login.php">Login</a></p>
        <p class="auth-back"><a href="index.php">&larr; Back to Store</a></p>
    </div>
</div>
</body>
</html>
