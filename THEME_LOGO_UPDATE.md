# DF7 Theme, Logo and Invoice Colour Update

## Included changes

- Company logo is displayed on a light premium surface, so navy and gold details are visible.
- Sidebar no longer repeats the DF7 name beside the full logo.
- Login logo is larger.
- Light and dark mode toggle added.
- Selected theme is saved in the browser.
- Theme toggle is available before and after login.
- Invoice and quotation PDF header changed from black to warm cream with a navy accent.
- PDF table heading changed to navy-blue.
- Service-worker cache version updated.

## Upload method

Replace the entire existing GitHub repository content with this package, but keep your GitHub repository secrets.

The `.github` folder is hidden. If it does not upload, create:
`.github/workflows/deploy-pages.yml`
manually through GitHub.

## After upload

1. Commit changes to `main`.
2. Open GitHub **Actions**.
3. Wait for **Deploy DF7 to GitHub Pages** to become green.
4. Open `https://jaittey.github.io`.
5. Refresh with `Ctrl + Shift + R`, or clear the website data on iPhone.
6. Test the theme button.
7. Preview an invoice to see the new cream-and-navy header.
