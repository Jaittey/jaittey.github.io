# Small Business HTML v4.1 — Database Connection Fix

## What was wrong in v4.0

There were four important database migration problems:

1. The static HTML deployment did not inject the existing GitHub `VITE_*` Supabase secrets into the browser application.
2. The HTML version used a new localStorage key (`sbhtml_activeBusinessId`) while the React application used `sb-active-business`. Existing users could therefore fall back to the invalid value `demo-business`, which cannot be queried against a UUID `business_id` column.
3. Business Registration tried to insert directly into `businesses` and `business_memberships`. The current Supabase security model expects the secure `sb_register_business` RPC instead.
4. Database errors on CRUD pages were not caught, so pages such as Users & Permissions stayed on `Loading...` forever instead of showing the real Supabase error.

v4.1 fixes all four.

## What v4.1 now does

- Reuses your existing GitHub secrets.
- GitHub Actions generates `assets/js/runtime-config.js` automatically.
- Migrates the active company automatically from old keys (`sb-active-business` and `df7-active-business`).
- Never silently switches a deployed app to local/demo data.
- Restores the original `platform_users` + `sb_claim_membership` login initialization.
- Loads actual `business_memberships` for Users & Permissions.
- Uses `sb_register_business` for new business registration.
- Uses existing `business_records` JSONB records for company data.
- Uses the existing `company-assets` Supabase Storage bucket and `company_assets` table for logo, stamp and manager signature.
- Shows clear database errors instead of an endless `Loading...` state.
- Shows a green database/workspace status indicator in the top bar.
- Keeps the POS checkout connected to `sb_complete_pos_sale`.

## Step 1 — Replace your repository with the v4.1 files

Use the complete ZIP. Replace the files in the root of `jaittey.github.io`.

Do not put the old React/Vite workflow back into the repository.

## Step 2 — Check GitHub repository secrets

Open:

`GitHub repository → Settings → Secrets and variables → Actions`

Make sure these exist:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional but recommended:

- `VITE_SUPER_ADMIN_EMAIL`
- `VITE_GOOGLE_CLIENT_ID`

If you use the older anon key name, `VITE_SUPABASE_ANON_KEY` is also supported.

The new HTML workflow reads these secrets and creates a browser-safe runtime configuration during deployment. You do not have to hard-code the values into every HTML page.

## Step 3 — Deploy

Commit to `main`.

Open GitHub Actions and run:

`Deploy Small Business HTML`

The workflow now has no npm/Vite build. It will stop with a clear error if the required Supabase secrets are missing.

## Step 4 — Clear the old PWA cache

After the deployment succeeds:

1. Open `https://jaittey.github.io/`.
2. Hard refresh once.
3. If an older version still appears, remove the old service worker/site data and reload.

The new cache name is:

`small-business-html-v410-db-fix`

## Step 5 — Sign in and open the Company Workspace page

v4.1 will automatically recognize an existing company stored by the React application using `sb-active-business`.

If no company is selected, it redirects you to `workspace.html` instead of querying Supabase with an invalid demo business ID.

## Step 6 — Users & Permissions

Open:

`Application Manager → Users & Permissions`

This page now reads directly from:

`public.business_memberships`

for the selected business.

If Supabase rejects the request, the real error is displayed in the page rather than leaving `Loading...` forever.

## Step 7 — Optional Supabase verification

If your React v3.6 database was already working, no new schema is normally required.

If you want to verify compatibility, run the read-only file:

`backend/VERIFY_HTML_V4_1_DATABASE.sql`

It checks the main tables, required RPC functions and storage buckets.

The important functions include:

- `sb_claim_membership`
- `sb_register_business`
- `sb_complete_pos_sale`

If `sb_complete_pos_sale` is missing, run `backend/sb_v3_4_pos_upgrade.sql` once.

If the core tables/functions are missing, run the current `backend/supabase_schema.sql` carefully in the same Supabase project.

## Important security rule

Only the Supabase Project URL and Publishable/anon key belong in the browser.

Never place the following in HTML or JavaScript:

- service role key
- secret key
- JWT secret
- database password
