# Laravel → NestJS migration

This service is the new NestJS backend, replacing `barakahly-commerce`
(Laravel) route by route. Both apps run side by side against the **same**
MySQL database (`barakahly`) during the transition — no data duplication,
no sync jobs. Laravel's migrations remain the only thing allowed to change
the schema; this app never runs `synchronize: true`.

## Current status

- [x] Project scaffolded (NestJS 12, TypeORM 1.x, MySQL via `mysql2`)
- [x] `GET /api/v1/checkout/options` — verified byte-for-byte against Laravel
- [x] `GET /api/v1/settings` — verified byte-for-byte against Laravel
      (including the `{"data": ...}` wrapper Laravel's JsonResource adds)
- [x] `POST /api/v1/newsletter/subscribe` — logic mirrored and tested
- [x] `POST /api/v1/contact` — logic mirrored (dynamic SMTP from the
      `settings` row, same as AppServiceProvider::applyDynamicMailConfig)
- [ ] Home, Blog, Products/Categories/Brands, Search — no auth needed,
      next up
- [ ] Auth (register/login/logout/me/password/profile) — must validate
      against Laravel's existing `personal_access_tokens` table (see
      "Auth compatibility" below) before anything behind login can move
- [ ] Cart, Wishlist, Reviews, Orders — need Auth first
- [ ] Checkout (place order), OTP, coupon, SSLCommerz payment — highest
      risk (money/stock), migrate last and test heavily
- [x] Admin panel decided: separate Vite + React SPA (`barakahly-admin`),
      talking to this NestJS API — not Next.js (no SSR benefit for an
      authenticated internal tool), not server-rendered in Nest itself
- [x] Admin auth (`POST /api/v1/admin/auth/login`, `GET .../me`) — validates
      against the existing `users` table (bcrypt, same hashes Laravel
      produces), issues its own JWT. This is intentionally a *new* auth
      system for admins, not a Sanctum-compatible one like the customer
      API needs - the React admin fully replaces the Blade admin rather
      than running side-by-side with it page-for-page.
- [x] Categories admin CRUD (`/api/v1/admin/categories`, incl. parent/child
      hierarchy) — backend + React list/form pages, verified end-to-end
- [x] Brands admin CRUD (`/api/v1/admin/brands`) — same
- [x] Colors admin CRUD (`/api/v1/admin/colors`) — same
- [x] Sizes admin CRUD (`/api/v1/admin/sizes`) — same
- [x] Products admin CRUD (`/api/v1/admin/products`) — list with
      search/category/brand/status filters + pagination, create/update
      with multipart image upload (written directly into Laravel's
      storage/app/public/products, same UUID filename convention),
      per-image delete/set-primary/reorder, color+size variant sync,
      bulk activate/deactivate/delete, auto SKU generation
      (BAR-PROD-#####). React list page (search, filters, bulk actions)
      + form page (image tiles, variant table). Fully verified end-to-end
      against live data, including physical file writes/deletes.
- [x] Dashboard stats (`GET /api/v1/admin/dashboard`) — mirrors every
      figure in Admin\DashboardController@index: today/monthly/total
      sales, the profit formula (sale price minus average landed cost
      per product), order counts by status, 30-day sales chart
      (zero-filled), top 5 selling products, low-stock products (≤5,
      accounting for variant stock), recent orders, recent admin users
      (matches Laravel's `recentCustomers` var, which actually queries
      `users` not `customers` - kept as-is for parity), and the
      investment/purchase funding totals. Verified against live Laravel
      tinker output for the trickier numbers (profit, sales, funding
      totals) - all matched exactly. React dashboard page with stat
      cards, a CSS bar chart, and recent-orders/top-products/low-stock
      tables.
- [x] Orders admin (`/api/v1/admin/orders`) — list with status/payment/
      search/date-range filters + pagination + stats (mirrors
      OrderController@index's `$orderStats` exactly, verified against
      live tinker output), order detail with items/status history/merge
      candidates, status change (restores stock on cancel - same
      behavior as Laravel: always restores to the base Product, never
      the variant, even for variant items - kept as-is for parity, not
      "fixed"), bulk status change, payment status change, remove
      shipping charge, and order merging (same customer + both unpaid
      only). Not built: creating a custom order (`store()`, ties to
      SSLCommerz payment links) and the PDF invoice download - lower
      priority, flagged for later. Fully tested end-to-end against
      throwaway orders (create → cancel → verify stock restored → merge
      → verify secondary cancelled → cleanup), not just code review.
      React: orders list (stats cards, filters, bulk actions) + detail
      page (items, status dropdowns, merge UI, status history).
- [ ] Purchases, Investments, Suppliers, Reports (the actual CRUD
      screens - dashboard only reads their totals), custom order
      creation, invoice PDFs — not started

## Fixed along the way

- **Migration drift** (`barakahly-commerce`): the `purchases` table's
  create-migration was missing its tracking row (see git history/session
  notes), which blocked `cost_price` on products, `investments`, and
  purchase funding fields from ever being migrated. Restored the tracking
  row and ran the real pending migrations - `products.cost_price` etc.
  now actually exist. This had been flagged but not fixed in an earlier
  session; it started actively blocking Products admin work, so it got
  fixed here.
- `products.image` was intentionally dropped in favor of `product_images`
  (multi-image support) - the entity must not declare it.
- TypeORM + ESM circular imports between `Product`/`ProductImage`/
  `ProductVariant` throw `ReferenceError` on startup unless relation
  properties are typed with TypeORM's `Relation<T>` wrapper.
- A transaction-isolation bug: calling `this.findOne()` (the default,
  non-transactional repository) *inside* a `dataSource.transaction()`
  callback can't see the not-yet-committed row. Fixed by returning the id
  from the transaction and re-fetching after it resolves.

## How a route gets migrated

1. Read the Laravel controller method being replaced end to end (including
   any model casts — those decide entity column types/JSON shapes).
2. Add/extend a TypeORM entity for each table it touches, matching the
   Laravel migration files exactly (column names via `@Column({ name: ... })`
   since this project uses camelCase properties over the DB's snake_case
   columns).
3. Reimplement the endpoint in a Nest module, returning a plain object with
   the exact same JSON keys Laravel returned (the Next.js storefront and
   mobile app are not being changed — they must not notice the swap).
4. Run both servers locally and diff the response for the same input
   before calling a route "migrated".
5. Flip that one route in the Nginx config (see below) once verified in
   production-like conditions.

## Auth compatibility (needed before migrating anything behind login)

The storefront/mobile app authenticate via Laravel Sanctum bearer tokens,
stored in the `personal_access_tokens` table (SHA-256 hash of the token,
`tokenable_type` / `tokenable_id` pointing at `Customer`). Any migrated
route that needs the logged-in customer must validate against that same
table (hash the incoming bearer token, look it up, check `expires_at`) —
**do not** introduce a second auth system, or customers get logged out of
whichever backend they didn't log into. Routes here that stay
public/unauthenticated (like `checkout/options`) don't need this yet.

## VPS deployment: running both side by side

Both processes bind to different local ports; Nginx routes by path prefix
so the swap is invisible to clients:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Routes migrated to NestJS - add one location block per migrated
    # route (or route group) as they move over.
    location = /api/v1/checkout/options {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Everything else still goes to Laravel (PHP-FPM / existing vhost)
    location / {
        root /var/www/barakahly-commerce/public;
        try_files $uri /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

Run the Nest app under a process manager (pm2 or a systemd unit) so it
survives reboots/crashes, same as PHP-FPM does for Laravel today.

## Local development

```bash
npm install
cp .env.example .env   # fill in the same DB creds barakahly-commerce/.env uses
npm run start:dev      # http://localhost:4000
```
