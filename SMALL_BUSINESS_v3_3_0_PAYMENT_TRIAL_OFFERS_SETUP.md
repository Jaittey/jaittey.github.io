# Small Business (SB) v3.3 — Payment, Trial & Custom Offers Upgrade

## What this update fixes
- Fixes the Supabase `column reference "detected_amount" is ambiguous` RPC error by qualifying database columns and using a non-conflicting local variable.
- Removes automatic payment rejection from the subscriber flow.
- Removes Payer / Account Name, Contact Number, Business Registration Number, Identity / Verification Reference and Notes from the payment form.
- Users only choose the package/offer, bank, and upload a transfer/deposit slip.
- Slip formats are no longer validated as BML/MIB templates because both banks can produce multiple layouts.
- Automatic checks are limited to: exact duplicate image fingerprint and detected amount versus expected amount.
- Duplicate/mismatched/unreadable slips are still submitted. Only the Super Admin sees the review issues.
- Super Admin can approve any submitted slip, including a suspicious or fake-looking slip.
- Adds a 7-day VIP Platinum trial to every newly registered normal business.
- Adds Super Admin custom offers such as 6 months, 90 days, 2 years, or Lifetime.
- Fixes the intermittent Supabase Realtime `cannot add postgres_changes callbacks ... after subscribe()` profile-channel race by using a unique channel generation.

## Important payment design
The automatic slip check is an assistant to the Super Admin, not a bank-verification system. The application cannot prove from an image alone that money actually reached the bank account. Every uploaded slip therefore remains pending until the Super Admin checks it and chooses Approve or Reject.

## Step 1 — Back up the working v3.2 repository
GitHub → Code → Download ZIP.

Do not delete the current Supabase project or its data.

## Step 2 — Download and extract v3.3
Use `Small_Business_v3_3_0_Payment_Trial_Offers.zip`.

Replace these folders in GitHub:
- `src`
- `public`
- `backend`

Replace these files:
- `index.html`
- `package.json`
- `vite.config.js`
- `README.md`

Keep your GitHub repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPER_ADMIN_EMAIL`
- `VITE_GOOGLE_CLIENT_ID`

The included GitHub Pages workflow uses Node 22, `npm install`, and passes the Supabase variables to the Vite build.

## Step 3 — Upgrade the existing Supabase database
This is mandatory before opening the new app.

Supabase → SQL Editor → New Query.

Open:
`backend/sb_v3_3_payment_upgrade.sql`

Copy the complete SQL file into the SQL Editor and click Run.

The migration:
- adds TRIAL and CUSTOM subscription periods,
- creates `platform_custom_offers`,
- adds custom-offer fields to subscriptions and payment requests,
- replaces the broken payment RPC,
- fixes the `detected_amount` ambiguity,
- changes payment handling to pending/manual review,
- lets Super Admin approve every receipt,
- adds the 7-day trial for new businesses,
- enables Realtime for custom offers.

Expected result: `Success. No rows returned.`

If the migration reports an error, stop and send the exact SQL error before deploying the frontend.

## Step 4 — Upload v3.3 to GitHub
Commit message:
`Upgrade SB payment verification, free trial and custom offers`

GitHub Actions should automatically start.

Wait for:
- Build ✅
- Deploy ✅

Open:
`https://jaittey.github.io/?build=sb-v3-3-payment`

If an old version appears, clear the service worker/site data and reload.

## Step 5 — Test the simplified payment flow
1. Sign in as a Company Administrator.
2. Open Subscription.
3. Select Monthly or Yearly for a standard VIP package, or select a Special Offer.
4. Select BML or MIB.
5. Transfer the exact amount.
6. Upload any BML/MIB transfer or deposit slip image.
7. SB tries to read only the amount and creates a SHA-256 fingerprint for exact duplicate detection.
8. Click Submit for Verification.
9. The user always receives a normal submission confirmation.
10. The request appears in Super Admin → Verification Queue.

The user no longer enters payer name, contact number, BR number, identity reference or notes.

## Step 6 — Test issue handling
### Wrong amount
Upload a slip with a different amount. It must still submit.

Super Admin should see a review note that the detected amount does not match the expected amount.

### Unreadable amount
Upload a slip where OCR cannot read the amount. It must still submit.

Super Admin should see “Transferred amount could not be detected automatically.”

### Exact duplicate
After Super Admin finishes/rejects the first request, submit the exact same image again. It must still submit, but Super Admin should see a duplicate warning.

The application intentionally does not auto-reject these cases.

## Step 7 — Super Admin verification
Open:
Super Admin → Verification Queue

For every request the Super Admin can see:
- uploaded full slip,
- business,
- selected package/offer,
- selected bank,
- expected amount,
- detected amount,
- OCR confidence,
- system review notes.

Buttons:
- Approve & Activate
- Request Info
- Reject

`Approve & Activate` is available even when a slip has duplicate, amount, OCR, or other review notes. The final decision is always the Super Admin's.

## Step 8 — 7-day free trial
For every new normal business registration, Supabase automatically creates:
- Plan: VIP Platinum
- Name: 7-Day Free Trial
- Status: ACTIVE
- Duration: 7 days
- Price: MVR 0

During the trial the business receives Platinum access. When `ends_at` passes, subscription access expires automatically and the Administrator is directed to the Subscription page.

The fixed platform Super Admin remains on complimentary Founder Platinum access so the platform can always be administered.

During the v3.3 migration, existing businesses that do not currently have a valid ACTIVE subscription also receive one 7-day Platinum trial. Active paid/lifetime subscriptions are not overwritten.

## Step 9 — Create custom offers
Sign in as Super Admin.

Open:
Super Admin → Custom Offers → Create Offer

Enter:
- Offer Name — e.g. `6 Months Platinum`
- Access Level — VIP Silver / Gold / Platinum
- Price — e.g. `249`
- Duration Type — Days / Months / Years / Lifetime
- Duration — e.g. `6` when Months is selected
- Description
- Active

Examples:
### 6 Months Gold
- Access: VIP Gold
- Price: MVR 299
- Duration Type: Months
- Duration: 6

### Lifetime Platinum
- Access: VIP Platinum
- Price: MVR 2,999
- Duration Type: Lifetime

Lifetime subscriptions use no expiry date after Super Admin approval.

## Step 10 — Verify custom offer activation
1. Create a test custom offer.
2. Sign into a normal business.
3. Open Subscription.
4. Confirm the offer appears under Special Offers.
5. Select it and upload a slip.
6. Approve it as Super Admin.
7. Confirm the subscriber receives the offer's selected access level and duration.

## Step 11 — Realtime error fix
The earlier transient error:
`cannot add postgres_changes callbacks ... after subscribe()`
was caused by overlapping authentication session initialization reusing the same Realtime channel topic.

v3.3 gives each profile subscription a unique generation/topic, preventing callbacks from being added to a channel that has already been subscribed.

## Final checklist
- v3.3 SQL migration ran successfully
- GitHub Actions Build ✅
- GitHub Actions Deploy ✅
- Existing business data still visible
- Existing subscriptions still visible
- New businesses receive 7-day Platinum trial
- No payer/contact/BR/identity form on Subscription payment
- BML slip can be submitted
- MIB slip can be submitted
- Different slip layouts can be submitted
- Wrong amount still submits
- Unreadable slip still submits
- Exact duplicate still submits but is flagged to Super Admin
- Super Admin can approve every request
- Custom 6-month offer works
- Custom Lifetime offer works
- Realtime profile error no longer appears during login/refresh
