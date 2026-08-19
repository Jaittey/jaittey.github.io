# Small Business v4.1 — HTML Multi-Page Database Fix

This release keeps the plain HTML/CSS/JavaScript architecture and fixes the Supabase connection/workspace migration issues found after v4.0 deployment.

See `docs/DATABASE_CONNECTION_FIX_v4_1.md` first.


## What changed

The React/Vite/JSX application has been rebuilt as a **plain multi-page HTML/CSS/JavaScript application**.

Every major user-facing page is now an individual `.html` file. This means you can open a page such as:

- `dashboard.html`
- `pos.html`
- `invoices.html`
- `employees.html`
- `payroll.html`
- `company-administration.html`
- `super-admin.html`

and edit its layout directly.

JavaScript is still used for **functionality** (Supabase, authentication, CRUD, POS calculations, themes, etc.), but it no longer creates the application pages with JSX.

## Important configuration

The deployed app now receives its browser-safe Supabase configuration from GitHub Actions.

Keep these repository secrets in:

`Settings → Secrets and variables → Actions`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional:

- `VITE_SUPER_ADMIN_EMAIL`
- `VITE_GOOGLE_CLIENT_ID`

The workflow generates `assets/js/runtime-config.js` during deployment. Do not put a service-role key, secret key, JWT secret, or database password in browser files.

The app no longer silently falls back to local demo data when Supabase configuration is missing. It displays a clear configuration error instead.

## Backend

The existing Supabase SQL files are preserved in `/backend`.

If your existing v3.6 Supabase database already works, you normally do not need to recreate it.

For POS, your project must already include the `sb_complete_pos_sale` RPC from:

`backend/sb_v3_4_pos_upgrade.sql`

## Deployment to GitHub Pages

1. Back up your current GitHub repository.
2. Remove the old React/Vite project files from the repository.
3. Upload all files from this HTML package to the repository root.
4. Confirm the GitHub Actions Supabase secrets above exist.
5. Commit to `main`.
6. Open GitHub → Settings → Pages and ensure **GitHub Actions** is selected.
7. Open GitHub → Actions and wait for `Deploy Small Business HTML`.
8. Open `https://jaittey.github.io/`.
9. Press Ctrl+F5 once.

## Editing pages manually

Example: change POS layout

Open:

`pos.html`

The actual POS product panel, cart panel, fields and recent-sales table are directly in the HTML.

Example: change Dashboard

Open:

`dashboard.html`

The KPI cards, quick actions and recent invoice area are directly editable.

## CSS

Use only these main CSS files:

- `assets/css/app.css` — layout and components
- `assets/css/themes.css` — theme colors
- `assets/css/print.css` — print rules

Do not create several global CSS override files. Keep page-specific CSS either in `app.css` or a dedicated clearly named file.

## JavaScript structure

- `config.js` — Supabase/public configuration
- `storage.js` — Supabase + demo/localStorage data layer
- `auth.js` — authentication
- `shell.js` — common sidebar/topbar/mobile navigation
- `ui.js` — modal/toast/helpers
- `crud.js` — generic CRUD pages
- `pos.js` — POS logic
- `attendance.js` — attendance logic
- `payroll.js` — payroll calculation
- `company-admin.js` — company settings and uploaded assets
- `preferences.js` — built-in/custom themes
- `super.js` — Super Admin platform tables

## HTML application tree

Authentication:
- index.html
- register-business.html
- workspace.html

Main:
- dashboard.html
- notifications.html

Sales & POS:
- sales-dashboard.html
- pos.html
- invoices.html
- quotations.html
- recurring-billing.html
- payments.html
- customers.html
- inventory-assets.html
- contracts.html
- customer-statements.html

Employee:
- employee-dashboard.html
- employees.html
- hr-records.html
- attendance.html
- attendance-settings.html
- payroll.html
- final-settlements.html

Finance:
- financial-dashboard.html
- finance-overview.html
- income-payments.html
- expenses.html
- budget.html
- gst-tax.html

Application Manager:
- application-manager.html
- company-administration.html
- users-permissions.html
- reports.html
- cloud-documents.html
- activity-logs.html
- preferences.html
- subscription.html

Super Admin:
- super-admin.html
- super-businesses.html
- super-users.html
- super-requests.html
- super-payments.html
- super-plans.html
- super-offers.html
- super-banks.html
- super-verification.html

## Notes

This rebuild intentionally removes React, JSX, Vite and npm as runtime/build requirements. It can be hosted as a normal static website.

Some advanced workflows from the React project (complex PDF generation, OCR receipt analysis, full Google Drive API workflow, advanced payroll locking, and deep subscription verification actions) require additional plain-JavaScript ports if you need every detail to behave identically. The HTML architecture and Supabase data layer are prepared so those functions can be added without converting pages back to JSX.
