# Small Business (SB) v3.3.0 — Supabase Edition

Small Business is a multi-company business-management web application for GitHub Pages.

## Backend

v3.3 removes Firebase from the application backend and uses:

- Supabase Auth for Google and email/password authentication
- Supabase Postgres for application data
- PostgreSQL Row Level Security for company/subscription/role isolation
- Supabase Storage for private subscription receipts and company branding files
- Supabase Realtime for live data refresh between open sessions
- PostgreSQL RPC functions for atomic invoice stock changes, recurring invoices, payments, final settlements and subscription receipt verification

The existing optional Google Drive integration is retained for VIP Platinum document/backup workflows.

## Setup

Read `SMALL_BUSINESS_v3_2_0_SUPABASE_SETUP.md` before deployment.

Run `backend/supabase_schema.sql` in the Supabase SQL Editor before opening the deployed app. The SQL creates the required tables, RLS policies, Storage buckets/policies, RPC functions and Realtime publication entries.

## Browser environment

Use only:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPER_ADMIN_EMAIL=jaeitte@gmail.com
VITE_GOOGLE_CLIENT_ID=
```

Never put a Supabase Secret key or legacy `service_role` key into this frontend project.

## Existing Firebase data

Before replacing a live v3.1 Firebase deployment, create a Google Drive backup from the old app. After v3.3 is deployed, register the business in Supabase and restore that old backup from Company Administration → Backup & Restore.

The restore service accepts the previous Firebase tenant-backup format and keeps the new Supabase business ID.


## v3.3 Payment & Subscription Update
- 7-day VIP Platinum trial for new businesses
- Flexible Super Admin custom offers (days/months/years/lifetime)
- Subscriber payment form reduced to package/offer + bank + slip upload
- Only exact duplicate-image and amount checks are performed automatically
- All slips remain manually approvable by Super Admin
- Fixed ambiguous `detected_amount` RPC error
- Fixed profile Realtime channel race
