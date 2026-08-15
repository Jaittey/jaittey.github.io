# Small Business v3.2 — Supabase backend

The Firebase backend has been removed.

Run `supabase_schema.sql` once in **Supabase Dashboard → SQL Editor → New query**.
The script creates the Postgres tables, indexes, Row Level Security policies, RPCs, private Storage buckets, Storage policies, and Realtime publication entries used by the app.

Do not run the old Firebase rules. They are not included in v3.2.

Frontend configuration uses only the Supabase Project URL and Publishable key. Never place a Supabase Secret key or legacy `service_role` key in Vite, GitHub Pages, or browser code.
