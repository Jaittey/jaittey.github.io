# DF7 Company Logo and App Icon Update

This update adds:

- The DF7 company logo to the Google login screen
- The logo to the application sidebar
- The logo to invoice and quotation PDFs
- The supplied SVG as the browser favicon
- The supplied SVG as the installable web-app icon
- Updated app title and metadata
- A refreshed service-worker cache

## Files to upload or replace

1. `public/images/DF7_Logo.png`
2. `public/icon.svg`
3. `src/components/LoginPage.jsx`
4. `src/components/AppShell.jsx`
5. `src/services/pdf.js`
6. `src/styles.css`
7. `index.html`
8. `public/manifest.webmanifest`
9. `public/sw.js`

Upload them to the same paths in the GitHub repository and replace the old versions.

## After uploading

1. Open **GitHub → Actions**.
2. Wait for **Deploy DF7 to GitHub Pages**.
3. Confirm both Build and Deploy are green.
4. Open `https://jaittey.github.io`.
5. Refresh strongly or use a private tab.
6. Check the login logo, sidebar logo and PDF logo.

The service-worker cache name was changed, which helps browsers replace the old icon and layout.
