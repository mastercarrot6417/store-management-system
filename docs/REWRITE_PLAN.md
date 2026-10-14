# Rewrite Plan: PHP → Cloudflare Workers

**Created:** 2026-10-14
**Goal:** Rewrite My Dream Bike Store Management System from PHP to TypeScript on Cloudflare Workers, then add the purchase function.
**Estimate:** about 14 weeks full-time for one developer (roughly double if part-time).

The main idea: keep the existing Supabase Postgres database and its data exactly as they are, and only replace the PHP code. Most SQL queries can be copied over almost unchanged, and no data migration is needed.

---

## 1. The tools to use

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | Catches mistakes before they reach the live site |
| Framework | **Hono**, with pages built on the server using JSX | Works like the PHP does now: request comes in, run SQL, send back HTML. The existing `style.css`, `admin.css` and `app.js` can be reused almost unchanged. |
| Database | **Keep Supabase Postgres**, connected through **Hyperdrive** with the `postgres` (postgres.js) package | Same data and the same SQL. Stock In/Out row locking (`FOR UPDATE`) keeps working. |
| Product images | **Cloudflare R2** | Keep the same file names (`uploads/pimg_…jpg`) so the `image_path` values in the database don't need changing |
| Static files | Workers Static Assets (a `public/` folder) | Serves CSS, JS and logos |
| Login sessions | A `sessions` table in Postgres, with an `HttpOnly; Secure; SameSite=Lax` cookie | Replaces PHP's `$_SESSION`. Don't use Cloudflare KV for this: it can take up to a minute to update, so a logout might not take effect straight away. |
| Passwords | `bcryptjs` | Can check the existing PHP password hashes, so nobody has to reset their password |
| Google login | Plain `fetch` calls, the same steps as the current PHP | Small and easy to port |
| Rate limiting | Workers Rate Limiting binding | Limits repeated login attempts |
| Emails | Resend or a similar service (free tier) | Order receipts |
| Admin protection | **Cloudflare Access** on `/admin/*` | Only approved staff emails can even reach the admin login page |
| Tests | Vitest with `@cloudflare/vitest-pool-workers` | Runs tests in the same environment as the live site |

### Technical points to know before starting

- **Turn off Hyperdrive's query cache for admin, stock and checkout pages.** Hyperdrive can cache the results of read queries. If it does, staff may see the old quantity after a Stock In, or a customer may buy something that is already sold out. Use one Hyperdrive config with caching for the public pages and a second one with caching off for everything that touches stock.
- **Existing passwords:** PHP's password hashes start with `$2y$`. Before checking a password, change that prefix to `$2a$` in memory only (it's the same algorithm). Keep the stored hashes unchanged. Test this with a few real hashes from the `admin` table before relying on it.
- **Which Supabase connection string to give Hyperdrive:** Hyperdrive does its own connection pooling, so use Supabase's direct connection. Follow Cloudflare's Supabase guide for the details.
- **Region:** the Supabase project should be in the Singapore region so pages load quickly in Malaysia.
- **Don't test on the real shop data.** Create a separate free Supabase project for development, and load the schema plus a copy of the data into it.

---

## 2. Folder structure

```text
store-workers/
├── wrangler.jsonc          # Hyperdrive, R2 and rate-limit settings
├── migrations/             # all database changes as SQL files, run once (no more ensure…Schema)
├── public/                 # style.css, admin.css, app.js, logos (copied from the PHP project)
└── src/
    ├── index.ts            # Hono app and route list
    ├── lib/                # db.ts, session.ts, csrf.ts, auth.ts, google.ts, r2.ts
    ├── views/              # layouts and components (header, footer, mobile menu)
    ├── routes/public/      # home, product, login, signup, account, legal pages
    ├── routes/admin/       # dashboard, products, colours, stock, reports
    └── routes/shop/        # cart, checkout, payment callback, orders (Phase 6)
```

---

## 3. Where each PHP page goes

| Current PHP | New route |
|---|---|
| `index.php` | `GET /` |
| `product_detail.php?id=` | `GET /product/:id` |
| `login.php`, `signup.php`, `logout.php`, `user_page.php` | `/login`, `/signup`, `/logout`, `/account` |
| `google_login.php`, `google_callback.php` | `/auth/google`, `/auth/google/callback` |
| `legal/*.php` | `/legal/cookies`, `/legal/privacy`, `/legal/terms` |
| `admin/dashboard.php` | `/admin` |
| `admin/products.php`, `add_product.php`, `edit_product.php`, `delete_product.php` | `/admin/products` (list, new, edit, archive) |
| `admin/manage_product_colors.php` | `/admin/products/:id/colours` (image uploads go to R2) |
| `admin/stock_in.php`, `stock_out.php` | `/admin/stock/in`, `/admin/stock/out` |
| `admin/stock_report.php`, `export_stock_report.php`, `print_stock_report.php` | `/admin/reports/stock` (plus `.csv` and print versions) |

Also add redirects from the old `.php` addresses (for example `product_detail.php?id=5` → `/product/5`) so existing links and Google search results keep working.

---

## 4. Phases

### Phase 0: Setup (week 1)
- [ ] Learn the basics of TypeScript and Hono (if new)
- [ ] Create the development Supabase project and load the schema plus a copy of the data
- [x] Move all the `ensure…Schema()` / `ensureCustomersTable()` code into migration files (`store-workers/migrations/0001`, `0002`)
- [x] Write the RLS migration (`store-workers/migrations/0003_enable_rls.sql`)
- [ ] Apply the migrations to the dev project (`npm run db:migrate -- --apply`)
- [x] Set up the `store-workers/` project: Hono, postgres.js, wrangler config with two Hyperdrive bindings and R2, migration runner
- [ ] Create the Hyperdrive configs and R2 buckets in Cloudflare, and paste the IDs into `wrangler.jsonc` (see `store-workers/README.md`)
- [x] Test page (`/`) and database check (`/_health`), tested locally
- [ ] Deploy the test page to `*.workers.dev`

### Phase 1: Foundation (week 2)
- [x] Page layouts (public and admin), checked in a browser
- [x] Database helper (uncached by default; Malaysia time kept as stored)
- [x] Sessions table and cookie handling (migration `0004`, daily clean-up cron)
- [x] CSRF protection (origin check everywhere + token on logged-in forms)
- [x] Error pages (never show raw database errors to visitors)
- [x] Environment settings and secrets (`COOKIE_SECRET`, map link)
- [x] Automated tests (32, on an in-memory Postgres) and `npm run dev:local`

### Phase 2: Public shop (weeks 3–4)
- [x] Homepage with search, filters, and the trending and new sections (+ redirects from `index.php`)
- [x] Product page with the colour/size/image data the page's script needs (use safe JSON output so a `</script>` in a colour name can't break the page) (+ redirects from `product_detail.php`)
- [x] Legal pages (+ redirects from `legal/*.php`)
- [x] Product images served from R2 at the same `/uploads/...` paths

### Phase 3: Logins (week 5)
- [x] Customer login, signup and Google login (+ account page and logout)
- [x] Admin login and Google login, with the boss/admin roles
- [x] Rate limiting on all login forms (10 per minute per IP and per email)
- [x] A new session ID on every login
- [x] Test the `$2y$` → `$2a$` password check with real hashes (checked both ways with real PHP hashes; bcryptjs accepts $2y$ directly)

### Phase 4: Admin (weeks 6–8)
- [x] Dashboard
- [x] Product list, add and edit pages
- [x] **Archive instead of delete**, so stock history is never lost (migration `0006`, boss only, restorable)
- [x] Colour and image management with uploads to R2 (validate colour codes on every save; image type checked from file contents)
- [x] Stock In/Out using the same transaction and `FOR UPDATE` row-locking approach (the product row is locked too)
- [x] Stock report with filters, CSV export and the print view
- [x] Redirects from the old `admin/*.php` addresses
- [x] Apply migration `0006` to the dev database

### Phase 5: Go live with the same features (week 9)
- [ ] Run the old PHP site and the new site side by side on the same data copy and compare every page
- [ ] Copy the images from `uploads/` into R2 (same file names)
- [ ] Add the new Google login redirect addresses in Google Cloud Console
- [ ] Set up Cloudflare Access on `/admin/*`
- [ ] Add redirects from the old `.php` addresses
- [ ] Point the domain to the Worker
- [ ] **Keep the PHP site available for about 2 weeks** so you can switch back if something goes wrong

### Phase 6: Purchase function (weeks 10–14)
- [ ] New tables:
  - `orders`: order number, customer (can be empty for guests), contact details, address, status, subtotal, shipping fee, total, payment reference, when paid
  - `order_items`: product, colour, size, quantity, plus the name and price **at the time of the order**, so later price changes don't alter old orders
  - `payment_events`: a log of every message the payment gateway sends
- [ ] Cart and checkout, checking stock at checkout
- [ ] Choose a gateway (Billplz or Stripe) and use its hosted payment page
- [ ] **Only mark an order as paid when the gateway's callback is confirmed with its signature**, never because the customer's browser came back to the "success" page
- [ ] When an order is paid, in one transaction: lock the stock row, deduct the quantity, and record a Stock Out with reason "Sold online". If it sold out in the meantime, mark the order as needing a refund.
- [ ] Admin orders page
- [ ] Customer order history
- [ ] Receipt email
- [ ] Refund policy in the Terms & Conditions

> Going live with the same features (Phase 5) **before** building purchase is the biggest risk-reducer in this plan. If something breaks after the switch, you know it's from the rewrite and not from the new purchase code.

---

## 5. Risks to watch

| Risk | How to handle it |
|---|---|
| Learning curve if TypeScript is new | Budget the extra time in Phase 0 and port one simple page end to end first |
| Old links and Google search results breaking | Redirects from the old `.php` addresses |
| Google login breaking after the switch | Add the new redirect addresses before switching the domain |
| Customers seeing outdated stock | Caching off for stock, admin and checkout queries |
| Losing data while testing | Use only the development Supabase project until Phase 5 |

---

## 6. Estimated monthly cost

Approximate, at about RM4.2 per US$1. Check the official pricing pages before budgeting.

| Item | Cost |
|---|---|
| Cloudflare Workers Paid | $5 ≈ RM21 |
| R2 image storage | Free up to 10 GB |
| Supabase | Free to start; **Pro $25 ≈ RM105** once taking real payments (no pausing, daily backups) |
| Domain | ~RM5/month |
| Receipt emails | Free tier at low volume |
| **Total** | **≈ RM26** (Supabase Free) / **≈ RM131** (Supabase Pro) |

Plus the payment gateway's fee on each order. This will likely cost more than hosting, so compare gateways (for example Billplz FPX vs Stripe) on their own pricing pages.

---

## Sources

- [Cloudflare Hyperdrive: Supabase guide](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)
- [Cloudflare Workers: Supabase integration](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase)
- [Cloudflare blog: How Hyperdrive speeds up database access](https://blog.cloudflare.com/how-hyperdrive-speeds-up-database-access)
- [Cloudflare changelog: Containers & Sandboxes generally available](https://developers.cloudflare.com/changelog/2026-04-13-containers-sandbox-ga)
- [Supabase: Connecting to your database](https://supabase.co/docs/guides/database/connecting-to-postgres)
- [Supabase: Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
- [Comparing bcrypt hashes between PHP and Node.js](https://stanislas.blog/2019/04/comparing-bcrypt-hash-between-php-and-node-js/)
- [Supabase pricing 2026 (JetAdmin)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [Cloudflare Workers pricing calculator (MakerKit)](https://makerkit.dev/pricing-calculator/cloudflare)
- [Payment gateway fees Malaysia (Airwallex)](https://www.airwallex.com/my/blog/payment-gateway-fees-malaysia)
