# Small Business Suite 1.0 — Step-by-Step Installation

## 1. Back up the working project

Before replacing anything:

1. Open GitHub.
2. Open `Jaittey/jaittey.github.io`.
3. Download the current repository ZIP and keep it as a backup.

## 2. Extract this update ZIP

Open the update ZIP and keep the folder structure exactly as supplied.

## 3. Upload / replace these files in GitHub

Replace:

- `src/components/AppShell.jsx`
- `src/config/themes.js`
- `src/pages/UserPreferences.jsx`
- `src/pages/Settings.jsx`
- `src/hooks/useCompanyAssets.js`
- `src/services/businessPdf.js`
- `src/main.jsx`
- `public/icon.png`
- `public/images/SB_Logo.png`
- `public/images/PAID.png`

Add:

- `src/styles-navigation-theme.css`
- `public/images/suite/sb-icon-black.png`
- `public/images/suite/sb-icon-white.png`
- `public/images/suite/user-profile.png`
- `public/images/navigation/dashboard.png`
- `public/images/navigation/sales-commerce.png`
- `public/images/navigation/inventory-operations.png`
- `public/images/navigation/employee-management.png`
- `public/images/navigation/financial-management.png`
- `public/images/navigation/application-manager.png`
- `public/images/navigation/super-admin.png`
- `public/images/documents/paid-stamp.png`

Do not delete your working Supabase configuration, authentication files, employee activation function, or GitHub Actions workflow.

## 4. Salary Slip Paid Stamp compatibility

Your current `src/services/pdf.js` already knows about `paidStampDataUrl`, but one old line still gives Company Stamp priority.

Open:

`src/services/pdf.js`

Find:

`const stamp = settings.companyStampDataUrl || settings.paidStampDataUrl || await loadPaidStampAsDataUrl();`

Replace it with:

`const stamp = settings.paidStampDataUrl || await loadPaidStampAsDataUrl();`

The same change is included as:

`PATCHES/pdf-paid-stamp.patch`

This keeps Company Stamp and Paid Stamp separate on salary documents too.

## 5. Commit the changes

Commit everything to `main`.

Example commit message:

`Update Suite themes, navigation icons and paid stamp`

## 6. Wait for GitHub Pages

Open:

GitHub → Actions → Deploy Small Business to GitHub Pages

Wait until both are green:

- Build ✅
- Deploy ✅

You normally do not need to run the workflow manually if the push already started it.

## 7. Clear old cached UI

Open the live site and press:

`Ctrl + Shift + R`

On iPhone/Safari, close the tab and reopen it. If the old navigation still appears, clear the website data/cache once.

## 8. Test themes

Open:

Application Manager → User Preferences / Themes

Test all presets:

- Royal
- Dark
- Light
- Ocean
- Forest
- Sunset

Confirm that each preset changes:

- Page background
- Cards
- Buttons / accents
- Navigation background
- Navigation active item
- Navigation hover color
- Navigation border
- Navigation icon glow

The navigation should always remain dark even with the Light theme.

## 9. Test custom appearance

Enable Custom Appearance and change:

- Primary Accent
- Secondary Accent
- Navigation Base Color
- Page Background
- Card / Surface
- Primary Text
- Surface Transparency
- Glass / Navigation Blur
- Card Radius
- Sidebar Width
- Density

The actual navigation automatically darkens the selected Navigation Base Color.

## 10. Test navigation icons

Confirm the supplied icons appear for:

- Main Dashboard
- Sales & Commerce
- Inventory & Operations
- Employee Management
- Financial Management
- Application Manager
- Super Admin

Collapse the sidebar. Only the logo/icons should remain visible.

## 11. Test bottom navigation profile

The bottom sidebar area should no longer show the user's name or role.

It should show only:

- User/Profile icon
- Collapse arrow on desktop

The normal top-right profile dropdown still contains account information and Sign out.

## 12. Add document assets

Open:

Administration → Logo, Stamps & Signature

You should now see four items:

1. Company Logo
2. Company Stamp
3. Manager Signature
4. Paid Stamp

The supplied Paid Stamp is shown as the default until the Administrator uploads another one.

## 13. Test PDF output

Create an Invoice and mark it PAID.

Confirm:

- Company Logo is visible.
- Company Stamp and Paid Stamp are treated as separate images.
- Manager Signature is visible when uploaded.
- Paid Stamp does not cover totals or Terms & Conditions.
- Discount and GST remain visible.

Also test a paid Salary Slip after applying Step 4.

## No database migration required

This update does not require a new SQL migration.
