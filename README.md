# Small Business v4.2 — Employee Registration

Patch for the current Small Business JS/Vite/Supabase application.

Implements:
- Administrator adds employee Name + Email + Role + Permissions
- Membership remains pending with `user_id = NULL`
- Employee uses Login → Register to create their own password
- Secure Supabase Edge Function creates the Auth account with email confirmed
- Function attaches the new Auth UUID to existing `business_memberships`
- Employee then signs in from the Email tab
- No public uninvited email registration
- No confirmation-email dependency
- Rate-limited activation attempts

See `STEP_BY_STEP_v4_2_EMPLOYEE_REGISTRATION.md`.
