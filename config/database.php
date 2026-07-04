<?php
/**
 * Supabase PostgreSQL database connection.
 * Real values are loaded from the project root .env file.
 */
require_once __DIR__ . '/env_loader.php';

$SUPABASE_DB_HOST = env('DB_HOST');
$SUPABASE_DB_PORT = env('DB_PORT', '5432');
$SUPABASE_DB_NAME = env('DB_NAME', 'postgres');
$SUPABASE_DB_USER = env('DB_USER');
$SUPABASE_DB_PASSWORD = env('DB_PASSWORD');

if (!$SUPABASE_DB_HOST || !$SUPABASE_DB_USER || !$SUPABASE_DB_PASSWORD) {
    die('Database configuration is missing. Please check your .env file.');
}

try {
    $dsn = "pgsql:host={$SUPABASE_DB_HOST};port={$SUPABASE_DB_PORT};dbname={$SUPABASE_DB_NAME};sslmode=require";

    $conn = new PDO($dsn, $SUPABASE_DB_USER, $SUPABASE_DB_PASSWORD, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // Keep date/time consistent with Malaysia time for your local project.
    $conn->exec("SET TIME ZONE 'Asia/Kuala_Lumpur'");

    // Alias for test files or pages that use $pdo instead of $conn.
    $pdo = $conn;

} catch (PDOException $e) {
    die('Database connection failed: ' . $e->getMessage());
}
?>
