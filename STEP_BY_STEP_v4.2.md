# Small Business v4.2 — Company User Login Fix

## What v4.2 fixes

The public Register screen is for a person creating their own SB account/business.
Company employees must NOT be created through that screen.

v4.2 adds a protected server-side flow:

Administrator → Users & Permissions → Create company login → Supabase Edge Function → Auth user + company membership.

This avoids the repeated confirmation-email flow that caused:
- `email rate limit exceeded`
- `Email not confirmed`
- security cooldown messages

It also prevents the Supabase service-role key from being exposed in GitHub Pages.

## Step 1 — Back up v4.1

In GitHub create a branch/tag such as `backup-v4.1` before changing files.

## Step 2 — Run the SQL migration

Supabase → SQL Editor → New query.

Open:
`backend/sb_v4_2_company_user_login.sql`

Paste the whole file and click **Run**.

Do not delete your existing company_users records.

## Step 3 — Add the Edge Function

Create:

`supabase/functions/create-company-user/index.ts`

Use the supplied file.

The function verifies the signed-in caller is an ACTIVE Administrator of the same company before it uses Supabase Admin Auth.

## Step 4 — Deploy the Edge Function

Using Supabase CLI:

`supabase functions deploy create-company-user`

If you use the Supabase Dashboard function editor instead, create a function named exactly:

`create-company-user`

and paste `index.ts`.

The function needs these server-side values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never put `SUPABASE_SERVICE_ROLE_KEY` in GitHub, Vite variables, `src/`, `public/`, or browser JavaScript.

## Step 5 — Add the frontend service

Copy:

`src/services/companyUsers.js`

into the same location in the current project.

IMPORTANT: If your configured Supabase client has a different path/name, change only this line:

`import { supabase } from "../config/supabase";`

to point at your existing Supabase client.

## Step 6 — Update Users & Permissions

Do not replace your full current Administration page.

Use `ADMIN_PAGE_INTEGRATION.jsx` as the integration example.

The Administrator form should contain:
- Display name
- Email
- Temporary password (minimum 8 characters)
- Role: Manager or User
- Permissions

On submit call `createCompanyLogin()`.

Do NOT call:
- `supabase.auth.signUp()` for company employees
- public Register logic
- `auth.admin.createUser()` in browser code

## Step 7 — Public Register stays separate

Keep the existing Register tab for a NEW BUSINESS OWNER.

New owner:
Register/Google → create own company → Administrator.

Employee:
Administrator creates login → employee uses Email tab → signs in → opens existing company.

An employee must not create another company automatically.

## Step 8 — Test

Create a test employee:
- Name: Test Employee
- Email: an email not already used in Supabase Auth
- Password: at least 8 characters
- Role: User

Expected:
1. Administrator receives “Login created”.
2. User appears once in Users & Permissions.
3. No confirmation email is required for this admin-created login.
4. Employee can immediately use Email login.
5. Employee sees only the company they were attached to.
6. Employee cannot access Administrator-only user creation.
7. A duplicate email in the same company is rejected.

Then create a Manager and test Manager permissions.

## Step 9 — Existing broken test users

If a previous test account exists in `Authentication → Users` but was created incompletely:
1. Confirm it is not a real user account you need.
2. Remove the broken test membership from company_users.
3. Remove the broken test Auth user from Supabase Authentication.
4. Create it again through the new v4.2 Administrator flow.

Do not repeatedly press public Register; that is what triggers email rate limits.

## Step 10 — Deploy GitHub Pages

Commit the frontend changes to `main`.
Let the existing GitHub Actions/Vite Pages workflow build the site.
Then hard refresh the mobile browser and test again.

## Security checks

- Publishable/anon key: allowed in browser.
- Service-role/secret key: server-side Edge Function only.
- Every create-user request checks caller identity.
- Caller must be Administrator of the requested company.
- Company membership is bound to the newly created Auth UUID.
- Duplicate company+user and company+email records are blocked.
