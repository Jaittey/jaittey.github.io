# Small Business (SB) v4.1 — JS Fast Edition

This version returns Small Business to the faster React/Vite JavaScript architecture while keeping the Supabase backend and the latest subscription/payment rules.

## What is preserved

- Supabase Authentication, Database, Realtime and Storage
- Google login and email login
- One owner account → one registered business
- 7-day VIP Platinum free trial
- VIP Silver, Gold and Platinum packages
- Monthly and yearly subscriptions
- Custom Super Admin offers such as 6 months or Lifetime
- BML and MIB subscription transfer-slip uploads
- Automatic checks limited to amount + exact duplicate image
- Users may submit a slip even if the automatic check reports an issue
- Super Admin manually reviews and may approve or reject any submitted slip
- Company users and permission controls
- Employee management, Attendance, Payroll and Salary Slips
- Finance, Inventory, Reports, Cloud/Documents and themes
- Google Drive features for Platinum
- POS System with atomic stock deduction

## Why this version should feel faster

v4.1 changes the frontend loading strategy:

1. Pages are code-split with `React.lazy()` and loaded only when opened.
2. The heavy OCR/Tesseract package is downloaded only when a user actually uploads a subscription slip.
3. The app no longer subscribes to every business collection immediately after login.
4. Only the data needed by the current page is queried from Supabase.
5. Previously loaded module data is kept in a small in-memory cache for faster back/forward navigation.
6. Realtime refreshes are debounced to avoid repeated queries when several changes arrive together.
7. Realtime channels use unique channel names to avoid the earlier `cannot add postgres_changes callbacks ... after subscribe()` race.
8. A React error boundary prevents a JavaScript render error from becoming a blank white page.
9. The service worker always fetches fresh HTML after deployment while caching Vite's hashed JS/CSS assets for fast repeat visits.

---

# Upgrade from the working HTML v4.0.1

Your Supabase data does NOT need to be migrated. Both versions use the same Supabase project and tenant records.

## Step 1 — Back up GitHub

Open your repository and download a ZIP backup:

`GitHub → Code → Download ZIP`

Do not delete your Supabase tables or Storage buckets.

## Step 2 — POS database upgrade

The JS version includes POS. In Supabase open:

`SQL Editor → New query`

Open this project file:

`backend/sb_v3_4_pos_upgrade.sql`

Copy the complete SQL and run it. It is written with `create or replace`, so it can safely be run again if you already used it with the HTML version.

If your current database already has the `sb_complete_pos_sale` RPC, this step simply refreshes the function and permissions.

## Step 3 — Keep your v3.3 payment upgrade

Do NOT delete or reset the existing payment/subscription tables.

If your current app already has:

- 7-day free trial
- custom offers
- BML/MIB slip upload
- Super Admin verification

then `sb_v3_3_payment_upgrade.sql` has already been applied and does not need to be run again.

For a completely new Supabase project, run in this order:

1. `backend/supabase_schema.sql`
2. `backend/sb_v3_3_payment_upgrade.sql`
3. `backend/sb_v3_4_pos_upgrade.sql`

## Step 4 — Replace GitHub files

Delete the old HTML application files from the repository root, then upload the CONTENTS of the `Small_Business_v4_1_0_JS_FAST` folder.

Important files/folders include:

- `.github/`
- `src/`
- `public/`
- `backend/`
- `index.html`
- `package.json`
- `vite.config.js`

Do not upload the outer folder as another directory. `package.json` must be at the repository root.

## Step 5 — GitHub repository secrets

Open:

`Settings → Secrets and variables → Actions`

Make sure these exist:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPER_ADMIN_EMAIL`
- `VITE_GOOGLE_CLIENT_ID`

The application does NOT need a Supabase secret/service-role key in GitHub Pages.

## Step 6 — GitHub Pages

Open:

`Settings → Pages`

Set:

`Source: GitHub Actions`

## Step 7 — Commit and deploy

Suggested commit message:

`Deploy Small Business v4.1 JS Fast`

Open `Actions → Deploy Small Business to GitHub Pages` and wait for both Build and Deploy to become green.

The workflow uses `npm install`, so a `package-lock.json` is not required.

## Step 8 — Open the new build

Open:

`https://jaittey.github.io/?build=sb-v4-1-js-fast`

If an older version appears, clear the old site cache once.

### Desktop Chrome / Edge

`F12 → Application → Service Workers → Unregister`

Then:

`Application → Storage → Clear site data`

Reload with `Ctrl + Shift + R`.

### iPhone Safari

`Settings → Apps → Safari → Advanced → Website Data`

Delete the `jaittey.github.io` entry and reopen the website.

---

# Supabase / Google login check

In Supabase:

`Authentication → URL Configuration`

Use:

- Site URL: `https://jaittey.github.io/`
- Redirect URL: `https://jaittey.github.io/`

Google Cloud OAuth should continue to use the Supabase callback URI supplied by your project.

---

# Test after deployment

## Login

1. Sign in with Google.
2. Confirm you return to Small Business instead of a blank page.
3. Confirm your existing business appears automatically.

## Dashboard performance

1. Open Dashboard.
2. Switch between Dashboard, Customers and Inventory.
3. Returning to a previously opened page should be quicker because recent records are retained in memory.

## POS

1. Add a product in Inventory with stock and price.
2. Open `Sales & Billing → POS System`.
3. Add the item to the cart.
4. Complete a sale.
5. Confirm stock decreases.
6. Confirm a PAID invoice/payment is created.

## Subscription payment

1. Select a package or custom offer.
2. Upload a BML or MIB slip.
3. The app checks detected amount and exact duplicate file hash.
4. It must still allow submission when there is a warning.
5. Super Admin opens the receipt and manually approves/rejects.

## Payroll/Attendance

Test an existing employee and verify attendance, payroll history and salary slips are unchanged because the backend data format remains the same.

---

# If the page is blank

v4.1 includes a UI error boundary. A render error should show a recovery screen instead of a completely blank page.

If the deployment itself is blank, check:

1. GitHub Actions → Build step
2. Browser F12 → Console
3. Browser Network tab for `/assets/*.js` 404 errors
4. `vite.config.js` must keep `base: '/'` for the `jaittey.github.io` user-site repository
5. GitHub secrets must be available to the Build step

