# Recommended GitHub cleanup after Suite 1.0 is working

Do this only AFTER the Suite 1.0 build and live-site tests pass.

## Safe obsolete documentation / patch files to delete

- `ADMIN_PAGE_INTEGRATION.jsx`
- `FILE_MANIFEST_V5_0.txt`
- `JS_FAST_DEPLOYMENT_GUIDE.md`
- `README_V5_0.md`
- `README_v4.2.md`
- `SMALL_BUSINESS_v3_2_0_SUPABASE_SETUP.md`
- `SMALL_BUSINESS_v3_3_0_PAYMENT_TRIAL_OFFERS_SETUP.md`
- `STEP_BY_STEP_V5_0.md`
- `STEP_BY_STEP_v4.2.md`
- `STEP_BY_STEP_v4_2_EMPLOYEE_REGISTRATION.md`
- `src/README.md`
- `src/STEP_BY_STEP_v4_2_1.md`

## Duplicate folders seen in the repository

If they still exist and are not imported anywhere, remove:

- `src/src/`
- `src/backend/`

The real application source should stay under the root `src/` folder.
The real SQL migration folder should stay at root `backend/`.

## Old SQL files

After you have a database backup and Suite 1.0 is confirmed working, older migration
files can be moved to a `/docs/legacy-migrations/` folder or removed from the deploy repo.
Deleting a SQL file from GitHub does NOT undo a migration already applied to Supabase.

Keep the current migration:

- `backend/sb_suite_1_0_upgrade.sql`

## DO NOT DELETE

Do not delete:

- `src/hooks/useAuth.js`
- `src/components/LoginPage.jsx`
- `supabase/functions/activate-company-user/`
- `.github/workflows/`
- `src/config/supabase.js`
- `src/services/database.js`
- `src/services/commerce.js`
- `backend/sb_suite_1_0_upgrade.sql`
- `public/images/`
- current Supabase configuration / secrets

The employee registration function is already working and Suite 1.0 intentionally preserves it.
