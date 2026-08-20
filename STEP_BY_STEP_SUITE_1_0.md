# Small Business Suite 1.0 - Manual Upgrade Guide

This package upgrades the current working **Small Business v5.0 Commerce Suite**
installation to **Small Business Suite 1.0**.

It assumes:
- GitHub Pages site: `jaittey.github.io`
- Supabase is already connected and working
- Employee registration is already working
- v5.0 Commerce migration was already installed

Do NOT re-run the old Firebase migration or replace the working employee activation function.

---

## What Suite 1.0 fixes

### PDF / invoice output
- POS and normal invoice item descriptions are normalized.
- POS `name`, `unitPrice`, `quantity` and `amount` fields now render correctly.
- Discount appears on the PDF.
- Taxable amount appears when relevant.
- GST percentage and GST amount appear.
- Subtotal and Total remain visible.
- Payment method and reference are included.
- Cash received and change can appear for POS invoices.
- Multi-line descriptions use line wrapping instead of clipping.
- Signature and paid/company stamp are kept in a safe bottom area.
- Footer includes page count.

### Subscription landing
- Active subscribers remain on Dashboard at login.
- The app does not redirect to Subscription while subscription data is still resolving.
- Subscription is still available from the navigation when the user intentionally opens it.

### Adaptive POS
Only the **Company Administrator** can:
- choose Shop / Retail
- choose Restaurant / Cafe
- choose Garage / Workshop
- choose Wholesale
- change the company POS configuration

Managers and Users:
- cannot open POS configuration
- use the POS type saved by the Administrator
- automatically receive company POS changes

### Navigation
The new navigation follows the supplied left-navigation design:
- fixed desktop sidebar
- collapsible desktop sidebar
- nested expandable module groups
- active left accent
- profile card at the bottom
- responsive mobile drawer
- page breadcrumb
- module search
- compact topbar actions

### Theme builder
Every user can customize:
- Primary accent
- Secondary accent
- Sidebar color
- Page background
- Card / surface color
- Text color
- Surface transparency
- Glass blur
- Card border radius
- Sidebar width
- Comfortable / compact density

The custom appearance is saved locally for that user/device.

### Super Admin App Settings
A new **Super Admin -> App Settings** page adds protected test-data cleanup.

Three scopes are provided:

1. **Operational test data**
   - deletes operational records
   - keeps Company/System settings
   - keeps company POS configuration

2. **All company workspace data**
   - deletes all `business_records`
   - deletes company asset database rows
   - keeps businesses, users/memberships and subscriptions

3. **All application test transactions**
   - includes company workspace data
   - clears subscription test requests/payments
   - clears receipt duplicate indexes
   - clears mail queue
   - clears employee activation attempt logs
   - still preserves businesses, memberships, active subscription records,
     platform plans, bank accounts and Auth users

The deletion function requires:
- a signed-in Super Admin
- exact confirmation phrase `DELETE ALL TEST DATA`
- a second browser confirmation

The SQL migration only CREATES the cleanup function. It does not delete data when installed.

---

# Installation

## Step 1 - Back up the working app

Before changing GitHub:

1. Open GitHub repository `Jaittey/jaittey.github.io`.
2. Download the current repository ZIP.
3. Keep that ZIP until Suite 1.0 has been tested.

For the database, use your existing company backup/Google Drive backup for important business data.

Do not use the new Super Admin delete function until you have a backup.

---

## Step 2 - Run the Suite 1.0 SQL migration

Open:

**Supabase -> SQL Editor -> New Query**

Open this file from the package:

`backend/sb_suite_1_0_upgrade.sql`

Copy all SQL and click **Run**.

Expected result:
- migration completes successfully
- no business records are deleted
- new RPCs are available:
  - `sb_super_admin_test_data_summary`
  - `sb_super_admin_clear_test_data`

This migration also removes anonymous execution permission from the v5 commerce-write RPCs.

---

## Step 3 - Upload / replace these files in GitHub

### Replace
- `index.html`
- `package.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/App.jsx`
- `src/main.jsx`
- `src/components/AppShell.jsx`
- `src/config/brand.js`
- `src/config/erp.js`
- `src/config/plans.js`
- `src/config/themes.js`
- `src/pages/POS.jsx`
- `src/pages/Products.jsx`
- `src/pages/Invoices.jsx`
- `src/pages/Quotes.jsx`
- `src/pages/UserPreferences.jsx`
- the v5 pages/services in this ZIP if your current repo is missing any of them

### Add
- `src/styles-suite.css`
- `src/services/businessPdf.js`
- `src/services/platformAdmin.js`
- `src/pages/SuperAdminAppSettings.jsx`
- `backend/sb_suite_1_0_upgrade.sql`

### Keep
Keep your existing working:
- `src/hooks/useAuth.js`
- `src/components/LoginPage.jsx`
- `supabase/functions/activate-company-user/`
- Supabase configuration
- GitHub Actions workflow

---

## Step 4 - Do NOT install npm locally

Your existing GitHub Actions workflow can build Vite.

After uploading the files:

1. Commit to `main`.
2. Open **GitHub -> Actions**.
3. Open **Deploy Small Business to GitHub Pages**.
4. Wait for:
   - Build ✅
   - Deploy ✅

If the build fails, do not delete working files. Open the failed Build step and use the first red error line.

---

## Step 5 - Clear the old browser cache

Suite 1.0 uses a new Service Worker cache:

`small-business-suite-100`

After deployment:

1. Open `https://jaittey.github.io/`
2. Press `Ctrl + Shift + R`.
3. If old UI still appears:
   - browser DevTools
   - Application
   - Service Workers
   - Unregister old worker
   - Storage / Clear site data
4. Reload.

---

# Testing checklist

## A. Dashboard / subscription
1. Sign in with an account that already has an ACTIVE subscription.
2. The first company page should be **Dashboard**.
3. Reload.
4. It should not automatically send you to Subscription.
5. Click Subscription manually - it should still open normally.

## B. POS Administrator rule
1. Sign in as Company Administrator.
2. Open Adaptive POS.
3. Configure the POS type and save.
4. Sign out.
5. Sign in as Manager.
6. Manager should immediately see the configured POS.
7. Manager should NOT see **Company POS settings**.
8. Repeat with a User account.

## C. Invoice PDF
Create a normal invoice with:
- 2 products
- long description
- discount
- GST
- payment method
- customer details

Preview PDF.

Confirm:
- descriptions are visible
- quantity is correct
- unit price is correct
- line amount is correct
- Subtotal visible
- Discount visible
- Taxable amount visible when applicable
- GST visible
- Total visible
- signature/stamp do not cover totals

## D. POS invoice PDF
Create a POS sale with:
- 2 different items
- quantity > 1
- discount
- GST
- Cash payment

Then open the resulting invoice from Invoices and Preview/PDF.

This specifically checks the old problem where POS lines had blank descriptions and MVR 0.00 unit price.

## E. Restaurant / Garage / Wholesale POS
Re-test the already installed v5.0 functions:
- Restaurant order -> kitchen -> paid
- Garage part + service checkout
- Wholesale customer + wholesale pricing
- Retail inventory deduction

## F. Navigation
Desktop:
- expand/collapse sidebar
- open submenus
- active page indicator
- module search

Mobile:
- hamburger opens sidebar
- overlay closes sidebar
- opening a module closes drawer
- no black/blocked page overlay remains after closing

## G. Themes
Open:
**Application Manager -> User Preferences / Themes**

Test:
- preset theme
- custom colors
- transparency
- blur
- radius
- sidebar width
- compact mode
- reset custom settings

## H. Super Admin App Settings
Open:
**Super Admin -> App Settings**

First only check the summary counts.

Do not use Delete until you are sure the current data is test data.

For an actual cleanup:
1. choose scope
2. type `DELETE ALL TEST DATA`
3. read the browser warning
4. confirm

Remember: Supabase Auth users are intentionally NOT deleted by this tool.

---

# Firebase migration cleanup

Firebase Migration is retired in Suite 1.0.

The legacy migration tab is hidden by the Suite 1.0 UI layer, and it is not part of the new Super Admin navigation.

After the new version works, follow:

`REMOVE_OLD_FILES.md`

to delete obsolete migration/setup documentation and duplicate folders from GitHub.

---

# Important data-safety notes

The Super Admin cleanup tool intentionally preserves:
- `auth.users`
- `platform_users`
- `businesses`
- `business_memberships`
- `business_subscriptions`
- `platform_plan_settings`
- `platform_bank_accounts`
- `platform_custom_offers`

This avoids deleting login accounts or active subscriptions by accident.

Storage files associated with old records may still exist in Supabase Storage or Google Drive.
The database cleanup does not automatically erase external files.

---

# Final application name

**Small Business Suite**

Version:

**1.0.0**
