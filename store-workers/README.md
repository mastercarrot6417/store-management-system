# store-workers

The Cloudflare Workers rewrite of the My Dream Bike store. The PHP site in the parent folder stays live until Phase 5 of [`../docs/REWRITE_PLAN.md`](../docs/REWRITE_PLAN.md).

## Commands

Run these from inside the `store-workers/` folder.

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally at http://localhost:8787, using the database in `.env` |
| `npm run dev:local` | Runs the Worker with a throwaway in-memory database, demo products and demo logins. No Supabase needed |
| `npm test` | Runs the automated tests (uses its own in-memory database, never Supabase) |
| `npm run typecheck` | Checks the TypeScript (app and tests) for errors |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc` |
| `npm run db:migrate` | Shows the target database and pending migrations (changes nothing) |
| `npm run db:migrate -- --apply` | Applies pending migrations |
| `npm run db:copy-catalogue` | Shows what would be copied from production into the dev database (reads production read-only; changes nothing) |
| `npm run db:copy-catalogue -- --apply` | Copies products, colours, images, sizes and stock history into the dev database. Add `--replace` to refresh an existing copy. Never copies customers or admins |
| `npm run deploy` | Deploys to Cloudflare |

## Phase 0 setup (needs your accounts)

### 1. Create a development Supabase project
1. In Supabase, create a new project in the **Southeast Asia (Singapore)** region. Free plan is fine. Call it something like `mydreambike-dev`.
2. Click **Connect** and copy the connection string.
3. Copy `.env.example` to `.env` and paste that string into the three database values.
4. Generate a `COOKIE_SECRET` with the command shown in `.env.example` and paste it in.

### 2. Create the tables in the dev project
```bash
npm run db:migrate
npm run db:migrate -- --apply
```
The first command only shows which database it will use and what's pending. Check that the database shown is the **dev** project before running the second one.

### 3. (Optional) Copy production data into dev
To test with real products, export the production data from Supabase (or use `pg_dump --data-only`) and import it into the dev project.

### 4. Run locally
```bash
npm run dev
```
Open http://localhost:8787/_health. It should show `{"db":"ok"}`.

### 5. Create the Cloudflare resources
```bash
npx wrangler login
npx wrangler r2 bucket create store-images
npx wrangler r2 bucket create store-images-dev
npx wrangler hyperdrive create store-db --connection-string="<dev connection string>"
npx wrangler hyperdrive create store-db-nocache --caching-disabled --connection-string="<dev connection string>"
```
Paste the two Hyperdrive IDs into `wrangler.jsonc` in place of `REPLACE_WITH_CACHED_HYPERDRIVE_ID` and `REPLACE_WITH_NOCACHE_HYPERDRIVE_ID`.

Until Phase 5, point both Hyperdrive configs at the **dev** database. They are switched to production at go-live.

### 6. Deploy the test page
Set the production cookie secret first (paste a newly generated value, not the one in `.env`):
```bash
npx wrangler secret put COOKIE_SECRET
```
Then deploy:
```bash
npm run deploy
```
Open `https://store-management-system.<your-subdomain>.workers.dev/_health`. It should show `{"db":"ok"}`.

## Migrations

- `0001_baseline_schema.sql`: all tables, columns, triggers and indexes. Replaces the `ensure…Schema()` code that the PHP site runs on every page load.
- `0002_colour_size_stock_rule.sql`: legacy stock clean-up and the "product + colour + size is unique" rule.
- `0003_enable_rls.sql`: turns on Row Level Security for every table.
- `0004_sessions.sql`: the `sessions` table for admin and customer logins in the new app.
- `0005_malaysia_timezone.sql`: makes Malaysia time the database default, so times saved by the new app match the times the PHP site saves.

All five are safe to run on production: they only add what's missing, and the PHP site already uses Malaysia time. The PHP site's own schema code has most likely already done the same work there. Run them on dev first anyway. Run them on production only when you're ready. Migration `0003` is the important security fix from the review, and it can be applied to production before go-live.

New database changes go in a new numbered file. Never edit a migration that has already been applied.

## How the app is organised

| Path | What's in it |
|---|---|
| `src/index.tsx` | App setup: security headers, CSRF origin check, database, error pages, daily cron |
| `src/routes/` | Pages: `public.tsx` (homepage, search, product, legal), `admin.tsx` (admin panel), `uploads.ts` (product images from R2), `legacy.ts` (redirects from old `.php` addresses) |
| `src/views/` | Layouts and page parts (navbar, footer, admin sidebar, error page) |
| `src/lib/products.ts` | Product queries for the shop (never selects boss-only prices) |
| `src/views/legal/` | Privacy, terms and cookie text (plain HTML, edit directly) |
| `src/lib/db.ts` | Database clients: `c.var.db` (uncached, the default) and `c.var.dbCached` (public catalogue only) |
| `src/lib/session.ts` | Admin and customer logins (cookie + `sessions` table) |
| `src/lib/csrf.tsx` | CSRF protection: origin check everywhere, plus a token on logged-in forms (`<CsrfField>`) |
| `src/lib/flash.ts` | One-time messages shown on the next page (`setFlash`) |
| `public/` | CSS, JS and images, copied from the PHP site |
| `test/` | Automated tests |

Admins and customers have separate login cookies. The admin one is only sent to `/admin` pages. Admin sessions end after 2 hours idle or 12 hours total; customer sessions after 30 days idle or 90 days total.

## Settings in wrangler.jsonc

| Setting | What it's for |
|---|---|
| `COMPANY_MAP_LINK` | Google Maps link for "Store Location" / "Visit Our Store". Empty = a search for the shop name |
| `COMPANY_MAP_QUERY` | What the homepage map shows (`MY DREAM BIKE SDN BHD`) |
| `GOOGLE_MAPS_API_KEY` | Maps Embed API key for the homepage map. Visible in the page, so restrict it to your domain in Google Cloud Console. Empty = a "Find us in-store" box |

## Product images

Images are served from R2 at the same paths the PHP site used (`/uploads/pimg_...jpg`), so the paths stored in the database don't change. Before go-live (Phase 5), copy everything in the PHP site's `uploads/` folder into the `store-images` bucket under `uploads/`.
