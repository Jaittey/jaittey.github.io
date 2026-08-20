# Small Business v5.0 — Step-by-Step Manual Upgrade

## Important order

**Run the Supabase SQL first. Then replace/upload the frontend files.**

If the frontend is deployed before the SQL migration, the new v5 collections may be blocked by the existing Row Level Security feature map.

---

## Step 1 — Back up the current working app

1. Open `Jaittey/jaittey.github.io` on GitHub.
2. Download the current `main` branch as a ZIP, or create a backup branch such as `backup-v4-working`.
3. Do not delete the existing Supabase project.
4. Do not reset any Supabase tables.

The v5 migration is additive and replaces helper/RPC functions only. It does not delete business data.

---

## Step 2 — Run the Supabase v5 migration

Open:

`backend/sb_v5_0_commerce_upgrade.sql`

Then:

1. Supabase Dashboard → Small Business App.
2. SQL Editor → New Query.
3. Paste the complete SQL file.
4. Click **Run**.
5. Confirm that the query completes successfully.

The migration updates:

- `sb_collection_feature()`
- `sb_role_can()`
- `sb_plan_allows()`

and adds:

- `sb_v5_update_product_stock()` — private helper
- `sb_adjust_stock_v5()`
- `sb_complete_pos_sale_v5()`
- `sb_receive_purchase_order_v5()`
- `sb_fulfill_marketplace_order_v5()`

It does not create a second company/membership system.

---

## Step 3 — Replace the existing files

Replace these files with the v5 versions:

- `src/App.jsx`
- `src/main.jsx`
- `src/config/erp.js`
- `src/config/plans.js`
- `src/pages/POS.jsx`
- `src/pages/Products.jsx`
- `public/sw.js`

Add these new files:

- `src/styles-v5.css`
- `src/services/commerce.js`
- `src/pages/Suppliers.jsx`
- `src/pages/PurchaseOrders.jsx`
- `src/pages/Marketplace.jsx`
- `src/pages/KitchenDisplay.jsx`
- `src/pages/ServiceJobs.jsx`
- `src/pages/HRRecords.jsx`
- `src/pages/Assets.jsx`
- `backend/sb_v5_0_commerce_upgrade.sql`

Do **not** delete your existing:

- `src/hooks/useAuth.js`
- `src/pages/UserManagement.jsx`
- Supabase employee activation Edge Function
- subscription/payment files
- Google Drive files
- payroll/attendance files
- `.github/workflows/`
- `package-lock.json`

No new npm package is required for v5.0.

---

## Step 4 — GitHub upload without local npm

You do not need Administrator rights on the PC and you do not need to run npm locally.

Recommended method:

1. Open the GitHub repository.
2. Press `.` on the keyboard to open **github.dev**.
3. In Explorer, replace the files listed in Step 3.
4. Add the new files in the same folders shown in the ZIP.
5. Open Source Control.
6. Commit with: `Upgrade Small Business to v5.0 Commerce Suite`.
7. Sync/Push to `main`.

Your existing GitHub Actions workflow will install dependencies and run the Vite build in GitHub's servers.

---

## Step 5 — Check GitHub Actions

Go to GitHub → Actions → your Small Business Pages deployment.

Wait for:

- Build ✅
- Deploy ✅

If Build fails, open the failed Build step and send the last red error lines before changing anything else.

---

## Step 6 — Clear old PWA cache once

v5 includes a new service-worker cache name (`sb-v5-commerce-500`) so old v4 assets are removed during activation.

After the first deployment:

- Desktop: hard refresh with `Ctrl + Shift + R`.
- iPhone: close the site and reopen it. If an old version remains, remove `jaittey.github.io` Website Data in Safari settings and reopen the site.

---

# Configure each type of business

## Step 7 — Shop / Retail POS

Open **Sales & Commerce → Adaptive POS System**.

On first use choose:

**Shop / Retail**

Then set the default location.

Go to **Inventory** and add products with:

- Name
- SKU
- Barcode / GTIN
- Category
- Cost price
- Selling price
- Quantity
- Low-stock threshold
- Supplier
- Location

At checkout a normal USB/Bluetooth barcode scanner that types the barcode into the focused search field can be used like keyboard input.

Use **Purchase Orders** to order and receive new stock instead of manually increasing stock for normal supplier purchases.

---

## Step 8 — Wholesale POS

Choose:

**Wholesale**

For each inventory item configure:

- Retail price
- Wholesale price
- Minimum wholesale quantity

Wholesale POS uses a denser item list and begins at the configured minimum wholesale quantity. By default a customer must be selected before checkout; this can be changed in POS Settings.

---

## Step 9 — Restaurant / Café POS

Choose:

**Restaurant / Café**

Configure:

- Number of tables
- Default dining type: Dine in / Takeaway / Delivery
- Default location

### Create ingredients

Inventory → Add inventory item → Item type: **Restaurant ingredient**.

Examples:

- Chicken — kg
- Cheese — kg
- Flour — kg
- Coca Cola — pcs

### Create menu items

POS → Menu → Add menu item.

Configure:

- Menu name
- POS short name
- Kitchen name
- Category
- Price
- Modifiers
- Ingredient recipe

Modifier format is one option per line:

`Extra cheese|15`

`No onion|0`

For recipes, select an ingredient and the quantity used by one menu item. When the restaurant bill is paid, v5 deducts the recipe quantities atomically from ingredient stock.

### Kitchen workflow

Restaurant POS → add menu items → **Send to kitchen**.

Kitchen Display receives the ticket:

**NEW → PREPARING → READY → SERVED**

The cashier can later load the open restaurant order and take payment.

---

## Step 10 — Garage / Workshop POS

Choose:

**Garage / Workshop**

Inventory item types useful for a garage:

- Spare part → Item type `Garage / spare part`
- Labour / repair service → Item type `Service / labour` and stock tracking off

At checkout enter:

- Vehicle registration
- Vehicle make/model
- Customer
- Technician/staff
- Parts
- Labour/services
- Work note

Paid garage checkout records the invoice and also creates a completed service-job history item.

For longer jobs use **Inventory & Operations → Garage Service Jobs** to create the job before completion and track:

**BOOKED → INSPECTION → APPROVED → IN PROGRESS → WAITING PARTS → READY → COMPLETED**

---

## Step 11 — Suppliers and purchase orders

Go to **Inventory & Operations → Suppliers**.

Add supplier contact and payment-term information.

Then open **Purchase Orders**:

1. Create PO.
2. Choose supplier.
3. Add items and quantities.
4. Enter unit costs.
5. Save.
6. When stock physically arrives, click **Receive**.
7. Enter the quantity that arrived.
8. Receive again later for partial deliveries.

Every receipt increases inventory and creates stock-movement audit records.

---

## Step 12 — Online / Marketplace sellers

Open **Sales & Commerce → Marketplace Orders**.

Create sales channels such as:

- Website
- Social selling
- Instagram orders
- Facebook orders
- Shopify
- Other marketplace

Orders can be entered manually or imported by CSV.

### CSV headings

Use:

`orderNumber,channel,customerName,customerEmail,sku,quantity,unitPrice,total`

The importer matches the order line to Inventory using SKU.

When you click **Fulfill**:

1. v5 checks available inventory.
2. Stock is deducted atomically.
3. A stock-movement audit record is created.
4. The order becomes FULFILLED.
5. A sales invoice is created.
6. If the marketplace order is marked PAID, a payment record is also created.

Direct API synchronization with a specific marketplace requires that platform's developer/API credentials and should be connected separately after this base workflow is tested.

---

## Step 13 — HR Records

Manager/Administrator → Employee Management → HR Records.

Store:

- Promotion
- Transfer
- Warning / disciplinary record
- Training
- HR note
- Resignation
- Other lifecycle changes

Records remain attached to the employee history.

---

## Step 14 — Company assets

Open **Inventory & Operations → Company Assets**.

Track:

- Asset number
- Equipment/vehicle/uniform category
- Serial or plate number
- Purchase cost/date
- Condition
- Location
- Assigned employee
- Next maintenance date
- Status

---

## Step 15 — Manager test

Sign in with a Manager account and verify access to the operational modules allowed by the active subscription:

- POS
- Sales & Billing
- Customers
- Inventory
- Suppliers / Purchase Orders
- Marketplace
- Employees
- HR Records
- Attendance
- Payroll
- Salary slips
- Assets
- Finance/Reports/Cloud when included by the plan

Administrator-only Company/User controls remain separate.

---

# Recommended acceptance test before using v5.0 live

Test in this order:

1. Existing Google login.
2. Existing employee email login.
3. Existing business opens with old data intact.
4. Add one new inventory item.
5. Manual stock +10 and verify audit entry.
6. Retail POS sale and verify stock decreases.
7. Create supplier + purchase order + partial receipt.
8. Restaurant profile: menu item + ingredient recipe + kitchen ticket + payment.
9. Garage profile: part + service item + vehicle checkout.
10. Marketplace: create test channel/order + fulfill.
11. Verify invoice/payment history.
12. Verify Manager employee/payroll access.
13. Verify mobile navigation and POS checkout.

Only after these tests should you start entering real live stock quantities.

---

# Rollback

If you need to return to the working v4 version:

1. Restore the backed-up GitHub files.
2. Redeploy GitHub Pages.

The new v5 JSON collections may remain in Supabase; the old frontend will simply not use them. The SQL functions are additive/replacements and do not delete old business records.
