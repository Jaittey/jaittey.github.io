# Small Business (SB) v3.2.0 — Supabase Database & Storage Setup

## What changed

Small Business no longer uses Firebase Authentication, Firestore or Firebase Storage.

v3.2 uses Supabase for:

- Google and email/password authentication
- Postgres database
- Row Level Security (RLS)
- private company asset storage
- private subscription receipt storage
- Realtime data updates
- secure PostgreSQL RPC functions for sensitive multi-record operations

The existing Google Drive feature remains separate and is still available for VIP Platinum backup/document workflows.

## Data design

The core relational tables are:

- `platform_users`
- `businesses`
- `business_memberships`
- `business_subscriptions`
- `business_records`
- `company_assets`
- `contract_generated_periods`
- `platform_plan_settings`
- `platform_payment_methods`
- `platform_bank_accounts`
- `subscription_requests`
- `subscription_payments`
- `subscription_receipt_references`
- `subscription_receipt_hashes`
- `mail_queue`

Existing ERP records retain their current JavaScript document shape inside `business_records.data` JSONB. This lets the present Invoice, Payroll, Attendance, CRM, Inventory and Report pages continue working without a destructive rewrite while tenant isolation is enforced by Postgres.

## Storage buckets

The setup SQL creates three private buckets:

### `company-assets`
Stores company logo, stamp and manager signature.

### `subscription-receipts`
Stores BML/MIB subscription payment slips. Files are private. Company Administrators can upload/view their own business receipts and the Super Admin can review them.

### `business-files`
Reserved for tenant documents and future employee/customer/contract file uploads.

## One business rule

Each authenticated account can OWN/register a maximum of one business because `businesses.owner_id` is unique and the registration RPC checks it again.

An account may still be invited into another company's workspace as a Manager/User. That does not create a second owned business or a second subscription for that user.

Each business has one `business_subscriptions` row, so only one current subscription exists for a business.

## Subscription security

Silver, Gold and Platinum access is checked twice:

1. React navigation/access logic hides unavailable modules.
2. Supabase RLS checks the signed-in user's business membership, role, custom permissions and active subscription package before allowing database operations.

The browser never receives a Supabase Secret/service-role key.

## Receipt verification

Subscription receipts are uploaded to the private `subscription-receipts` bucket.

The browser OCR reads the visible bank, amount and reference. Before a subscription request is stored, a protected Postgres RPC also checks:

- the requester is the Company Administrator
- the plan exists and is active
- the expected monthly/yearly price comes from the database, not from browser input
- BML/MIB account configuration comes from the database
- the receipt file exists under the correct business Storage folder
- duplicate transaction reference
- duplicate SHA-256 receipt hash
- selected bank versus OCR-detected bank
- detected amount versus configured subscription price
- BML visible destination account versus configured BML account
- required reference/hash fields

Objective failures become `AUTO_REJECTED`. An automatically rejected receipt cannot be activated; the subscriber must submit a new valid receipt.

MIB receipts that do not visibly show the destination account number are not falsely rejected solely for that reason. They receive a manual-verification warning.

A receipt image cannot cryptographically prove that a bank transfer actually settled. Therefore a receipt that passes automated checks remains `PENDING_VERIFICATION` until the Super Admin confirms the actual bank transaction.

# Deployment — exact order

## Step 1 — Create a safety backup BEFORE replacing Firebase

On the currently working v3.1 app:

1. Sign in as Administrator.
2. Open **Administration → Backup & Restore**.
3. Connect Google Drive.
4. Create a fresh backup.
5. Refresh the backup list and confirm the file is visible.
6. Also download the current GitHub repository ZIP as a second safety copy.

Do not delete the existing Firebase project yet.

## Step 2 — Create/open the Supabase project

Open your Supabase project and keep these two browser-safe values ready:

- Project URL
- Publishable key

Do not use the Supabase Secret key or legacy `service_role` key in GitHub Pages/Vite.

## Step 3 — Run the Small Business database setup

In Supabase:

1. Open **SQL Editor**.
2. Select **New query**.
3. Open `backend/supabase_schema.sql` from this package.
4. Copy the COMPLETE SQL file.
5. Paste it into the SQL Editor.
6. Select **Run**.
7. Wait until the query finishes without errors.

The script creates the database tables, indexes, RLS functions/policies, private Storage buckets, Storage policies, RPC functions, default BML/MIB details and Realtime publication entries.

## Step 4 — Check the created tables

Open **Table Editor** and confirm at least these tables exist:

- `platform_users`
- `businesses`
- `business_memberships`
- `business_subscriptions`
- `business_records`
- `platform_plan_settings`
- `platform_bank_accounts`
- `subscription_requests`
- `subscription_payments`

Do not manually disable RLS.

## Step 5 — Check Supabase Storage

Open **Storage** and confirm these private buckets exist:

- `company-assets`
- `subscription-receipts`
- `business-files`

They are created by the SQL script. Do not make the receipt or company-asset buckets public.

## Step 6 — Configure Google sign-in in Supabase

Open **Authentication → Providers → Google** and enable Google.

In Google Cloud Console create/configure the OAuth web client for Small Business.

For the current GitHub Pages site use:

Authorized JavaScript origin:

`https://jaittey.github.io`

Authorized redirect URI for Google:

`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

Use the exact callback URL shown by Supabase in the Google provider configuration screen.

Copy the Google OAuth Client ID and Client Secret into the Supabase Google provider settings and save.

## Step 7 — Configure Supabase Auth redirect URLs

Open **Authentication → URL Configuration**.

Set Site URL to:

`https://jaittey.github.io/`

Add this redirect URL:

`https://jaittey.github.io/`

If you later move SB to another domain, add the new exact application URL before switching DNS/deployment.

## Step 8 — Replace the GitHub project

Extract `Small_Business_v3_2_0_Supabase.zip`.

Replace these folders in the GitHub repository:

- `src`
- `public`
- `backend`

Replace these root files:

- `index.html`
- `package.json`
- `vite.config.js`
- `README.md`
- `.env.example`

Keep:

- `.github/workflows/deploy-pages.yml` from the new package

Firebase-specific files are intentionally removed in v3.2.

## Step 9 — Change GitHub Actions secrets

Open:

**GitHub Repository → Settings → Secrets and variables → Actions**

Create/update:

### `VITE_SUPABASE_URL`
Value: your Supabase Project URL.

### `VITE_SUPABASE_PUBLISHABLE_KEY`
Value: your Supabase Publishable key.

### `VITE_SUPER_ADMIN_EMAIL`
Value:

`jaeitte@gmail.com`

### `VITE_GOOGLE_CLIENT_ID`
Keep/add this only for the existing Google Drive integration.

The frontend does NOT need a database password, Supabase Secret key, JWT secret or service-role key.

You can leave the old Firebase GitHub secrets temporarily while testing, but v3.2 does not read them. After the Supabase deployment is confirmed, remove the old Firebase secrets to reduce confusion.

## Step 10 — Commit and deploy

Recommended GitHub commit message:

`Migrate Small Business database and storage to Supabase`

Open **Actions** and wait for:

- Build ✅
- Deploy ✅

Then open:

`https://jaittey.github.io/?build=sb-v3-2-supabase`

If the previous version appears on iPhone, clear Safari website data for `jaittey.github.io` and reopen the link.

# Migrating the existing Firebase business

## Step 11 — Sign into the Supabase version

Sign in with Google using the same Administrator email you want to own the company.

Supabase creates a new Supabase Auth identity. Firebase Auth IDs are not reused.

## Step 12 — Register the existing company

Register Dhinasha Family 7 / DF7 as the business in Small Business.

The registration creates:

- a Supabase `businesses` row
- Administrator membership
- business settings record
- isolated tenant workspace

The fixed Super Admin account receives complimentary Platinum access for its own registered business.

## Step 13 — Restore the v3.1 Google Drive backup

Open:

**Company Administration → Backup & Restore**

1. Connect Google Drive.
2. Refresh backup list.
3. Select the v3.1 backup created before migration. v3.2 also scans accessible older `SB_Backup_...json` and `DF7_Backup_...json` files, so the backup can still be discovered when the old Firebase version used a different Drive root folder.
4. Type the restore confirmation phrase.
5. Restore.

The v3.2 restore code accepts the previous Firebase tenant backup format and converts serialized Firestore timestamp/date values into ordinary ISO date values before writing them to Supabase.

The new Supabase business ID is preserved. The old Firebase tenant ID is not allowed to overwrite the Supabase tenant.

## Step 14 — Verify migrated records

Check these modules before considering migration complete:

- Customers
- Quotations
- Invoices
- Inventory
- Employees
- Attendance
- Payroll
- Salary Slips
- Expenses
- Budgets
- Company logo/stamp/signature

Create one test invoice and one test attendance entry after migration to confirm new Supabase writes work.

# Subscription configuration

## Step 15 — Configure Silver, Gold and Platinum prices

Open:

**Super Admin → Packages**

Set both:

- Monthly price
- Yearly price

for VIP Silver, VIP Gold and VIP Platinum.

## Step 16 — Confirm BML/MIB accounts

Open:

**Super Admin → Bank Accounts**

Default BML:

- Account holder: Ali Jailam
- Account number: 7709516071101

Default MIB:

- Account holder: Ali Jailam
- Account number: 90103100571591000

The Super Admin can change either account later. Subscriber checkout reads the current database values.

# Receipt tests

## Step 17 — BML test

Use a package price matching a test transfer.

Expected automatic checks include:

- BML detected
- amount detected
- BLAZ-style transaction reference detected
- visible destination account matches the configured BML account
- receipt file exists in the correct Supabase Storage tenant folder
- no duplicate reference
- no duplicate image hash

## Step 18 — MIB test

Expected automatic checks include:

- MIB detected
- amount detected
- Reference # detected
- duplicate checks

The supplied MIB receipt style does not visibly contain the destination account number. SB therefore adds a manual-verification warning instead of claiming to verify an account number that is not shown.

## Step 19 — Duplicate test

1. Submit a receipt once.
2. Upload the exact same image again: the SHA-256 file hash should be rejected as duplicate.
3. Submit another image containing the same bank/reference: the normalized transaction reference should be rejected as duplicate.
4. Auto-rejected requests remain visible to Super Admin for audit, but cannot be activated.

# Role and tenant tests

## Step 20 — Test isolation with two businesses

Use two separate Google owner accounts.

Each owner should be able to register one owned business.

Verify Business A cannot read Business B customers, invoices, payroll, company assets or receipt files.

## Step 21 — Test an invited company user

From Company Users add another person's email as Manager/User.

When that person signs in using the same email, `sb_claim_membership` attaches their Supabase Auth user ID to the pre-created membership.

An invited user may belong to a company and can still own at most one separately registered business. Subscription and role permissions are evaluated independently for each selected workspace.

# Security notes

- RLS is the actual database security boundary; hiding menu items is not treated as security.
- Private Storage access is also controlled through RLS policies on `storage.objects`.
- Subscription receipts use short-lived signed URLs for Super Admin preview.
- Sensitive multi-record operations use PostgreSQL RPC functions instead of trusting browser-side batches.
- The Super Admin identity is also enforced in SQL as `jaeitte@gmail.com`; changing only the frontend variable does not grant Super Admin database rights.
- A normal user cannot reactivate a suspended platform account by editing their own profile.
- Subscription request/payment rows cannot be inserted directly by clients; the validated receipt RPC must be used.

# Email notification note

The subscription workflow writes guaranteed notification jobs to the Supabase `mail_queue` table. This keeps subscription verification functional even when an external email provider is not configured.

To deliver real emails, connect `mail_queue` to a server-side mail provider using a Supabase Edge Function or another trusted backend. Never place an email-provider secret/API key in the Vite frontend.

# Final production checklist

1. Supabase SQL completed without errors.
2. RLS remains enabled.
3. Private Storage buckets exist.
4. Google OAuth provider works on `jaittey.github.io`.
5. GitHub uses the Supabase Project URL + Publishable key only.
6. Super Admin account is `jaeitte@gmail.com`.
7. Old Firebase backup is safely stored.
8. Existing company restored and verified.
9. Silver/Gold/Platinum monthly and yearly prices set.
10. BML/MIB account details checked.
11. Receipt upload opens from Super Admin using a signed URL.
12. Duplicate reference test passes.
13. Duplicate image-hash test passes.
14. Auto-rejected receipt cannot be activated.
15. Two-business isolation test passes.
16. Manager/User permission test passes.
17. Google Drive still works for Platinum if configured.
