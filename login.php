<?php
session_start();
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/google_customer.php';
require_once __DIR__ . '/customer_helpers.php';

ensureCustomersTable($conn);

if (isset($_SESSION['customer_id'])) {
    header('Location: user_page.php');
    exit();
}

$error = $_SESSION['customer_login_error'] ?? '';
$success = $_SESSION['customer_success'] ?? '';
unset($_SESSION['customer_login_error'], $_SESSION['customer_success']);

$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');

    if ($email === '' || $password === '') {
        $error = 'Please enter your email and password.';
    } else {
        $stmt = $conn->prepare('SELECT * FROM customers WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $customer = $stmt->fetch();

        if ($customer && password_verify($password, $customer['password'])) {
            setCustomerSession($customer);
            header('Location: user_page.php');
            exit();
        }

        $error = 'Invalid email or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Customer Login - My Dream Bike</title>
    <link rel="stylesheet" href="assets/css/style.css?v=49">
</head>
<body>
<div class="login-container customer-auth-page">
    <div class="login-box customer-auth-box">
        <div class="auth-brand-logo"><img src="company_logo/ori.logo.png" alt="My Dream Bike"></div>
        <h2>Customer Login</h2>
        <p class="login-subtitle">Sign in to view your My Dream Bike account</p>

        <?php if ($success): ?>
            <div class="success-msg"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>
        <?php if ($error): ?>
            <div class="error-msg"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <form method="POST" action="">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="you@example.com" value="<?php echo htmlspecialchars($email); ?>" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter your password" required>
            </div>
            <button type="submit" class="btn-login">Login</button>
        </form>

        <div class="auth-divider"><span>OR</span></div>

        <a href="google_login.php" class="btn-google-auth">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Continue with Google
        </a>

        <a href="index.php" class="btn-guest-auth">Continue as Guest</a>

        <p class="auth-switch">Don't have an account? <a href="signup.php">Sign Up</a></p>
        <p class="auth-back"><a href="index.php">&larr; Back to Store</a></p>
    </div>
</div>
</body>
</html>
