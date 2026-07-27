# DF7 Business v2.1.6 — Employee-First Payroll Setup

## What changed

The Payroll module now starts with an individual employee list instead of a wide monthly payroll table.

The new workflow is:

1. Open Payroll.
2. Select an employee.
3. Review every payroll month in the employee profile.
4. Select a month.
5. Choose **Edit Payroll** or **Salary Slip**.
6. Review, approve, pay and close the payroll month.

## New working features

### Employee payroll list

Each employee card displays:

- Employee name and ID
- Designation
- Work location or contract
- Payroll type
- Selected month's calculated salary
- Payroll status
- Missing-attendance warning
- Open Payroll Profile button

The salary displayed on the card is calculated from the employee's attendance records. Draft calculations refresh from attendance until the month is approved.

### Employee payroll profile

Each employee has a dedicated profile with:

- Employee details and payroll rate
- Active or inactive status
- Complete month-by-month payroll history
- Expandable year groups
- Attendance hours, overtime and missed hours
- Monthly salary and status
- Final Salary action for Managers

### Monthly payroll actions

Selecting a month displays two main actions:

- **Edit Payroll**
- **Salary Slip**

Managers also receive month controls for approval, reopening, payment and closing.

### Paid and unpaid day editing

Managers can adjust:

- Paid days
- Unpaid days
- Paid leave days
- Unpaid leave days
- Other additions
- Other deductions
- Adjustment explanation

The editor displays the automatic attendance values next to the adjusted values and recalculates the net salary immediately.

For monthly employees, changing paid or unpaid classifications creates an attendance-day adjustment using the employee's standard daily hours and missed-duty hourly rate. Daily employees continue to be paid from actual worked hours.

### Editable salary slips

The salary-slip editor supports:

- Employee and job information
- Salary month and slip number
- Working, paid, unpaid and leave days
- Total, overtime and missed hours
- Fixed salary or hourly earnings
- Overtime payment
- Additions and deductions
- Custom addition and deduction
- Payment method
- Manager approval
- Employee acknowledgement
- Remarks

The editor always displays:

- Calculated payroll amount
- Salary-slip total
- Difference between the two

A reason is required when the issued salary differs from the calculated payroll.

### Salary-slip actions

- Save Draft
- Approve Slip
- View and Print
- Download PDF
- Save or replace on Google Drive
- Mark Paid
- Open Drive file

Paid salary slips and salary slips inside closed payroll months are read-only.

### New salary-slip history collection

Salary slips are permanently saved in:

`salarySlips`

The deterministic document ID is:

`employeeId_YYYY-MM_salary-slip`

This prevents duplicate salary slips for the same employee and month.

Existing payroll records continue to use:

`employeeId_YYYY-MM`

## Step 1 — Back up the current GitHub project

Open:

`https://github.com/Jaittey/jaittey.github.io`

Choose:

**Code → Download ZIP**

Keep the backup until v2.1.6 has been tested.

## Step 2 — Extract the update

Extract:

`DF7_Business_v2_1_6_Employee_First_Payroll.zip`

Open the extracted folder:

`DF7_Business_v2_1_6_Employee_First_Payroll`

## Step 3 — Replace the project files in GitHub

Replace these complete folders:

- `src`
- `public`
- `backend`

Replace these root files:

- `index.html`
- `package.json`
- `vite.config.js`
- `firebase.json`
- `README.md`

Upload this guide too:

- `V2_1_6_EMPLOYEE_FIRST_PAYROLL_SETUP.md`

Keep your existing GitHub Actions secrets.

Confirm that this file remains available:

`.github/workflows/deploy-pages.yml`

## Step 4 — Commit the update

Use this commit message:

`Add employee-first payroll profiles and editable salary slips`

Commit to the `main` branch.

## Step 5 — Publish the updated Firestore rules

This step is mandatory because v2.1.6 adds the `salarySlips` collection and new payment fields.

Open:

**Firebase Console → Firestore Database → Rules**

From the extracted package, open:

`backend/firestore.rules`

Copy the entire file, replace the current rules and click **Publish**.

The rules provide:

- Manager write access to payroll and salary slips
- User read and print access
- Manager-only payment, approval and reopening controls
- Salary-slip history protection
- Attendance locking after payroll approval

No new composite Firestore index is required.

## Step 6 — Wait for GitHub deployment

Open:

**GitHub → Actions → Deploy DF7 to GitHub Pages**

Wait for:

- Build ✅
- Deploy ✅

## Step 7 — Open v2.1.6

Open:

`https://jaittey.github.io/?build=v2-1-6-employee-payroll`

On Windows, use `Ctrl + Shift + R` when an older version is displayed.

### iPhone cache clearing

When Safari still shows an older version:

1. Close every DF7 tab.
2. Open **Settings → Apps → Safari → Advanced → Website Data**.
3. Search for `jaittey.github.io`.
4. Delete only that website entry.
5. Reopen the v2.1.6 URL.
6. Remove and reinstall the Home Screen shortcut when DF7 was previously installed as an app.

## Step 8 — Check employee payroll settings

Open:

**Employee Management → Employees**

For each employee, verify:

- Payroll type
- Fixed monthly salary or hourly rate
- Overtime hourly rate
- Missed-duty deduction rate
- Standard daily hours
- Standard working days
- Joining date
- Work location or contract

For the Mulak School guards, use:

- Designation: `Security Guard`
- Work location or contract: `Mulak School`

## Step 9 — Record attendance

Open:

**Payroll & Attendance → Attendance**

1. Select an employee.
2. Select the month.
3. Assign Morning, Evening, Night or custom shifts.
4. Complete missing attendance dates.
5. Confirm actual hours, overtime, missed hours and leave status.

Draft payroll salary values update from this attendance information.

## Step 10 — Use the new Employee Payroll list

Open:

**Payroll & Attendance → Payroll**

The first screen now displays employee cards.

Choose the display month. Each card shows the automatically calculated salary for that month.

Use the filters to search by:

- Employee
- Active or inactive status
- Payroll type
- Work location

Select **Open Payroll Profile**.

## Step 11 — Review the employee's month history

The profile displays every month from the employee's joining month through the current month, plus all saved history.

Months are grouped by year.

Each month displays:

- Working days
- Total hours
- Overtime
- Missed hours
- Net salary
- Payroll or salary-slip status

Select a month to open the simple action window.

## Step 12 — Edit payroll

Select:

**Edit Payroll**

Managers can adjust:

- Paid days
- Unpaid days
- Paid leave
- Unpaid leave
- Other additions
- Other deductions
- Manager explanation

Use **Reset from attendance** to restore the automatically calculated attendance values.

Review the live net salary and choose **Save Draft**.

Users can view payroll information but cannot edit it.

## Step 13 — Approve payroll

From the month action window or Employee Payroll list, select:

**Approve month** or **Approve & lock**

Approval:

- Calculates and saves every eligible employee
- Stores the attendance totals
- Changes records to Approved
- Locks attendance for that month
- Prevents automatic salary changes

A warning is displayed when attendance dates are missing.

## Step 14 — Edit and issue the salary slip

Select a month and choose:

**Salary Slip**

Managers can edit the salary-slip fields before issuing.

When custom changes alter the total, enter a reason under:

**Reason for salary-slip difference**

Available actions:

1. Save Draft
2. Approve Slip
3. View / Print
4. Download PDF
5. Google Drive
6. Mark Paid

Users can view, print and download permitted salary slips but cannot edit or approve them.

## Step 15 — Mark salary paid

After payroll approval, choose **Mark Paid**.

Enter:

- Payment date
- Payment method
- Bank or payment reference
- Payment notes

The system updates both:

- Payroll record
- Salary-slip record

Both records become Paid and retain the same payment information.

## Step 16 — Close or reopen the month

### Close month

A month can be closed only when:

- Payroll is approved
- Every employee salary is marked paid

Closing permanently preserves the completed history and makes the salary slips read-only.

### Reopen month

Managers can reopen an approved or closed month with confirmation.

After reopening:

1. Correct attendance where necessary.
2. Recalculate payroll.
3. Save adjustments.
4. Open a previously issued salary slip and choose **Reopen Slip** when it must be corrected.
5. Approve the month and salary slip again.
6. Record payment again when the corrected slip changes the paid amount.

## Step 17 — Google Drive salary-slip structure

Salary slips are saved using an employee-first folder structure:

`DF7 Business / Employees / EMPLOYEE-ID - Employee Name / Payroll / Year / Month`

Saving a slip again uses the existing Drive file ID and replaces the file instead of creating duplicates.

## Step 18 — Test the update

### Manager test

1. Open Payroll.
2. Confirm employee cards are shown first.
3. Open an employee profile.
4. Select a month.
5. Edit paid and unpaid days.
6. Save the payroll draft.
7. Open the salary slip.
8. Add a small custom adjustment and reason.
9. Preview and download the PDF.
10. Approve the payroll month.
11. Approve the salary slip.
12. Mark the salary paid.
13. Close the month.

### User test

1. Sign in with a User account.
2. Open Payroll.
3. Open an employee profile.
4. View a monthly calculation.
5. Open and print a salary slip.
6. Confirm Edit, Approve, Pay and Reopen controls are unavailable.

### Mobile test

1. Open Payroll on an iPhone or Android phone.
2. Confirm employee cards use the full screen width.
3. Open an employee profile.
4. Confirm monthly records appear as simple touch-friendly rows.
5. Open Edit Payroll and Salary Slip.
6. Confirm no horizontal scrolling appears.
7. Confirm Save and action buttons are easy to reach.
8. Confirm the net salary remains visible in the salary-slip editor.

## Existing records

This update does not delete:

- Employees
- Attendance
- Payroll history
- Final settlements
- Invoices
- Quotations
- Customers
- Inventory
- Expenses
- Budgets

Existing payroll records appear automatically in each employee's monthly history. Salary-slip documents are created in the new `salarySlips` collection when they are first saved or issued.
