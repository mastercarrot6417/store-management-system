<?php
// =============================================
// Admin Google OAuth 2.0 Configuration
// Values are loaded from the project root .env file.
// =============================================

require_once __DIR__ . '/env_loader.php';

define('GOOGLE_CLIENT_ID', env('ADMIN_GOOGLE_CLIENT_ID', env('GOOGLE_CLIENT_ID', '')));
define('GOOGLE_CLIENT_SECRET', env('ADMIN_GOOGLE_CLIENT_SECRET', env('GOOGLE_CLIENT_SECRET', '')));
define('GOOGLE_REDIRECT_URI', env('ADMIN_GOOGLE_REDIRECT_URI', 'http://localhost/store_management/admin/google_callback.php'));

// Google OAuth endpoints
define('GOOGLE_AUTH_URL',  'https://accounts.google.com/o/oauth2/v2/auth');
define('GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token');
define('GOOGLE_USER_URL',  'https://www.googleapis.com/oauth2/v3/userinfo');

/**
 * Build the Google login URL with state (CSRF token)
 */
function getGoogleAuthUrl(): string {
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;

    $params = http_build_query([
        'client_id'     => GOOGLE_CLIENT_ID,
        'redirect_uri'  => GOOGLE_REDIRECT_URI,
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'access_type'   => 'online',
        'state'         => $state,
        'prompt'        => 'select_account',
    ]);

    return GOOGLE_AUTH_URL . '?' . $params;
}

/**
 * Exchange auth code for access token
 */
function getGoogleAccessToken(string $code): ?string {
    $postData = [
        'code'          => $code,
        'client_id'     => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET,
        'redirect_uri'  => GOOGLE_REDIRECT_URI,
        'grant_type'    => 'authorization_code',
    ];

    $ch = curl_init(GOOGLE_TOKEN_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($postData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

/**
 * Fetch Google user info using access token
 */
function getGoogleUserInfo(string $accessToken): ?array {
    $ch = curl_init(GOOGLE_USER_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
    ]);
    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true) ?: null;
}
