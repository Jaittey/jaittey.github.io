# DF7 Business v2.0 Enterprise — Step-by-Step Update

## New modules

- Employee management
- Payroll processing
- Overtime, allowances, bonuses and deductions
- Salary-slip PDF preview and download
- Google Drive salary-slip save and replacement
- Multi-select salary-slip Drive upload
- Company annual and monthly budgets
- Enterprise dashboard employee, payroll and budget statistics

## 1. Upload the project

1. Extract `DF7_Business_v2_Enterprise.zip`.
2. Open `https://github.com/Jaittey/jaittey.github.io`.
3. Replace the existing `src`, `public`, `backend`, and root project files.
4. Keep GitHub repository secrets unchanged.
5. Confirm `.github/workflows/deploy-pages.yml` still exists.
6. Commit directly to `main`.

Suggested commit message:

`Deploy DF7 Business v2.0 Enterprise employee payroll and budget modules`

## 2. Publish the updated Firestore rules

This is required before Employees, Payroll and Budget can save data.

1. Open Firebase Console.
2. Select `df7-business-app` / project ID `df7-business-app-8e623`.
3. Open **Firestore Database → Rules**.
4. Open `backend/firestore.rules` from this project.
5. Copy the complete file into Firebase Rules.
6. Click **Publish**.

The new collections are:

- `employees`
- `payroll`
- `budgets`

## 3. Wait for GitHub deployment

1. Open GitHub **Actions**.
2. Open **Deploy DF7 to GitHub Pages**.
3. Wait for Build and Deploy to show green checks.
4. Open `https://jaittey.github.io/?build=v2-enterprise`.
5. Refresh with `Ctrl + Shift + R`.

## 4. Configure enterprise settings

Open **Settings** and confirm:

- Employee ID prefix, for example `EMP`
- Salary slip prefix, for example `PAY`
- Company name and address
- Bank details
- Authorized signatory
- Google Drive root folder

## 5. Add employees

Open **Employees → Add employee** and enter:

- Employee ID
- Name
- Address
- Contact
- Emergency contact
- Designation
- Department
- Joining date
- Basic salary
- Bank details
- National ID reference

Use **Deactivate** when someone leaves but salary history must remain. Use **Delete** only when the record was added by mistake.

## 6. Process monthly salary

Open **Payroll → Process salary**:

1. Select the employee.
2. Select the salary month.
3. Confirm basic salary.
4. Add overtime hours and overtime rate.
5. Add allowances, bonus or other earnings.
6. Add late, absence, loan, advance or other deductions.
7. Review gross salary, deductions and net salary.
8. Set status to Draft, Approved or Paid.
9. Save.

The system prevents a duplicate salary record for the same employee and month.

## 7. Salary slips

From Payroll you can:

- Preview a salary slip
- Download PDF
- Save to Google Drive
- Replace the same Drive file after an edit
- Select multiple records and save all slips to Drive

Drive folders are created as:

`DF7 Business / Payroll / YEAR / MONTH`

## 8. Company budget

Open **Budget → Add budget**:

- Choose year
- Choose annual or a specific month
- Choose category
- Enter planned amount
- Enter actual spending
- Add notes

The module shows usage percentage, remaining budget and over-budget warnings.

## 9. Existing data

Your existing invoices, quotations, customers, stock, expenses and recurring contracts remain in their current Firestore collections. This update adds new collections and does not delete existing records.
