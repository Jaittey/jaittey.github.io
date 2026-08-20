# Small Business v4.2.1 — Employee Registration Fix

## What this fixes

The previous v4.2 frontend called:

`supabase.functions.invoke('activate-company-user')`

A file inside the GitHub repository does **not** automatically become a deployed
Supabase Edge Function. Therefore the live app showed:

`Employee registration service is not available yet.`

v4.2.1 removes the Edge Function dependency completely.

The new workflow uses:

1. Existing `business_memberships`
2. A small Postgres RPC to check the Administrator-created employee membership
3. Normal Supabase password signup
4. Existing `sb_claim_membership()` to attach the Auth UUID
5. Automatic sign-out after registration
6. Employee then signs in through the Email tab

---

# STEP 1 — Supabase Auth setting (REQUIRED)

Open:

Supabase Dashboard
→ Authentication
→ Providers
→ Email

Make sure:

- Email provider = ON
- Allow new users to sign up = ON
- **Confirm Email = OFF**

This is required.

When Confirm Email is OFF, Supabase considers the email implicitly confirmed and
the password account can sign in immediately.

If you previously tested an email while Confirm Email was ON, delete that OLD
test user from:

Authentication → Users

Then test again.

---

# STEP 2 — Run the SQL fix

Open:

Supabase
→ SQL Editor
→ New Query

Open this file from the ZIP:

`backend/sb_v4_2_1_employee_registration_no_edge.sql`

Copy the entire SQL into Supabase and click Run.

Expected result:

Success. No rows returned.

This creates:

`sb_employee_registration_check(email, name)`

and refreshes:

`sb_claim_membership()`

It does NOT create `company_users`.

---

# STEP 3 — Replace the frontend file

In GitHub replace:

`src/hooks/useAuth.js`

with the new v4.2.1 file.

Optional version label:

Replace:

`src/config/brand.js`

with the included version.

No Edge Function is required.

You can leave the old `supabase/functions/activate-company-user` folder in the
repository or delete it later. The frontend no longer calls it.

---

# STEP 4 — Commit and deploy

Commit the files to `main`.

Wait for:

GitHub → Actions → Deploy Small Business to GitHub Pages

Both must become green:

- build
- deploy

Then open:

https://jaittey.github.io/

Hard refresh once.

---

# STEP 5 — Test with a NEW employee

Administrator:

1. Sign in with Google.
2. Open Users & Permissions.
3. Add:
   - Name: hussain
   - Email: use a fresh test email
   - Role: User
4. Save.
5. Confirm card says WAITING REGISTRATION.

Employee:

1. Sign out.
2. Open Register.
3. Enter the exact Administrator-provided name.
4. Enter the exact Administrator-provided email.
5. Create an 8+ character password.
6. Click Activate employee account.

Expected message:

`Employee account activated. Enter the password you just created and sign in.`

The app switches to Email login.

Then enter:

- same email
- same password

and click Sign in.

The employee should open the company workspace with the permissions assigned by
the Administrator.

---

# IMPORTANT — your current `hussain@sb-user.com` test

Before using that same email again, check:

Supabase
→ Authentication
→ Users

If `hussain@sb-user.com` already exists from one of the failed registration
attempts, delete that Auth user first.

Do NOT delete the pending `business_memberships` row created by the Administrator.

The membership should remain:

- email = hussain@sb-user.com
- display_name = hussain
- active = true
- user_id = NULL

Then register again after Confirm Email is OFF.

---

# Why this version is simpler

There is no:

- Edge Function deployment
- service-role secret
- Edge Function JWT setting
- confirmation-email dependency

The browser cannot read other companies' memberships. The public RPC returns
only a yes/no registration decision.

An uninvited Supabase Auth user still cannot open a company workspace because
company access remains controlled by `business_memberships` and RLS.
