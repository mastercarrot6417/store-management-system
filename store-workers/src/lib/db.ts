import postgres from "postgres";

/**
 * Open a Postgres client for one request.
 *
 * Use `cached: true` only for public pages that are allowed to show data a
 * few seconds old (home page, product listing). Anything that reads or writes
 * stock, orders or admin data must use the uncached connection.
 */
export function getDb(env: Env, { cached = false }: { cached?: boolean } = {}) {
  const hyperdrive = cached ? env.HYPERDRIVE : env.HYPERDRIVE_NOCACHE;

  return postgres(hyperdrive.connectionString, {
    // Hyperdrive pools connections itself; keep the per-request pool small.
    max: 5,
    // Skips an extra round trip on connect; we don't use custom Postgres types.
    fetch_types: false,
  });
}
