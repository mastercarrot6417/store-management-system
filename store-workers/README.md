# store-workers

The Cloudflare Workers rewrite of the My Dream Bike store. The PHP site in the parent folder stays live until Phase 5 of [`../docs/REWRITE_PLAN.md`](../docs/REWRITE_PLAN.md).

## Commands

Run these from inside the `store-workers/` folder.

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally at http://localhost:8787 |
| `npm run typecheck` | Checks the TypeScript for errors |
| `npm run cf-typegen` | Regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc` |
| `npm run db:migrate` | Shows the target database and pending migrations (changes nothing) |
| `npm run db:migrate -- --apply` | Applies pending migrations |
| `npm run deploy` | Deploys to Cloudflare |

## Phase 0 setup (needs your accounts)

### 1. Create a development Supabase project
1. In Supabase, create a new project in the **Southeast Asia (Singapore)** region. Free plan is fine. Call it something like `mydreambike-dev`.
2. Click **Connect** and copy the connection string.
3. Copy `.env.example` to `.env` and paste that string into all three values.

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
```bash
npm run deploy
```
Open `https://store-workers.<your-subdomain>.workers.dev/_health`. It should show `{"db":"ok"}`.

## Migrations

- `0001_baseline_schema.sql`: all tables, columns, triggers and indexes. Replaces the `ensure…Schema()` code that the PHP site runs on every page load.
- `0002_colour_size_stock_rule.sql`: legacy stock clean-up and the "product + colour + size is unique" rule.
- `0003_enable_rls.sql`: turns on Row Level Security for every table.

All three are safe to run on production: they only add what's missing. The PHP site's own schema code has most likely already done the same work there. Run them on dev first anyway. Run them on production only when you're ready. Migration `0003` is the important security fix from the review, and it can be applied to production before go-live.

New database changes go in a new numbered file. Never edit a migration that has already been applied.
