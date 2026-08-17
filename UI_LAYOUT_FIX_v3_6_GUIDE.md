# Small Business v3.6 — UI / UX Layout Fix

## What was wrong

The previous build loaded four visual CSS layers in this order:

1. `styles.css`
2. `df7-premium-ui.css`
3. `df7-premium-mobile.css`
4. `theme-nova.css`

The same core selectors (`.panel`, `.module-card`, `.content`, `.modal`, `.enterprise-topbar`, mobile navigation, theme variables, etc.) existed in several files. Because the last matching rule wins, changes intended for one layout were being overwritten by another layout. This caused the squeezed Application Manager cards and the POS checkout panel visually colliding with the Recent POS Sales area.

## New CSS structure

v3.6 uses only three CSS files:

- `styles.css` — existing component/function styles.
- `themes.css` — the single source for Dark, Royal, Light, Ocean, Forest, Sunset and Custom theme colors.
- `ui-system.css` — the single final desktop/mobile layout layer.

The following old override files were removed:

- `df7-premium-ui.css`
- `df7-premium-mobile.css`
- `theme-nova.css`

`src/main.jsx` now imports only:

```jsx
import './styles.css';
import './themes.css';
import './ui-system.css';
```

## Main fixes

### Application Manager / module dashboards

- Maximum four cards per row on large desktop.
- Three cards on medium desktop.
- Two cards on tablet.
- One card on phones.
- Cards use equal height and consistent internal spacing.
- `Available` badges no longer cover or squeeze headings.
- Long titles wrap instead of overflowing.
- Open buttons stay aligned at the bottom of each card.

### POS System

- Checkout is no longer sticky on desktop.
- The cart stays inside normal document flow, so it cannot overlap Recent POS Sales.
- Product and checkout panels have stable desktop sizing.
- Product cards use a responsive grid.
- POS switches to one column on tablet/mobile.
- Checkout fields switch to one column on smaller screens.

### Mobile

- Full-screen navigation drawer.
- No black overlay layer.
- Bottom navigation remains above safe-area insets.
- Tables convert to mobile cards.
- Dashboard cards use two columns on tablet and one column on phones.
- Inputs remain at least 16px to avoid iPhone browser zoom.

### Themes

Preset themes:

- Royal
- Dark
- Light
- Ocean
- Forest
- Sunset

New **Custom Theme Builder**:

- Background
- Surface
- Primary accent
- Secondary accent
- Text color

Custom colors are stored in the browser under `sb-custom-theme`, so each device can have its own theme.

## How to update

### Option A — recommended: upload the complete project

1. Download `Small_Business_v3.6_Clean_UI_COMPLETE.zip`.
2. Extract the ZIP.
3. Open the `jaittey.github.io` repository on GitHub.
4. Replace the repository project files with the files from the extracted ZIP.
5. Commit the changes to the `main` branch.
6. Open **GitHub → Actions**.
7. Wait for the Pages deployment workflow to finish successfully.
8. Open `https://jaittey.github.io/`.
9. Press **Ctrl + F5** on Windows, or **Cmd + Shift + R** on macOS.

### Option B — replace only changed files

Replace/add:

- `src/main.jsx`
- `src/App.jsx`
- `src/components/AppShell.jsx`
- `src/config/themes.js`
- `src/pages/UserPreferences.jsx`
- `src/pages/Settings.jsx`
- `src/themes.css` **NEW**
- `src/ui-system.css` **NEW**
- `public/sw.js`
- `package.json`

Delete:

- `src/df7-premium-ui.css`
- `src/df7-premium-mobile.css`
- `src/theme-nova.css`

Do not keep the deleted CSS files imported in `main.jsx`.

## Cache / old design still showing

The service-worker cache is now:

`sb-shell-v360-clean-ui`

If the old design still appears after deployment:

1. Open the website in Chrome.
2. Press `F12`.
3. Open **Application**.
4. Select **Service Workers**.
5. Click **Unregister**.
6. Open **Storage** / **Clear site data** if necessary.
7. Reload the website.

On iPhone Safari, close the site tab and reopen it. If it was installed to the Home Screen, remove the old installed PWA and add it again after deployment.

## Test checklist

### Desktop

- Open Application Manager: cards should not overlap.
- Resize browser from wide to narrow: grid should change 4 → 3 → 2 columns.
- Open POS: checkout must not overlap Recent POS Sales.
- Add products to cart and complete a test sale.
- Open each main dashboard.
- Test Royal, Dark, Light and Custom themes.

### Mobile

- Open the hamburger menu.
- Confirm the drawer fills the screen and closes correctly.
- Confirm bottom navigation is visible.
- Open Application Manager: cards should be one per row on a phone.
- Open POS: Products, Cart and Recent Sales should stack vertically.
- Test invoice, payroll and attendance tables/cards.
- Rotate the phone between portrait and landscape.

## Supabase

No new Supabase SQL is required for this UI-only v3.6 update. If the POS SQL from v3.4 has already been run, do not run it again just for v3.6.
