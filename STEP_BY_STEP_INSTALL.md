# Small Business Suite 1.0 — Hotfix Installation

This update fixes the four reported issues:

1. Restores the signed-in user's name and role at the bottom of the navigation.
2. Makes the main navigation icons slightly larger.
3. Makes the Royal theme use one matching navy + gold palette across the dashboard and navigation.
4. Fixes Super Admin → App Settings → Delete Test Data error:
   `DELETE requires a WHERE clause`.

## Important
The Supabase database function has already been hotfixed on the connected **Small Business App** Supabase project.
The SQL files are included so your GitHub project and future installations contain the same fix.

## Step 1 — Back up your GitHub repository
Open:
`Jaittey/jaittey.github.io`

Download a ZIP or keep a copy before replacing files.

## Step 2 — Replace these frontend files
Copy these files from this package into the same locations in GitHub:

- `src/components/AppShell.jsx`
- `src/config/themes.js`
- `src/styles-navigation-theme.css`

Choose **Replace / overwrite** when prompted.

## Step 3 — Replace the Suite SQL file
Replace:

- `backend/sb_suite_1_0_upgrade.sql`

with the version inside this package.

This keeps the repository's Suite 1.0 database setup correct for future deployments.

## Step 4 — Supabase hotfix
The connected Supabase project has already received this database fix.

If you ever install this package on another Supabase project:

1. Open Supabase.
2. Open **SQL Editor**.
3. Open:
   `backend/sb_suite_1_0_delete_test_data_hotfix.sql`
4. Copy all SQL.
5. Paste it into SQL Editor.
6. Click **Run**.

## Step 5 — Commit the frontend update
In GitHub, use a commit message such as:

`Suite 1.0 navigation royal theme and cleanup hotfix`

Commit to `main`.

## Step 6 — Wait for GitHub Pages
Open:

**GitHub → Actions → Deploy Small Business to GitHub Pages**

Wait until both are green:

- Build ✅
- Deploy ✅

## Step 7 — Hard refresh
Desktop:
- Windows: `Ctrl + F5`

iPhone:
- Close the web page/tab.
- Reopen `https://jaittey.github.io/`
- If necessary clear website data/cache for the site.

## Step 8 — Test the navigation
Confirm:

- User name appears beside the profile picture at the bottom.
- User role appears below the name.
- Collapse mode still hides the name and shows only the profile picture.
- Navigation icons are visibly larger.
- Mobile navigation still opens and closes normally.

## Step 9 — Test Royal theme
Go to:

**Application Manager → User Preferences / Themes → Royal**

Confirm:

- Dashboard background is deep navy.
- Cards use matching navy surfaces.
- Gold is used as the accent.
- Navigation is a darker matching navy.
- Navigation active state uses gold.

If custom appearance was previously enabled, selecting a preset should turn the custom override off.

## Step 10 — Test Delete Test Data
Go to:

**Super Admin → App Settings**

Choose the desired scope.

For the full test cleanup choose:

**All application test transactions**

Then type exactly:

`DELETE ALL TEST DATA`

Click:

**Delete selected test data**

The previous `DELETE requires a WHERE clause` error should no longer appear.

## What is preserved during full test cleanup
The cleanup intentionally preserves:

- Supabase Auth users
- Platform users
- Businesses
- Business memberships
- Business subscriptions
- Platform plans
- Platform bank accounts
- Custom offers

This prevents the application from losing its login/company/subscription structure.
