import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { TEST_DB_MARKER_TABLE, TEST_DB_PORT } from "./test-db";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/**
 * Starts an in-memory Postgres (PGlite) with all migrations applied and
 * exposes it on localhost, so the Worker under test connects to it the same
 * way it connects to Supabase through Hyperdrive.
 */
export default async function setup() {
  const db = await PGlite.create();

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  await db.exec(`CREATE TABLE ${TEST_DB_MARKER_TABLE} (id INTEGER)`);

  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: TEST_DB_PORT, maxConnections: 20 });
  await server.start();

  return async () => {
    await server.stop();
    await db.close();
  };
}
