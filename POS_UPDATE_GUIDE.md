# Small Business — POS System Update Guide

This package adds a complete Point of Sale (POS) workflow to the existing Small Business web application.

## What was added

- **Sales & POS** navigation group with a new **POS System** page.
- Product search and SKU/barcode-style lookup.
- Product grid with live stock and price information.
- Shopping cart with quantity controls.
- Walk-in customer or saved-customer selection.
- Discount and existing company GST calculation.
- Cash, Card, Bank Transfer and Other payment methods.
- Cash received and automatic change calculation.
- Atomic POS checkout in Supabase:
  - validates stock,
  - deducts inventory,
  - creates a PAID invoice,
  - creates a payment record,
  - all in one database transaction.
- Recent POS sales list.
- Printable compact POS receipt.
- Optional **SKU / Barcode** field in Inventory products.
- POS permission added to Administrator, Manager and default User access.
- POS included in VIP Silver, Gold and Platinum plans.
- Dashboard quick-access shortcut and mobile bottom navigation shortcut.

## Files added

- `src/pages/POS.jsx`
- `backend/sb_v3_4_pos_upgrade.sql`
- `POS_UPDATE_GUIDE.md`

## Files updated

- `src/App.jsx`
- `src/components/AppShell.jsx`
- `src/config/erp.js`
- `src/config/plans.js`
- `src/pages/Dashboard.jsx`
- `src/pages/Products.jsx`
- `src/services/database.js`
- `src/styles.css`
- `backend/supabase_schema.sql`
- `public/sw.js`

---

# Step-by-step installation

## Step 1 — Back up the current website

Before replacing files, download or clone the current GitHub repository so you can restore it if needed.

## Step 2 — Update Supabase first

1. Sign in to Supabase.
2. Open the Small Business project.
3. Go to **SQL Editor**.
4. Open this file from the package:
   `backend/sb_v3_4_pos_upgrade.sql`
5. Copy the entire SQL file.
6. Paste it into a new Supabase SQL query.
7. Click **Run**.
8. Confirm the query completes without an error.

**Important:** Do this before using the POS page. The POS checkout uses the new `sb_complete_pos_sale` RPC. If the SQL is not installed, the POS screen may open but checkout will fail.

## Step 3 — Replace the website files

Replace your repository with the files in this updated package, or copy the changed files listed above into the same locations.

If you are replacing only individual files, keep the exact folder structure.

Example:

```text
src/
├── pages/
│   ├── POS.jsx
│   └── Products.jsx
├── config/
│   ├── erp.js
│   └── plans.js
├── components/
│   └── AppShell.jsx
├── services/
│   └── database.js
├── App.jsx
└── styles.css
```

## Step 4 — Upload to GitHub

1. Open your GitHub repository: `jaittey.github.io`.
2. Upload/replace the updated files.
3. Commit the changes to the branch used by your GitHub Pages workflow, normally `main`.
4. Open **Actions**.
5. Wait for the deployment workflow to finish successfully.

## Step 5 — Clear the old cached application

The service-worker cache version has been changed to the POS release.

After deployment:

- Windows: press **Ctrl + F5**.
- Mac: press **Cmd + Shift + R**.
- iPhone/Safari: close the website tab and reopen it. If an old PWA version remains, remove the installed web app and add it again.

## Step 6 — Prepare inventory for POS

1. Open **Sales & POS → Inventory**.
2. Edit or add each product.
3. Enter:
   - Product name
   - SKU / Barcode (optional but recommended)
   - Quantity
   - Price
   - Low-stock threshold
4. Save the product.

A normal USB/Bluetooth barcode scanner that types the barcode like a keyboard can use the SKU field. Keep the cursor in the POS search box and scan the SKU.

## Step 7 — Use the POS System

1. Open **Sales & POS → POS System**.
2. Search for a product or scan its SKU.
3. Click the product to add it to the cart.
4. Adjust quantity using `−` and `+`.
5. Choose a saved customer or keep **Walk-in Customer**.
6. Add a discount if required.
7. Select the payment method.
8. For Cash, enter the cash received. The system calculates change.
9. Click **Complete Sale**.

When checkout succeeds, the system automatically:

- reduces inventory,
- creates a PAID POS invoice,
- creates a payment transaction,
- adds the sale to recent POS sales.

## Step 8 — Print the receipt

After a successful checkout, click **Receipt** or **Print last receipt**.

A compact receipt opens in a new browser window. If nothing opens, allow pop-ups for `jaittey.github.io`.

## Step 9 — Check the connected modules

After a test sale, verify:

1. **Invoices** — a POS invoice should appear with status `PAID`.
2. **Inventory** — sold quantities should be deducted.
3. **Payments** — the payment record should be available to plans/users with Payments access.
4. **Dashboard** — revenue should include the POS invoice.

---

# Recommended first test

Create a test product:

- Name: `Test Item`
- SKU: `TEST001`
- Quantity: `10`
- Price: `MVR 25.00`

Then sell quantity `2` through POS using Cash and enter `MVR 100.00` received.

Expected result:

- Total before GST/discount: `MVR 50.00`
- Inventory becomes `8`
- POS invoice is created as `PAID`
- Payment is recorded
- Change is calculated from the final total

Delete/adjust test data afterward if necessary.

---

# Permission and plan behavior

POS is enabled for:

- Administrator
- Manager
- Default User permissions

POS is included in:

- VIP Silver
- VIP Gold
- VIP Platinum
- Active 7-day trial (trial uses Platinum access)

For a user with **custom permissions**, enable POS System and also keep Inventory access if that user needs to browse/edit inventory outside POS.

