<?php
function ensureCustomersTable(PDO $conn): void
{
    $conn->exec("CREATE TABLE IF NOT EXISTS customers (
        id BIGSERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password TEXT NOT NULL,
        google_id TEXT UNIQUE,
        auth_provider TEXT DEFAULT 'email',
        profile_picture TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )");

    $conn->exec("ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE");
    $conn->exec("ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email'");
    $conn->exec("ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_picture TEXT");
}

function customerLoggedIn(): bool
{
    return isset($_SESSION['customer_id']) || isset($_SESSION['user_id']);
}

function setCustomerSession(array $customer): void
{
    $_SESSION['customer_id'] = $customer['id'];
    $_SESSION['customer_name'] = $customer['full_name'];
    $_SESSION['customer_email'] = $customer['email'];
    $_SESSION['customer_role'] = 'customer';

    // Aliases for future pages that may use user_* naming.
    $_SESSION['user_id'] = $customer['id'];
    $_SESSION['user_name'] = $customer['full_name'];
    $_SESSION['user_email'] = $customer['email'];
    $_SESSION['user_role'] = 'customer';
}
