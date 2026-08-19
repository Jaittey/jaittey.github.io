# Small Business (SB) v4.1 — JS Fast Edition

React + Vite + Supabase version of Small Business.

## Main goals

- Fast initial load using code splitting
- Load only the Supabase data required by the active page
- Lazy-load OCR only when a bank slip is uploaded
- Stable Supabase Realtime subscriptions
- No blank white page on React render errors
- Keep all v3.3 subscription/trial/custom-offer behavior
- Add the POS workflow from the HTML v4 line

## Backend

This release uses the same Supabase schema as the v3.3/v4 HTML line.

For a fresh database run:

1. `backend/supabase_schema.sql`
2. `backend/sb_v3_3_payment_upgrade.sql`
3. `backend/sb_v3_4_pos_upgrade.sql`

For an existing working HTML v4.0.1 deployment, keep the current Supabase data and only re-run `sb_v3_4_pos_upgrade.sql` if POS has not already been installed.

See `JS_FAST_DEPLOYMENT_GUIDE.md` for deployment instructions.
