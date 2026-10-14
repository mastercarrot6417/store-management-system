# store-workers

The Cloudflare Workers rewrite of the My Dream Bike store. The PHP site in the parent folder stays live until Phase 5 of [`../docs/REWRITE_PLAN.md`](../docs/REWRITE_PLAN.md).

## Commands

Run these from inside the `store-workers/` folder.

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally at http://localhost:8787, using the database in `.env` |
| `npm run dev:local` | Runs the Worker with a throwaway in-memory database, demo products and demo logins (`demo-boss@local.test` / `demo-customer@local.test`, password `demo-password`). No Supabase needed |
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
2. Click **Connect** and copy the **Session pooler** connection string.
3. Copy `.env.example` to `.env` and paste that string into the three database values.
4. Generate a `COOKIE_SECRET` with the command shown in `.env.example` and paste it in.

### 2. Create the tables in the dev project
```bash
npm run db:migrate
npm run db:migrate -- --apply
```
The first command only shows which database it will use and what's pending. Check that the database shown is the **dev** project before running the second one.

### 3. Copy the product catalogue into dev
```bash
npm run db:copy-catalogue
npm run db:copy-catalogue -- --apply
```

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
Put the two Hyperdrive IDs into `wrangler.jsonc`.

Until Phase 5, point both Hyperdrive configs at the **dev** database. They are switched to production at go-live.

### 6. Deploy
Set the production cookie secret first (a newly generated value, not the one in `.env`):
```bash
npx wrangler secret put COOKIE_SECRET
```
Pushing to GitHub then builds the Worker (Workers Builds, root directory `store-workers`). Branch builds upload a version with its own preview link: `https://<version>-store-management-system.<your-subdomain>.workers.dev`.

## Migrations

- `0001_baseline_schema.sql`: all tables, columns, triggers and indexes, matching production. Replaces the `ensure…Schema()` code that the PHP site runs on every page load.
- `0002_colour_size_stock_rule.sql`: legacy stock clean-up and the "product + colour + size is unique" rule.
- `0003_enable_rls.sql`: turns on Row Level Security for every table.
- `0004_sessions.sql`: the `sessions` table for admin and customer logins in the new app.
- `0005_malaysia_timezone.sql`: makes Malaysia time the database default, so times saved by the new app match the times the PHP site saves.
- `0006_product_archive.sql`: adds `products.archived_at`, used by the new admin's "Archive" (replaces "Delete"). The admin pages need it.

All six are safe to run on production: they only add what's missing, and the PHP site already uses Malaysia time. Run them on dev first, and on production only when you're ready.

New database changes go in a new numbered file. Never edit a migration that has already been applied.

## How the app is organised

| Path | What's in it |
|---|---|
| `src/index.tsx` | App setup: security headers, CSRF origin check, database, error pages, daily cron |
| `src/routes/` | Pages: `public.tsx` (homepage, search, product, legal), `account.tsx` (customer login, sign-up, account, Google login), `admin.tsx` (admin login, dashboard, and the admin sections below), `uploads.ts` (product images from R2), `legacy.ts` (redirects from old `.php` addresses) |
| `src/routes/admin/` | Admin sections: `products.tsx` (list, add, edit, archive), `colours.tsx` (colours and photo uploads), `stock.tsx` (Stock In / Out), `reports.tsx` (stock report, CSV, print) |
| `src/lib/admin/` | Admin queries: products, colours, `inventory.ts` (Stock In / Out transactions), dashboard, stock report |
| `src/lib/images.ts` | Photo uploads to R2 (type checked from the file's contents, max 5 MB, 5 per upload) |
| `src/views/` | Layouts and page parts (navbar, footer, admin sidebar, login pages, error page) |
| `src/views/legal/` | Privacy, terms and cookie text (plain HTML, edit directly) |
| `src/lib/products.ts` | Product queries for the shop (never selects boss-only prices) |
| `src/lib/accounts.ts` | Customer and admin account queries |
| `src/lib/passwords.ts` | Password hashing compatible with PHP (`$2y$` bcrypt hashes work in both sites) |
| `src/lib/google.ts` | "Continue with Google" for customers and admins |
| `src/lib/rate-limit.ts` | Limits login and sign-up attempts |
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
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for "Continue with Google". Also set the `GOOGLE_CLIENT_SECRET` secret. Empty = Google buttons are hidden |
| `GOOGLE_MAPS_API_KEY` | Maps Embed API key for the homepage map. Visible in the page, so restrict it to your domain in Google Cloud Console. Empty = a "Find us in-store" box |

## Product images

Images are served from R2 at the same paths the PHP site used (`/uploads/pimg_...jpg`), so the paths stored in the database don't change. Before go-live (Phase 5), copy everything in the PHP site's `uploads/` folder into the `store-images` bucket under `uploads/`.

## Admin panel

| Page | Address |
|---|---|
| Dashboard | `/admin` |
| Products (and archived products) | `/admin/products`, `/admin/products?view=archived` |
| Add / edit product | `/admin/products/new`, `/admin/products/<id>/edit` |
| Colours & images | `/admin/products/<id>/colours` |
| Stock In / Stock Out | `/admin/stock/in`, `/admin/stock/out` |
| Stock report, CSV, print | `/admin/reports/stock`, `/admin/reports/stock/export.csv`, `/admin/reports/stock/print` |

The old `admin/*.php` addresses redirect to these.

Differences from the PHP admin:

- **Archive instead of delete** (boss only). The PHP "Delete" removed the product's stock rows and its whole stock history. Archiving keeps everything; the product is hidden from the shop (status Hidden, so the PHP site hides it too), from the product list and from Stock In / Out. Restore it from the Archived tab.
- **Boss-only prices stay boss-only everywhere.** Staff admins no longer see the online sell price on the product list, the stock report or its CSV / print (the PHP pages showed it there).
- **Stock In / Out lock the product** while saving, so two people moving stock at once can't lose a change or take stock below zero. Quantities are capped at 100,000 per movement, and the reason must be one from the list.
- **Colour codes** must be `#` plus 6 hex digits on every save (the PHP page accepted anything when adding).
- **Photos** are checked by their contents, not the file name, so only real JPEG, PNG, GIF and WebP images are stored. Deleting a photo or colour also deletes the file from R2 (unless another row still uses the same path).
- **Categories** come from the shop menus (`src/lib/catalog.ts`), so every new product appears under a menu. Older products keep their saved category.

## Logins

- **Workers Paid plan needed.** Checking a password (bcrypt, same as the PHP site) takes about 50ms of CPU. The free plan allows 10ms per request, so password logins would fail there. Google login works on either plan.
- **Existing passwords keep working.** PHP's `$2y$` hashes are checked as they are, and new accounts are saved in the same format, so both sites accept each other's passwords during the switch.
- **Rate limiting:** at most 10 login or sign-up attempts per minute per IP address and per email (`LOGIN_LIMITER` in wrangler.jsonc).
- **Google login setup:** in Google Cloud Console, create (or reuse) an OAuth client and add these Authorized redirect URIs for each site address you use:
  - `https://<site>/auth/google/callback`
  - `https://<site>/admin/auth/google/callback`

  Then put the client ID in `GOOGLE_CLIENT_ID` (wrangler.jsonc) and set the secret with `npx wrangler versions secret put GOOGLE_CLIENT_SECRET`. Per-version preview links change on every build, so Google login only works on fixed addresses (localhost and your real domain).
