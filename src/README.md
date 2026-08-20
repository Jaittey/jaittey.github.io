# Small Business v4.2.1 Employee Registration Fix

This patch replaces the Edge-Function-based employee registration introduced in
v4.2 with a simpler Supabase Auth + PostgreSQL RPC workflow.

Replace:
- src/hooks/useAuth.js

Run:
- backend/sb_v4_2_1_employee_registration_no_edge.sql

Optional:
- src/config/brand.js

Then follow STEP_BY_STEP_v4_2_1.md.
