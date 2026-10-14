-- ==========================================================
-- 0004 Login sessions for the Workers app
--
-- Replaces PHP's $_SESSION for logged-in admins and customers.
-- The browser cookie holds a random token; only its SHA-256 hash is
-- stored here, so a leaked copy of this table can't be used to log in.
-- ==========================================================

CREATE TABLE IF NOT EXISTS sessions (
  id_hash      TEXT PRIMARY KEY,
  user_type    TEXT NOT NULL CHECK (user_type IN ('admin', 'customer')),
  user_id      BIGINT NOT NULL,
  csrf_token   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_type, user_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
