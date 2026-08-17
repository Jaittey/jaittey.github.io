# Small Business v3.5 — Functional Dashboard Architecture

This update changes the **actual application navigation** to match the requested functional tree. It is not only a documentation tree.

## New top-level navigation

1. Main Dashboard
2. Sales & POS Dashboard
3. Employee Management Dashboard
4. Financial Management Dashboard
5. Application Manager
6. Super Admin (Super Admin only)

Each top-level item is clickable and opens its own dashboard/hub. Use the `+ / −` control beside it to expand or collapse its child modules.

## Exact grouping

### Main Dashboard
- Business Overview (the main Dashboard)
- Notifications

### Sales & POS Dashboard
- POS System
- Invoices
- Quotations
- Recurring Billing
- Payments
- Customers
- Inventory & Assets
- Contracts
- Customer Statements

### Employee Management Dashboard
- Employees
- HR Records
- Attendance
- Attendance Settings
- Payroll
- Final Settlements

### Financial Management Dashboard
- Finance Overview
- Income & Payments
- Expenses
- Budget
- GST & Tax

### Application Manager
- Company Administration
- Users & Permissions
- Reports & Analytics
- Cloud & Documents
- Activity Logs
- User Preferences / Themes
- Subscription & Trial

### Super Admin
- Businesses
- Platform Users
- Subscription Requests
- Subscription Payments
- Plans
- Custom Offers
- Bank Accounts
- Payment Verification

## Update steps

### 1. Supabase POS upgrade
If you have **not already run** the POS upgrade, open Supabase → SQL Editor and run:

`backend/sb_v3_4_pos_upgrade.sql`

If you already ran it successfully, do not run it again unless needed.

### 2. Replace GitHub project
Upload the contents of this project to your `jaittey.github.io` repository and replace the old files.

Important changed files:
- `src/config/erp.js`
- `src/config/plans.js`
- `src/components/AppShell.jsx`
- `src/App.jsx`
- `src/pages/SuperAdmin.jsx`
- `src/styles.css`
- `public/sw.js`

The POS files from v3.4 are also included.

### 3. Commit and deploy
Commit to your deployment branch (normally `main`). Wait for GitHub Actions / GitHub Pages deployment to finish.

### 4. Clear the old cached app
Open the website and use **Ctrl + F5** on Windows. If the old menu still appears, open browser DevTools → Application → Service Workers → Unregister, then refresh once. The service worker cache name has been changed for this release.

### 5. Verify
After login you should see these main sidebar headings:
- Main Dashboard
- Sales & POS Dashboard
- Employee Management Dashboard
- Financial Management Dashboard
- Application Manager
- Super Admin (only for Super Admin)

Click **Sales & POS Dashboard**. It should open a dashboard of cards for POS, invoices, quotations, recurring billing, payments, customers, inventory/assets, contracts, and statements.

## Note about access
Subscription plans and user permissions still control which child modules a user can open. A dashboard only appears when at least one module inside it is available to that user.
