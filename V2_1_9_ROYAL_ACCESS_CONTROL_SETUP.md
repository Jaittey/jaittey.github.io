# DF7 Business v2.1.9 — Royal UI, Profile Menu & Access Control

## What changed

### Navigation and account menu
- Removed the account card, theme selector, Drive button and Sign out button from the main navigation panel.
- Added a compact profile icon at the top-right on desktop and mobile.
- The profile dropdown shows user details, Settings, Drive connection and Sign out.
- Administrators also receive shortcuts to Administration and Access Control.
- The mobile More menu now contains navigation only.

### Administrator Access Control
- Administrator can add, disable, edit or remove delegated accounts.
- Accounts can be Manager or User.
- Manager receives full operational access by default:
  - Dashboard
  - Sales & Billing
  - CRM
  - Employee Management
  - Payroll & Attendance
  - Financial Management
  - Inventory & Assets
  - Reports & Analytics
  - Cloud & Documents
  - Notifications
- Administration, Access Control and Activity Logs remain Administrator-only.
- User receives the existing limited workspace by default.
- Administrator can enable Custom Permissions and select modules individually.
- Permission changes update active user sessions automatically.

### Settings for every user
- Added a Settings item to the main navigation.
- Settings contains application themes only.
- Each user’s theme is stored on that user’s current browser/device.
- Company information, branding, backups and reset remain under Administrator → Company & System.

### Royal design and CSS fixes
- Royal theme redesigned using navy, gold and cool-blue DF7 colors.
- Royal becomes the default theme for a new browser.
- Corrected oversized sidebar/profile images.
- Removed the desktop sidebar profile-card overflow.
- Corrected mobile shift-time field overlap.
- Corrected sticky Salary Slip total overlap.
- Improved desktop top bar, profile dropdown and search alignment.
- Improved full-screen mobile navigation.
- Added safer iPhone spacing.
- Increased bottom content padding so mobile navigation does not cover forms.
- Improved permission, Settings and Administration layouts.

## Deployment

1. Back up the current repository:
   - Open `https://github.com/Jaittey/jaittey.github.io`
   - Select Code → Download ZIP.
2. Extract `DF7_Business_v2_1_9_Royal_Access_Control.zip`.
3. Replace these folders:
   - `src`
   - `public`
   - `backend`
4. Replace these root files:
   - `index.html`
   - `package.json`
   - `vite.config.js`
   - `firebase.json`
   - `README.md`
5. Keep:
   - `.github/workflows/deploy-pages.yml`
   - Existing GitHub Actions secrets
6. Commit with:
   `Add DF7 Royal UI, profile menu and access permission control`
7. Publish `backend/firestore.rules` in Firebase.
8. Wait for GitHub Actions Build and Deploy to become green.
9. Open:
   `https://jaittey.github.io/?build=v2-1-9-royal-access`
10. Clear Safari website data for `jaittey.github.io` if the previous interface remains cached.

## Configure access

1. Sign in as `jaeitte@gmail.com`.
2. Open Access Control.
3. Open an existing account or select Add account.
4. Select Manager or User.
5. Leave Custom Permissions disabled to use the standard role:
   - Manager: full operational workspace.
   - User: standard limited workspace.
6. Enable Custom Permissions only when that specific account needs a different set.
7. Select the permitted modules.
8. Save access and permissions.
9. The user’s open session updates automatically.

## Test the profile menu

### Desktop
1. Confirm there is no account card in the left navigation.
2. Select the small profile icon at the top-right.
3. Confirm the dropdown shows:
   - User name
   - Role
   - Email
   - Settings
   - Google Drive
   - Sign out
4. Confirm the dropdown closes after clicking outside it.

### Mobile
1. Confirm the top-right profile icon is visible.
2. Confirm More opens navigation only.
3. Confirm the profile icon opens the account menu.
4. Confirm Sign out is available in the account menu.
5. Confirm the bottom navigation does not cover page buttons or fields.

## Test permissions

### Manager
Confirm all operational departments are visible and usable. Confirm Administration and Access Control are hidden.

### User
Confirm only the standard or custom-selected modules are visible.

### Administrator
Confirm complete access remains available, including Company & System, backups, reset, Activity Logs and Access Control.

## Firestore rules

The v2.1.9 rules enforce permissions at the database level. Publishing the included rules is mandatory.

No new composite Firestore index is required.
