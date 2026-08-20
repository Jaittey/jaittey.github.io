# Small Business v4.2 — Employee Registration

## New workflow

### Company Administrator
1. Sign in with Google.
2. Open **Users & Permissions**.
3. Click **Add employee login**.
4. Enter the employee's **Name** and **Email**.
5. Select **Manager** or **User**.
6. Configure permissions if required.
7. Save.

The membership is saved in the existing `business_memberships` table with `user_id = NULL`.

The user card shows **WAITING REGISTRATION**.

### Employee
1. Open the Small Business login page.
2. Open **Register**.
3. Enter the exact **Name** supplied by the Administrator.
4. Enter the exact **Email** supplied by the Administrator.
5. Create a password of at least 8 characters.
6. Click **Activate employee account**.
7. The screen switches to **Email** login.
8. Enter the same email and password.
9. Click **Sign in**.

The employee is then loaded into the business workspace with the role and permissions assigned by the Administrator.

---

## 1. Back up the current project

Create a backup branch or download the repository ZIP before replacing files.

## 2. Run the SQL migration

Open:

Supabase → SQL Editor → New Query

Run:

`backend/sb_v4_2_employee_registration.sql`

This creates only:

`company_user_activation_attempts`

It does NOT modify your existing `business_memberships` table or its RLS policies.

## 3. Create the Edge Function

In Supabase, create/deploy a function named exactly:

`activate-company-user`

Use:

`supabase/functions/activate-company-user/index.ts`

The function needs the standard Supabase server environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These belong inside Supabase only.

NEVER put `SUPABASE_SERVICE_ROLE_KEY` in:
- GitHub Pages
- VITE_* variables
- src/
- public/
- browser JavaScript

### JWT setting

This registration endpoint is intentionally callable before the employee has a login session.

Deploy it with JWT verification disabled.

The included:

`supabase/config.toml`

contains:

```toml
[functions.activate-company-user]
verify_jwt = false
```

If deploying with the CLI, you can also use the appropriate no-JWT verification option for this function.

## 4. Replace frontend files

Replace these files in the current repository:

- `src/components/LoginPage.jsx`
- `src/hooks/useAuth.js`
- `src/pages/UserManagement.jsx`
- `src/services/companyUsers.js`

Add:

- `supabase/functions/activate-company-user/index.ts`
- `supabase/config.toml`
- `backend/sb_v4_2_employee_registration.sql`

## 5. Important: do not use the old v4.2 SQL

Do NOT run the older file that references:

`public.company_users`

Your live database uses:

`public.business_memberships`

The new v4.2 migration intentionally does not create another membership table.

## 6. Existing RLS policies stay unchanged

Keep the current:

- memberships_select
- memberships_insert
- memberships_update
- memberships_delete

The existing application already uses:
- `sb_is_super_admin()`
- `sb_is_business_admin(business_id)`

No policy replacement is required for this update.

## 7. Deploy GitHub Pages

Commit the frontend files to `main`.

The existing GitHub Action should run:

- Install dependencies
- Build application
- Verify build output
- Deploy

Wait for both **build** and **deploy** to become green.

## 8. Test

Use a NEW test email not already present in Supabase Auth.

### Administrator test
1. Add `Test Employee`.
2. Add a test email.
3. Save as User.
4. Confirm the card says `WAITING REGISTRATION`.

### Employee test
1. Sign out.
2. Open Register.
3. Enter `Test Employee`.
4. Enter the test email.
5. Create an 8+ character password.
6. Activate account.
7. Open Email login.
8. Enter the same email/password.
9. Sign in.

Expected:
- no confirmation email
- no "email rate limit exceeded"
- no "Email not confirmed"
- employee opens the existing company workspace
- employee has only assigned permissions

## 9. Existing broken test users

If a test email already exists in Supabase Authentication from the old public-register process, use another email for the first test.

After v4.2 works, clean up obsolete test Auth users and matching test memberships carefully.

## Security note

This exact workflow uses the Administrator-provided Name + Email as the employee activation proof, because that is the requested UX.

It is safer than open public signup because registration succeeds only when a pending active `business_memberships` row exists and the normalized name matches. The function also rate-limits attempts.

For higher security later, add a one-time invitation code without changing the rest of the flow.
