import postgres from "postgres";
import { createMiddleware } from "hono/factory";

export type Sql = postgres.Sql;

export type DbVariables = {
  /** Uncached. Use for stock, orders, admin, sessions: anything that must be current. */
  db: Sql;
  /** Cached for a short time by Hyperdrive. Only for public catalogue reads. */
  dbCached: Sql;
};

/** Postgres type ID for TIMESTAMP WITHOUT TIME ZONE. */
const TIMESTAMP_WITHOUT_TZ = 1114;

function connect(connectionString: string): Sql {
  return postgres(connectionString, {
    // Hyperdrive pools connections itself; keep the per-request pool small.
    max: 5,
    // Skips an extra round trip on connect; we don't use custom Postgres types.
    fetch_types: false,
    types: {
      // Existing tables store Malaysia wall-clock time in TIMESTAMP WITHOUT TIME ZONE
      // columns. Return those values as written ("2026-07-08 17:59:00") instead of
      // letting them be reinterpreted through the Worker's UTC clock.
      malaysiaLocalTime: {
        to: TIMESTAMP_WITHOUT_TZ,
        from: [TIMESTAMP_WITHOUT_TZ],
        serialize: (value: string) => value,
        parse: (value: string) => value,
      },
    },
  });
}

/**
 * Gives each request its own database clients as `c.var.db` and
 * `c.var.dbCached`. postgres.js only connects on the first query, so a
 * request that never touches the database never opens a connection.
 *
 * Connections are not closed with sql.end(): the Workers runtime closes them
 * when the request finishes (as in Cloudflare's Hyperdrive examples), and
 * postgres.js 3.4.9's sql.end() leaves a rejected socket read behind that
 * shows up as an "Uncaught (in promise)" error in the logs.
 */
export const dbMiddleware = createMiddleware<{ Bindings: Env; Variables: DbVariables }>(
  async (c, next) => {
    c.set("db", connect(c.env.HYPERDRIVE_NOCACHE.connectionString));
    c.set("dbCached", connect(c.env.HYPERDRIVE.connectionString));
    await next();
  },
);

/** Opens an uncached client outside a request (for example, the daily cron job). */
export function connectUncached(env: Env): Sql {
  return connect(env.HYPERDRIVE_NOCACHE.connectionString);
}
