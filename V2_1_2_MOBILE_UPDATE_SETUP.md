# DF7 Business v2.1.2 — Mobile-Friendly Update

## What changed

This update replaces the oversized mobile dashboard and permanent module search field with direct navigation.

### Mobile navigation
- Persistent bottom menu
- Home, Invoices, Quotations, Customers and More for Administrator/Manager
- Invoices, Quotations, Customers, Inventory and More for User
- The More button opens every permitted department
- The hamburger button opens the same full menu
- Module search remains inside the full menu, but it is optional

### Mobile dashboard
- Quick Access buttons appear first
- Dashboard statistics remain in two columns on normal phones
- Cards are shorter and use smaller responsive values
- Alerts appear before analytics
- Charts are shorter
- Mobile content includes space for the bottom menu

### Mobile header
- Removed the large permanent search box
- Removed the unclear profile dot from the mobile header
- Added a clear theme button
- Reduced header height

## Deployment

1. Back up the repository using **Code → Download ZIP**.
2. Extract `DF7_Business_v2_1_2_Mobile_Friendly.zip`.
3. Replace `src`, `public`, and `backend` in GitHub.
4. Replace the root files: `index.html`, `package.json`, `vite.config.js`, and `firebase.json`.
5. Keep `.github/workflows/deploy-pages.yml` and all repository secrets.
6. Commit with: `Deploy DF7 v2.1.2 mobile navigation update`.
7. Wait for the GitHub Actions Build and Deploy jobs to become green.
8. Open `https://jaittey.github.io/?build=v2-1-2-mobile`.

## Important cache refresh on iPhone

The app uses a service worker. After deployment:

1. Close every DF7 browser tab.
2. Open Safari again and visit `https://jaittey.github.io/?build=v2-1-2-mobile`.
3. If the old interface remains, open iPhone **Settings → Apps → Safari → Advanced → Website Data**.
4. Search for `jaittey.github.io` and delete only that website entry.
5. Reopen the website.

This update does not require different Firestore rules. The Manager/User rules from v2.1.1 remain valid.

## Mobile test checklist

- The header shows only Menu, page title and Theme.
- No large search field appears below the header.
- A five-button navigation bar appears at the bottom.
- Dashboard Quick Access buttons appear above financial cards.
- Financial cards appear in two columns on a normal iPhone.
- Tapping More opens all permitted modules.
- Tapping Invoices, Quotes, Customers or Inventory opens the page directly.
- Forms remain full-screen and Save/Cancel remain accessible.
