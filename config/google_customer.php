<?php
// =============================================
// Customer Google OAuth 2.0 Configuration
// Values are loaded from the project root .env file.
// =============================================

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/env_loader.php';

define('CUSTOMER_GOOGLE_CLIENT_ID', env('CUSTOMER_GOOGLE_CLIENT_ID', env('GOOGLE_CLIENT_ID', '')));
define('CUSTOMER_GOOGLE_CLIENT_SECRET', env('CUSTOMER_GOOGLE_CLIENT_SECRET', env('GOOGLE_CLIENT_SECRET', '')));
define('CUSTOMER_GOOGLE_REDIRECT_URI', env('CUSTOMER_GOOGLE_REDIRECT_URI', env('GOOGLE_CALLBACK_URL', 'http://localhost/store_management/google_callback.php')));

define('CUSTOMER_GOOGLE_AUTH_URL', 'https://accounts.google.com/o/oauth2/v2/auth');
define('CUSTOMER_GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token');
define('CUSTOMER_GOOGLE_USER_URL', 'https://www.googleapis.com/oauth2/v3/userinfo');

function getCustomerGoogleAuthUrl(): string
{
    $state = bin2hex(random_bytes(16));
    $_SESSION['customer_oauth_state'] = $state;

    $params = http_build_query([
        'client_id' => CUSTOMER_GOOGLE_CLIENT_ID,
        'redirect_uri' => CUSTOMER_GOOGLE_REDIRECT_URI,
        'response_type' => 'code',
        'scope' => 'openid email profile',
        'access_type' => 'online',
        'state' => $state,
        'prompt' => 'select_account',
    ]);

    return CUSTOMER_GOOGLE_AUTH_URL . '?' . $params;
}

function getCustomerGoogleAccessToken(string $code): ?string
{
    $postData = [
        'code' => $code,
        'client_id' => CUSTOMER_GOOGLE_CLIENT_ID,
        'client_secret' => CUSTOMER_GOOGLE_CLIENT_SECRET,
        'redirect_uri' => CUSTOMER_GOOGLE_REDIRECT_URI,
        'grant_type' => 'authorization_code',
    ];

    $ch = curl_init(CUSTOMER_GOOGLE_TOKEN_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($postData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

function getCustomerGoogleUserInfo(string $accessToken): ?array
{
    $ch = curl_init(CUSTOMER_GOOGLE_USER_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true) ?: null;
}
