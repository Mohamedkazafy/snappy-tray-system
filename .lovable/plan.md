# Restaurant POS — Build Plan

A large system. I'll build it in phases so each one is usable, then layer on more. Below is the architecture, the database design, and the phase order I propose.

## Architecture

- **Frontend**: TanStack Start (already scaffolded), React 19, Tailwind v4, shadcn. Touch-friendly POS layout, large buttons, keyboard shortcuts.
- **Backend**: Lovable Cloud (Postgres + Auth + server functions). RLS on every table. Role checks via `has_role()` security-definer function.
- **Auth**: Email/password. Roles: `admin`, `cashier`, `waiter` in a dedicated `user_roles` table.
- **Server logic**: `createServerFn` for all writes (invoices, stock movements, closings) so cost/stock math stays server-side and atomic.
- **Modularity**: One folder per module (`pos/`, `tables/`, `inventory/`, `purchases/`, `reports/`, `settings/`).

## Database (why each table exists)

Settings & people
- `settings` — single-row app config: business day start/end, tax defaults, currency.
- `profiles` — user display info (linked to `auth.users`).
- `user_roles` — RBAC, separate from profiles (security).

Catalog
- `categories` — group products for POS grid.
- `products` — every item; `product_type` in (`raw`, `manufactured`, `ready`), price, cost, taxable, active.
- `recipes` + `recipe_items` — BOM for manufactured/ready items; ingredient qty per 1 unit sold.

Inventory
- `warehouses` — Main, Kitchen, Bar, etc.
- `stock` — current qty + moving-average cost per (product, warehouse).
- `stock_movements` — append-only log of every in/out/transfer/adjust with qty, cost, reason, ref.

Suppliers & purchases
- `suppliers`
- `purchases` (header) + `purchase_items` (lines) — increases stock and updates cost via `stock_movements`.

Sales
- `payment_methods` — admin-editable list.
- `dining_areas` + `tables` — simple grid, status enum.
- `orders` (header: type=takeaway/dinein/delivery, table_id?, status, totals, business_day) + `order_items` (line + notes) + `order_payments` (split payments).
- Closing an order writes `stock_movements` for each sold product (using recipe expansion for manufactured/ready).

Financial closing
- `business_days` — one row per closing: start_at, end_at, opening_cash, closing_cash, totals snapshot.
- Helper SQL function `current_business_day(now)` uses `settings` to resolve which day a timestamp belongs to.

Every table has RLS + `GRANT` for `authenticated` and `service_role`.

## Phase order (each phase is shippable)

1. **Foundation** — enable Cloud, auth, roles, profiles, app shell with role-aware nav, settings page (business day window, currency).
2. **Catalog** — categories, products (all 3 types), payment methods, warehouses, suppliers. Admin CRUD only.
3. **POS core** — category/product grid, search, cart, qty/notes, discount, tax, split payment, receipt print. Take-away only. Writes `orders` + `order_items` + `order_payments`.
4. **Tables & dine-in** — dining areas, table grid, open/close/transfer, dine-in orders from table view. Waiter role active.
5. **Inventory & recipes** — recipes (BOM), stock, stock movements, adjustments, transfers, receive/issue, count. Sales auto-deduct via recipe expansion; moving-average cost.
6. **Purchases** — supplier invoices increase stock and update cost.
7. **Financial closing** — open/close business day, opening/closing cash, cash difference, snapshot totals.
8. **Reports & dashboard** — sales by date/product/category/employee/method/type, inventory reports, daily closing, profit; dashboard cards.

## Technical details

- Cost method: **moving weighted average** per (product, warehouse). Simple, correct enough for a restaurant.
- Business day resolution: SQL function `public.business_day_for(ts timestamptz) returns date` reads `settings.day_start/day_end` and shifts. Every `orders.business_day` is set by trigger on insert.
- Recipe expansion on sale: server function `finalize_order(order_id)` runs in a transaction: for each `order_item`, if product has a recipe, insert `stock_movements` for each ingredient; else for the product itself. Also computes COGS snapshot on the order.
- Print: browser print of a dedicated `/receipt/$orderId` route (thermal-friendly CSS).
- Touch UI: 64px+ tap targets on POS, sticky cart, numeric keypad for cash.

## Not included / kept simple

- No floor designer — plain table grid.
- No multi-currency, no accounting ledger, no shifts beyond the daily closing, no kitchen display screen (can be added later as a module).
- Refunds handled as negative orders in a later iteration if needed.

## What I need from you before I start

1. **Scope for v1**: build **all 8 phases** in this project, or start with **Phases 1–3 (auth + catalog + POS take-away)** and iterate? Full build is a lot of code in one shot; phased is safer.
2. **Currency & tax defaults** (e.g. USD, 15% VAT)? I'll put them in settings; just need starting values.
3. **Language/direction**: English LTR only, or also Arabic/RTL? (Common for restaurant POS in this style.)
4. **First admin account**: I'll create the schema so the first signed-up user auto-becomes admin — OK?

Reply with answers (or "go, phases 1–3, USD, 15%, English, yes") and I'll start building.