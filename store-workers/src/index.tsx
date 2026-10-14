import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { requireConfig, storeMapLink } from "./lib/config";
import { originCheck } from "./lib/csrf";
import { connectUncached, dbMiddleware } from "./lib/db";
import { flashMiddleware } from "./lib/flash";
import { deleteExpiredSessions } from "./lib/session";
import adminRoutes from "./routes/admin";
import publicRoutes from "./routes/public";
import type { AppEnv } from "./types";
import { ErrorPage } from "./views/ErrorPage";

const app = new Hono<AppEnv>();

app.use("*", requireConfig);
app.use(
  "*",
  secureHeaders({
    // Google Maps API key restrictions check the referring site, so it must be sent.
    referrerPolicy: "strict-origin-when-cross-origin",
    xFrameOptions: "DENY",
  }),
);
app.use("*", originCheck);
app.use("*", dbMiddleware);
app.use("*", flashMiddleware);

// Confirms the Worker can reach the database. Returns no shop data.
app.get("/_health", async (c) => {
  try {
    await c.var.db`SELECT 1`;
    return c.json({ db: "ok" });
  } catch (err) {
    console.error("Health check failed:", err);
    return c.json({ db: "error" }, 503);
  }
});

app.route("/admin", adminRoutes);
app.route("/", publicRoutes);

app.notFound((c) =>
  c.html(
    <ErrorPage
      status={404}
      title="Page not found"
      message="The page you were looking for doesn't exist or has moved."
      mapLink={storeMapLink(c.env)}
    />,
    404,
  ),
);

app.onError((err, c) => {
  const mapLink = storeMapLink(c.env);

  if (err instanceof HTTPException && err.status === 403) {
    return c.html(
      <ErrorPage
        status={403}
        title="Request blocked"
        message="This request was blocked for security reasons. Please go back, refresh the page and try again."
        mapLink={mapLink}
      />,
      403,
    );
  }
  if (err instanceof HTTPException && err.status < 500) {
    return err.getResponse();
  }

  // Never show error details (SQL, stack traces) to visitors. They go to the Worker logs.
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, err);
  return c.html(
    <ErrorPage
      status={500}
      title="Something went wrong"
      message="Sorry, something went wrong on our side. Please try again in a moment."
      mapLink={mapLink}
    />,
    500,
  );
});

export default {
  fetch: app.fetch,

  // Daily cron (see wrangler.jsonc): remove expired login sessions.
  async scheduled(_controller, env, _ctx) {
    const deleted = await deleteExpiredSessions(connectUncached(env));
    console.log(`Deleted ${deleted} expired session(s).`);
  },
} satisfies ExportedHandler<Env>;
