# DF7 Business v2.1.8 — Administration, Themes, Backup & Mobile

## Included updates

### Mobile layout
- Full-screen mobile menu with no black overlay layer.
- Full-screen mobile forms and modals.
- Sticky mobile headers and action bars.
- Safe-area spacing for iPhone.
- Correct bottom-navigation spacing.
- Horizontal overflow protection.
- Mobile Administration tabs and full-width actions.

### Themes
The old Dark/Light toggle buttons are removed.

Available themes:
- Dark
- Light
- Ocean
- Forest
- Royal
- Sunset

Themes can be selected in:
- Administration → Themes
- Mobile Menu → Account → Theme

The selection is stored on the current device.

### Company & System branding
Administration now supports:
- Company Logo upload
- Company Stamp upload
- Manager Signature upload

Uploaded images are resized and optimized before storage. They are used in the app and generated PDF documents.

### Google Drive Backup & Restore
Backup includes:
- Customers
- Products and inventory
- Invoices and quotations
- Employees
- Attendance
- Payroll and salary slips
- Attendance documents
- Payroll periods
- Final settlements
- Payments
- Expenses
- Recurring contracts and generated-period markers
- Budgets
- Settings
- Uploaded company assets
- User access records
- Activity logs

Backups are stored as JSON files inside:

DF7 Business / Backups

Restore replaces the current database with the selected backup.

### Reset
Reset deletes all Firestore application data and starts DF7 as a clean application.

The fixed Administrator account remains able to sign in:
jaeitte@gmail.com

Two reset options are provided:
- Backup to Drive, Then Reset
- Reset Without Backup

The administrator must type:
RESET DF7

## Deployment

1. Back up the current GitHub repository using Code → Download ZIP.
2. Extract `DF7_Business_v2_1_8_Admin_Themes_Backup.zip`.
3. Replace the `src`, `public`, and `backend` folders.
4. Replace `index.html`, `package.json`, `vite.config.js`, `firebase.json`, and `README.md`.
5. Keep `.github/workflows/deploy-pages.yml` and all GitHub Actions secrets.
6. Commit with:
   `Add DF7 themes, company branding, backup restore and mobile fixes`
7. Publish `backend/firestore.rules` in Firebase.
8. Wait for GitHub Actions Build and Deploy to become green.
9. Open:
   `https://jaittey.github.io/?build=v2-1-8-admin-backup`
10. Clear Safari website data for jaittey.github.io if an older cached version appears.

## First configuration

1. Sign in as `jaeitte@gmail.com`.
2. Open Administration → Company & System.
3. Confirm company, tax, prefix and Drive folder information.
4. Open Logo, Stamp & Signature.
5. Upload the three document-branding images.
6. Open Themes and select a theme.
7. Open Backup & Restore.
8. Create the first Google Drive backup.
9. Refresh the backup list and confirm the new file appears.
10. Do not test Reset until the backup is confirmed.

## Firestore rules

The v2.1.8 rules add the `companyAssets` collection:
- Authorized users can read branding assets.
- Only the Administrator can upload, replace or remove them.
- The Administrator wildcard rule permits backup restoration and reset.

No new composite Firestore index is required.

## Important backup notes

- Google Drive uses the existing `VITE_GOOGLE_CLIENT_ID`.
- The application uses the `drive.file` permission, so it manages backup files created by DF7.
- Keep at least two recent backup files before performing a reset.
- Restore is a replacement operation, not a merge.
