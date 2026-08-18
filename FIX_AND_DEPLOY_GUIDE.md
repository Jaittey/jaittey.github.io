# Small Business (SB) v4.0.1 HTML — Fix & Deployment Guide

## What was fixed

This repair focuses on the failures found in the uploaded v4 HTML package.

1. Fixed JavaScript syntax errors in:
   - `assets/js/dashboard.js`
   - `assets/js/pos.js`
   - `assets/js/super.js`
2. Fixed business registration so it uses the protected Supabase RPC `sb_register_business` instead of a direct `businesses` insert that is blocked by RLS.
3. Added reliable session checks and redirects for signed-out users.
4. Added membership claiming after Supabase sign-in.
5. Removed accidental deployed demo-mode behavior (`demoMode: false`).
6. Added active-company validation so pages do not silently use `demo-business` when Supabase is configured.
7. Added role/subscription-aware menu filtering to reduce permission errors.
8. Added a profile dropdown with Sign out and improved mobile navigation.
9. Added a real mobile sidebar overlay and body scroll lock.
10. Updated the service worker to `small-business-html-v401` and changed HTML navigation to network-first, reducing old cached-page problems after deployment.
11. Added safer CRUD/POS/Dashboard error messages.
12. Checked all 47 HTML pages for broken local file references; none remain.
13. Checked all JavaScript files with Node syntax validation; all pass.

## Before uploading

Back up the current GitHub repository first.

Do not delete the Supabase project or database.

## Files to replace

The safest method is to replace the entire repository contents with the contents of this v4.0.1 package, while keeping the repository itself named:

`jaittey.github.io`

The package already contains:

- `.github/workflows/deploy-pages.yml`
- all HTML pages
- `assets/css/`
- `assets/js/`
- `assets/images/`
- `backend/`
- `manifest.webmanifest`
- `sw.js`

## Supabase configuration

Open:

`assets/js/config.js`

Make sure:

- `supabaseUrl` is your real Supabase Project URL.
- `supabasePublishableKey` is your browser-safe publishable key.
- `superAdminEmail` is correct.
- `demoMode` is `false` for production.

Never put a Supabase secret key or service-role key into this file.

## Supabase backend requirement

This fixed HTML version expects the SQL schema already included in:

`backend/supabase_schema.sql`

In particular, the database must contain these RPC functions:

- `sb_claim_membership`
- `sb_register_business`
- `sb_complete_pos_sale`

If your current Supabase project was created from the supplied v3/v4 schema and POS upgrades, you normally do not need to recreate the database just for v4.0.1.

If business registration returns `function sb_register_business does not exist`, run the latest `backend/supabase_schema.sql` in Supabase SQL Editor after backing up your database.

## GitHub Pages deployment

1. Open your GitHub repository `jaittey/jaittey.github.io`.
2. Upload/replace all files with the v4.0.1 files.
3. Commit with a message such as:
   `Fix Small Business HTML v4.0.1`
4. Open `Settings → Pages`.
5. Set the publishing source to `GitHub Actions`.
6. Open `Actions`.
7. Wait for `Deploy Small Business HTML` to finish successfully.
8. Open:
   `https://jaittey.github.io/?build=v4-0-1`

This HTML build does not use npm or Vite during deployment.

## Clear old cached v4 files

Because the previous package installed a service worker, clear the old cache after deployment.

### Desktop Chrome / Edge

1. Open `https://jaittey.github.io/`.
2. Press `F12`.
3. Open `Application`.
4. Open `Service Workers` and click `Unregister` for the old worker if it is still present.
5. Open `Storage` and click `Clear site data`.
6. Reload the page.

### iPhone Safari

1. Open iPhone `Settings`.
2. Open `Apps → Safari → Advanced → Website Data`.
3. Search for `jaittey.github.io`.
4. Delete that website-data entry.
5. Reopen the site.

## Test checklist

### Login

- Google login opens Supabase/Google login.
- After login you land on `workspace.html`.
- Email login also lands on the workspace page.
- Signed-out users cannot open dashboard pages directly.

### Business registration

- Register a business from `register-business.html`.
- It should create the company using `sb_register_business`.
- The new company becomes the active workspace.
- A 7-day trial/founder subscription behavior is handled by the SQL schema.

### Dashboard

- Dashboard loads without a blank page.
- KPI values render.
- Recent invoices render.

### CRUD modules

Test at least:

- Customers: Add, Edit, Delete.
- Inventory: Add, Edit, Delete.
- Invoices: Add, Edit, Delete.
- Employees: Add, Edit, Delete.
- Expenses: Add, Edit, Delete.

### POS

1. Add an inventory item with quantity and price.
2. Open `pos.html`.
3. Add the item to cart.
4. Complete a sale.
5. Confirm inventory quantity decreases.
6. Confirm the POS invoice appears in recent sales.

### Mobile

- Hamburger menu opens visibly instead of producing a black/unusable screen.
- Tapping outside closes it.
- Bottom navigation does not cover form content.
- Profile button opens the dropdown.
- Sign out is available from the profile dropdown.

### Super Admin

Sign in as the configured Super Admin email.

- Super Admin menu appears.
- Super Admin table pages load without JavaScript syntax errors.

## If a page still fails

Open the browser developer console and copy the first red error message.

Common messages:

- `Select a company workspace first.` → open `workspace.html` and select a business.
- `permission denied` / `row-level security` → Supabase membership, role, subscription, or RLS configuration needs checking.
- `function ... does not exist` → required SQL/RPC was not applied to the Supabase project.
- old layout appears after deployment → clear the service worker/site cache.
