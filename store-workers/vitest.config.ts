import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { TEST_DB_URL } from "./test/test-db";

// Tests run against a throwaway in-memory Postgres (PGlite) started by
// test/global-setup.ts, never against Supabase.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = TEST_DB_URL;
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_NOCACHE = TEST_DB_URL;

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: { COOKIE_SECRET: "test-only-cookie-secret-at-least-32-characters-long" },
        hyperdrives: { HYPERDRIVE: TEST_DB_URL, HYPERDRIVE_NOCACHE: TEST_DB_URL },
      },
    }),
  ],
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    // The "database is down" tests make postgres.js fail to connect on purpose. The
    // library leaves that rejection unhandled (the app still catches the query
    // error and shows its error page). Ignore only that exact message.
    onUnhandledError(error) {
      return !error.message?.includes("proxy request failed, cannot connect to the specified address");
    },
  },
});
