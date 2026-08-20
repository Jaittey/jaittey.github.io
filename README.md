# Small Business Suite 1.0 — Theme, Navigation & Branding Update

This package is designed for the current `Jaittey/jaittey.github.io` Small Business Suite 1.0 project.

## Included updates

- Theme presets now change the navigation colors too.
- Navigation always stays in a darker matching shade for readability.
- Custom theme Navigation Base Color is automatically darkened in the real navigation.
- Selecting a preset disables custom overrides so the whole app changes together.
- Added supplied Small Business Suite white/black logo assets.
- Added supplied navigation icons for Dashboard, Sales & Commerce, Inventory & Operations, Employee Management, Financial Management, Application Manager and Super Admin.
- Added supplied default User Profile icon.
- Removed the user name/role text from the bottom of the sidebar; the profile icon remains.
- Added a separate Paid Stamp upload beside Company Logo, Company Stamp and Manager Signature.
- Added the supplied Paid Stamp as the built-in default.
- Invoice/Quotation PDF authorization area treats Company Stamp and Paid Stamp as separate assets.
- Added compatibility aliases for older PDF code: `public/images/SB_Logo.png` and `public/images/PAID.png`.

No Supabase SQL migration is required for this update. `company_assets.asset_id` already stores asset IDs dynamically, so the new `paidStamp` asset uses the existing storage system.

Start with `STEP_BY_STEP_INSTALL.md`.
