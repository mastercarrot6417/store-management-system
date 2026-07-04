CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password TEXT NOT NULL,
    google_id TEXT UNIQUE,
    auth_provider TEXT DEFAULT 'email',
    profile_picture TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_picture TEXT;
