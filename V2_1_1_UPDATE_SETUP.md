# DF7 Business v2.1.1 Enterprise — Invoice, Mobile and Roles Update

This package is a complete replacement project based on DF7 Business v2.1 Enterprise.
Existing Firestore invoices, quotations, customers, inventory, employee, payroll and budget data are preserved.

## Changes included

### Invoice PDF
- Invoice due date removed from the editor, recurring billing and PDF.
- Optional blank fields are no longer printed.
- Empty Reference, Contract, Service Period, Payment Method, company details and customer details are hidden.
- Zero-value Discount, Taxable Amount and GST rows are hidden when not applicable.
- Paid stamp moved to the right side and kept upright.
- Terms and payment details use a separate left column so the stamp cannot cover them.
- Empty phone/email entries are removed from the PDF footer.

### Mobile optimization
- Full-screen mobile editors.
- Sticky modal headers and action buttons.
- Larger touch controls and 16px form text to prevent iPhone zoom.
- Responsive top bar and search.
- Slide-out sidebar with independent scrolling.
- Tables become readable record cards on phones.
- Dashboard, forms, cards and action buttons stack correctly.
- Safe-area support for iPhones with a home indicator or display notch.

### Simplified access roles
The owner remains the fixed Administrator: `jaeitte@gmail.com`.
Only two assignable roles are available:

#### Manager
All operational departments, including dashboard, sales, CRM, HR, payroll, finance, inventory, reports, cloud and notifications.
No access to Administration or User Management.

#### User
Only:
- Sales & Billing → Quotations
- Sales & Billing → Invoices
- CRM → Customers
- Inventory & Assets → Inventory

Legacy Accountant, HR Officer and Staff records are automatically treated as User until the Administrator edits and saves them as Manager or User.

---

# Deployment instructions

## Step 1 — Back up the current repository

Open `https://github.com/Jaittey/jaittey.github.io`.

Choose:

`Code → Download ZIP`

Keep the backup before replacing files.

## Step 2 — Extract this package

Extract:

`DF7_Business_v2_1_1_Enterprise_Update.zip`

The extracted folder contains the full project, including `.github`, `src`, `public`, `backend` and root configuration files.

## Step 3 — Replace repository files

In the GitHub repository, replace the old project with the contents of the extracted folder.

Important folders:

- `.github`
- `backend`
- `public`
- `src`

Important root files:

- `firebase.json`
- `index.html`
- `package.json`
- `vite.config.js`

Do not delete the repository secrets under:

`Settings → Secrets and variables → Actions`

## Step 4 — Commit

Use the commit message:

`Fix invoice PDF, mobile layout and access roles`

Commit to `main`.

## Step 5 — Publish the new Firestore rules

This is mandatory. The interface alone does not protect business data.

1. Open Firebase Console.
2. Select the DF7 Firebase project.
3. Open `Firestore Database → Rules`.
4. Open `backend/firestore.rules` from this package.
5. Copy the entire file.
6. Replace the current Firebase rules.
7. Click **Publish**.

The new rules enforce Administrator, Manager and User permissions.

## Step 6 — Confirm Authentication methods

Open:

`Firebase Console → Authentication → Sign-in method`

Keep Google enabled. Enable Email/Password when email-password accounts are used.

## Step 7 — Wait for deployment

Open:

`GitHub → Actions → Deploy DF7 to GitHub Pages`

Wait for both Build and Deploy to show green check marks.

## Step 8 — Open the updated website

Open:

`https://jaittey.github.io/?build=v2-1-1`

On Windows press `Ctrl + Shift + R`.
On a phone, close the old tab and open the address in a private tab when the old version remains cached.

## Step 9 — Update existing users

Sign in with `jaeitte@gmail.com`.

Open:

`User Management`

Review every existing user:

1. Click **Edit**.
2. Choose **Manager** or **User**.
3. Confirm Access enabled.
4. Save.

Old Accountant, HR Officer and Staff records receive User-level access until they are updated.

## Step 10 — Test invoice PDF

1. Open Invoices.
2. Open an existing paid invoice or create a test invoice.
3. Select Preview.
4. Confirm there is no Due Date.
5. Confirm blank optional fields do not appear.
6. Confirm 0% discount/GST lines are hidden.
7. Confirm the Paid stamp appears on the right and does not cover Terms and Conditions.
8. Download the PDF.
9. Replace the Drive copy when required.

Existing `dueDate` values may remain inside old Firestore records, but the application ignores and does not display them.

## Step 11 — Test roles

### Manager test
Use a Manager account in a private browser window. Confirm access to every business department except:

- Administration
- User Management

### User test
Use a User account in a private browser window. Confirm that only these pages appear:

- Quotations
- Invoices
- Customers
- Inventory

## Step 12 — Test mobile layout

On a phone:

1. Open and close the sidebar.
2. Create an invoice.
3. Add invoice items.
4. Scroll the full-screen editor.
5. Save using the sticky bottom buttons.
6. Review invoice and quotation cards.
7. Confirm all buttons are easy to tap and no page scrolls sideways.

## Security reminder

Never upload Firebase service-account files, private keys or OAuth client secrets to GitHub. Firebase web configuration values are public identifiers; Firestore rules provide the data protection.
