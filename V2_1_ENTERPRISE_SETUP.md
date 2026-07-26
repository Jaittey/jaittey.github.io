# DF7 Business v2.1 Enterprise — Browser-Only Deployment Guide

## What is included

### Department-based ERP layout
- Dashboard
- Sales & Billing
- CRM
- Employee Management
- Payroll & Attendance
- Financial Management
- Inventory & Assets
- Reports & Analytics
- Cloud & Documents
- Notifications
- Administration
- User Management

### New working functions
- Grouped, collapsible sidebar
- Mobile drawer navigation
- Global module search
- Google and email/password login
- Role-based page access
- Administrator user invitations
- Payments and outstanding invoice balances
- CSV report exports for Excel
- Business notifications
- Activity logs
- Google Drive workspace overview

### Existing working functions preserved
- Government-style quotations
- GST and discount invoices
- Recurring contracts and school billing
- Customers
- Employees
- Payroll and salary slips
- Budgets
- Expenses
- Inventory
- Google Drive PDF save and replacement

### Prepared as future modules
- Attendance and leave
- Suppliers and purchase history
- Asset assignment and maintenance
- Expanded HR lifecycle records
- Automatic backups and restore

## Step 1 — Back up the current repository

Open:

`https://github.com/Jaittey/jaittey.github.io`

Use **Code → Download ZIP** before replacing anything.

## Step 2 — Upload v2.1

1. Extract `DF7_Business_v2_1_Enterprise.zip`.
2. Delete or replace the old `src`, `public`, and `backend` folders.
3. Replace the root files including `index.html`, `package.json`, `vite.config.js`, and `firebase.json`.
4. Keep your GitHub Actions secrets.
5. Keep `.github/workflows/deploy-pages.yml`. The package also includes it.

Commit message:

`Deploy DF7 Business v2.1 department ERP`

## Step 3 — Enable Email/Password authentication

Firebase Console:

**Authentication → Sign-in method → Email/Password → Enable → Save**

Keep Google enabled.

## Step 4 — Publish Firestore rules

This is required for roles, payments and activity logs.

1. Firebase Console → Firestore Database → Rules.
2. Open `backend/firestore.rules` from this package.
3. Replace all live rules with that file.
4. Click **Publish**.

New collections:

- `userAccess`
- `payments`
- `activityLogs`

Existing collections remain unchanged.

## Step 5 — Confirm GitHub deployment

1. GitHub → Actions.
2. Open **Deploy DF7 to GitHub Pages**.
3. Wait for Build and Deploy to become green.
4. Open:

`https://jaittey.github.io/?build=v2-1-enterprise`

5. Force refresh or use a private browser tab.

## Step 6 — Add users

Sign in with the administrator account:

`jaeitte@gmail.com`

Open:

**User Management → Add user access**

Enter the person's email and choose:

- Manager
- Accountant
- HR Officer
- Staff

### Google users
The person can immediately sign in with the authorized Google email.

### Email/password users
1. Administrator adds the email in User Management.
2. The user opens the login page.
3. Selects **Activate account**.
4. Enters the same authorized email and creates a password.
5. Firebase creates the authentication account.
6. DF7 immediately checks the active invitation. Accounts without an invitation are signed out and cannot read business data.
7. The password is managed by Firebase and is never visible to the administrator.

This free GitHub Pages setup cannot securely let an administrator choose or view another user's password. That requires a trusted backend using Firebase Admin SDK.

## Step 7 — Roles

### Administrator
Full access, settings, users and activity logs.

### Manager
Sales, CRM, finance overview, employees, inventory, reports and cloud.

### Accountant
Invoices, quotations, billing, payments, customers, finance, expenses, budgets and reports.

### HR Officer
Employees, payroll, attendance framework, HR reports and cloud.

### Staff
Dashboard, quotations, customers, inventory lookup and notifications.

## Step 8 — Test

1. Add a test user access record.
2. Sign in using that test account in a private browser window.
3. Confirm the sidebar only shows allowed departments.
4. Receive a payment against an invoice.
5. Confirm invoice balance and payment status update.
6. Export a CSV report and open it in Excel.
7. Check Notifications.
8. Check Activity Logs as administrator.

## Security notes

- GitHub Pages hosts public frontend code.
- Firestore rules protect private business data.
- Do not put service-account files, OAuth client secrets or admin private keys in GitHub.
- Publish the included rules whenever collections or roles change.
