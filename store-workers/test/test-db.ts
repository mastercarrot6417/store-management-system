/** Address of the PGlite test database started by global-setup.ts. */
export const TEST_DB_PORT = 54329;
export const TEST_DB_URL = `postgres://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres`;

/** A table that only exists in the test database. Tests refuse to run if it's missing. */
export const TEST_DB_MARKER_TABLE = "test_database_marker";
