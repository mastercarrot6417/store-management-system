import { Hono } from "hono";
import { getDb } from "./lib/db";

const app = new Hono<{ Bindings: Env }>();

// Phase 0 test page: confirms the Worker deploys and runs.
app.get("/", (c) => c.text("My Dream Bike: store-workers is running."));

// Confirms the Worker can reach Supabase through Hyperdrive.
// Returns no shop data, only whether the connection works.
app.get("/_health", async (c) => {
  const sql = getDb(c.env);
  try {
    await sql`SELECT 1`;
    return c.json({ db: "ok" });
  } catch (err) {
    console.error("Health check failed:", err);
    return c.json({ db: "error" }, 503);
  } finally {
    c.executionCtx.waitUntil(sql.end());
  }
});

export default app;
