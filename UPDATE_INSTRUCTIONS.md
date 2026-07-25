# DF7 Complete Project Update

## New functions

- Correctly cropped company logo on login, sidebar and PDFs
- New website/app icon
- Sign-out confirmation pop-up
- Success message after Google Drive connection and file saving
- Select and upload multiple invoices to Drive
- Select and upload multiple quotations to Drive
- Existing invoice/quotation Drive file is replaced instead of duplicated
- If the old Drive file was deleted, the app automatically creates a new file

## Upload to GitHub without npm

1. Extract the complete ZIP.
2. Open the `jaittey.github.io` repository on GitHub.
3. Delete the old project files, but keep repository Settings and Secrets.
4. Upload every file and folder from this package to the repository root.
5. Confirm `.github/workflows/deploy-pages.yml` exists.
6. Commit to `main`.
7. Open Actions and wait for Build and Deploy to turn green.
8. Open https://jaittey.github.io in a private tab.

## Important browser refresh

The service-worker cache was changed. On iPhone, close the old tab and reopen the website. If installed on the home screen, remove the old home-screen app and add it again.

## Multiple Drive upload

1. Open Invoices or Quotes.
2. Tick the checkboxes beside the files.
3. Press `Drive selected`.
4. Approve Google Drive access if requested.
5. Wait for the success message.

## Replace same file

After the first Drive save, the document stores its Drive file ID in Firestore. The button changes to `Replace Drive`. Saving again updates that same Drive file and does not create a duplicate.
