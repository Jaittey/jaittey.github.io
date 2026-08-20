# v5.0 Validation Report

Checks completed before packaging:

- JSX/JavaScript syntax parsed successfully with TypeScript (`allowJs`, JSX parsing, no emit).
- Plain JavaScript config/service files passed syntax parsing.
- New modules use only dependencies already present in the current project; no npm package was added.
- Existing Supabase project was checked for required foundations:
  - `business_records` exists.
  - `business_memberships` exists.
  - `sb_can_use(uuid,text)` exists.
  - `sb_plan_id(uuid)` exists.
  - `sb_email()` exists.
  - `sb_platform_active()` exists.
- Existing `business_records` RLS was reviewed. The v5 migration updates `sb_collection_feature()` so the new business-record collections participate in the existing tenant/security policies.
- Existing employee login/activation code is not replaced by this upgrade.
- Service worker cache is bumped to `sb-v5-commerce-500` to reduce stale v4 deployments.

Production migration has intentionally NOT been applied by this manual ZIP. Run the included SQL first when you are ready to install v5.0.
