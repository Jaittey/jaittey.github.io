# Small Business Suite 1.0

Manual upgrade package for the current React/Vite/Supabase Small Business application.

## Key changes
- Rebuilt left navigation using the supplied navigation design.
- Fixed invoice / quotation PDFs, including POS-schema line items.
- Discount, taxable amount and GST now render correctly.
- Added Super Admin App Settings with protected test-data cleanup.
- Retired Firebase Migration UI.
- Active subscribers default to Dashboard without subscription redirect loops.
- Company Administrator exclusively configures Adaptive POS.
- Managers/Users automatically use the Administrator's saved company POS mode.
- Added custom theme colors, transparency, blur, radius, density and sidebar width.
- Rebranded to Small Business Suite 1.0.
- New Service Worker cache key prevents stale v5 UI.

Start with `STEP_BY_STEP_SUITE_1_0.md`.

Important: this ZIP is a complete **Suite 1.0 upgrade package** for the current repository.
It intentionally does not overwrite the already-working authentication/employee activation files.
