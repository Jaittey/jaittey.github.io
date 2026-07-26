# DF7 Business v2.1.3 — Mobile Drawer Fix

## Fixed
- Black screen when opening the three-line menu or More.
- Mobile menu now always appears above the dark backdrop.
- Solid drawer background for Safari and installed Home Screen mode.
- User photo, name, role and email are visible.
- Sign out is fixed at the bottom of the menu.
- Google Drive and theme controls remain accessible.
- The page behind the drawer cannot scroll while the menu is open.
- The menu has its own scroll area for smaller phones.
- iPhone safe-area spacing is included.

## Installation
1. Back up the current GitHub repository using Code → Download ZIP.
2. Extract `DF7_Business_v2_1_3_Mobile_Drawer_Fix.zip`.
3. Replace the `src` and `public` folders in GitHub.
4. Replace `index.html` and `package.json`.
5. Firestore rules are unchanged from v2.1.2.
6. Commit with: `Fix DF7 mobile drawer black screen`
7. Wait for GitHub Actions Build and Deploy to become green.
8. Open: `https://jaittey.github.io/?build=v2-1-3-drawer-fix`
9. On iPhone, close existing DF7 tabs and remove the old jaittey.github.io website data if the previous cached version remains.
10. Test both the top-left menu button and the bottom More button.
