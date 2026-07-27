# DF7 Business v2.1.4 — Payroll & Attendance Setup Guide

## 1. What this update adds

### Employee payroll configuration
Every employee can use one payroll type:

- **Monthly-Based Salary**
  - Fixed monthly salary
  - Overtime hourly rate
  - Missed-duty deduction hourly rate
  - Standard daily working hours
  - Standard working days per month
  - Joining date

- **Daily-Based Salary**
  - Standard hourly rate
  - Hourly deduction rate
  - Standard daily working hours
  - Joining date

The employee form changes automatically when the payroll type changes.

### Attendance
The Attendance page automatically lists all active employees who have joined by the selected date.

Each record stores:

- Employee and employee ID
- Date and payroll month
- Payroll type
- Scheduled hours
- Actual hours worked
- Overtime hours
- Missed hours
- Status
- Leave-deduction selection
- Notes
- Work location or contract

Statuses:

- Present
- Absent
- Off Day
- Leave
- Half Day
- Extra Duty

Duplicate attendance is prevented with one fixed Firestore document ID per employee and date.

### Monthly payroll
Payroll is calculated from the selected month’s attendance.

**Monthly-Based Salary**

`Net Salary = Fixed Salary + Overtime Pay + Other Additions − Missed-Duty Deduction − Other Deductions`

**Daily-Based Salary**

`Net Salary = Total Hours Worked × Hourly Rate + Other Additions − Other Deductions`

Draft payroll calculations automatically refresh when attendance is changed while the month is open.

### Monthly workflow

1. Record daily attendance.
2. Select the payroll month.
3. Calculate or refresh salaries.
4. Review attendance warnings and adjustments.
5. Approve payroll.
6. Attendance becomes locked.
7. View, print, download or save salary slips to Google Drive.
8. Mark individual salaries or all salaries as paid.
9. Close the completed month.
10. Select the next month and begin new attendance records.

A Manager can reopen an approved or closed month. Reopening unlocks attendance so corrections can be made. Payroll should be recalculated after corrections.

### Final salary settlement
The **Process Final Salary** action calculates a leaving employee’s final pay from actual attendance up to the last working date.

It includes:

- Actual hours and days
- Prorated basic salary
- Overtime pay
- Missed-duty deduction
- Other additions and deductions
- Final net amount
- Last working date
- Reason for leaving
- Payment information
- Settlement status
- Final salary-slip number

After approval:

- The final settlement is permanently saved.
- A copy is saved in payroll history.
- The employee becomes inactive.
- The employee is removed from future attendance entry lists.
- Previous employee, attendance, payroll and salary-slip records remain saved.

---

# 2. Files included

The ZIP is a complete replacement project and includes:

```text
.github/workflows/deploy-pages.yml
backend/firestore.rules
backend/firestore.indexes.json
public/
src/
firebase.json
index.html
package.json
vite.config.js
README.md
V2_1_4_PAYROLL_ATTENDANCE_SETUP.md
```

Important new or updated files:

```text
src/pages/Employees.jsx
src/pages/Attendance.jsx
src/pages/Payroll.jsx
src/services/database.js
src/services/pdf.js
src/utils/payroll.js
src/config/erp.js
src/App.jsx
src/components/AppShell.jsx
src/styles.css
backend/firestore.rules
```

---

# 3. Step-by-step deployment

## Step 1 — Back up the current repository

Open:

`https://github.com/Jaittey/jaittey.github.io`

Select:

**Code → Download ZIP**

Keep this backup until v2.1.4 has been tested.

## Step 2 — Extract the new package

Extract:

`DF7_Business_v2_1_4_Payroll_Attendance.zip`

Open the extracted project folder.

## Step 3 — Replace the GitHub project

In the GitHub repository, replace these complete folders:

```text
src
public
backend
```

Replace these root files:

```text
index.html
package.json
vite.config.js
firebase.json
README.md
```

Upload:

```text
V2_1_4_PAYROLL_ATTENDANCE_SETUP.md
```

Keep the `.github` folder. The package also contains the working deployment workflow.

Do not delete or rename the existing GitHub Actions secrets.

## Step 4 — Commit the update

Use this commit message:

`Add DF7 attendance, payroll and final settlement system`

Commit to the `main` branch.

## Step 5 — Publish the new Firestore rules

This step is mandatory.

Open:

**Firebase Console → Firestore Database → Rules**

Open this file from the extracted project:

`backend/firestore.rules`

Copy the complete contents, replace the current Firebase rules, and click **Publish**.

The rules add these protected collections:

```text
attendance
payrollPeriods
finalSettlements
```

They also update access to:

```text
employees
payroll
```

No new composite Firestore index is required for this release.

## Step 6 — Wait for GitHub Pages

Open:

**GitHub → Actions → Deploy DF7 to GitHub Pages**

Wait for:

```text
Build   ✅
Deploy  ✅
```

## Step 7 — Open the new build

Open:

`https://jaittey.github.io/?build=v2-1-4-payroll-attendance`

## Step 8 — Clear the old mobile cache

The service-worker cache is updated, but Safari may still display an older version.

1. Close all open DF7 tabs.
2. Open the new URL again.
3. If necessary, go to:

**iPhone Settings → Apps → Safari → Advanced → Website Data**

4. Search for `jaittey.github.io`.
5. Delete only that website entry.
6. Reopen the new build URL.

If DF7 is installed on the Home Screen, remove the old Home Screen app and add it again after clearing website data.

---

# 4. Configure the four Mulak School security guards

Sign in as the Administrator or Manager.

Open:

**Employee Management → Employees → Add Employee**

For each guard, enter:

- Employee ID
- Full name
- Address
- Contact number
- Emergency contact person
- Emergency contact phone
- Designation: `Security Guard`
- Department: `Security Operations`
- Work location / Contract: `Mulak School`
- Joining date
- Payroll type
- Bank information

## Monthly-based guard

Choose **Monthly-Based Salary**, then enter:

- Fixed monthly salary
- Overtime hourly rate
- Missed-duty deduction hourly rate
- Standard daily working hours
- Standard working days

## Daily-based guard

Choose **Daily-Based Salary**, then enter:

- Standard hourly rate
- Hourly deduction rate
- Standard daily working hours

Existing employees from the earlier version are treated as monthly-based employees. Open each existing employee and save the new payroll settings before calculating attendance-based payroll.

---

# 5. Record daily attendance

Open:

**Payroll & Attendance → Attendance**

1. Select the attendance date.
2. All active employees appear automatically.
3. Select the status for each employee.
4. Confirm scheduled and actual hours.
5. Add notes where required.
6. Click **Save all attendance**.

## Status behavior

### Present
Actual hours default to the scheduled hours.

### Absent
Actual hours become zero. Monthly employees receive missed hours. Daily employees receive no pay because actual hours are zero.

### Off Day
No missed-duty deduction is generated. Monthly employees working on an off day receive those hours as overtime. Daily employees receive payment only when actual hours are entered.

### Leave
Approved leave does not create a deduction by default. Turn on **Deduct missed hours for this leave** only when the leave should be deducted.

### Half Day
Actual hours default to half the scheduled hours. They can be adjusted manually.

### Extra Duty
Actual hours default above the scheduled hours. Monthly employees receive overtime. Daily employees receive payment for all actual hours.

## Monthly attendance summary

At the bottom of the Attendance page, select a month to view:

- Working days
- Total hours worked
- Overtime hours
- Missed hours
- Off days
- Absent days
- Missing attendance dates

Inactive employees remain available in historical monthly summaries when they have saved attendance records.

---

# 6. Calculate monthly payroll

Open:

**Payroll & Attendance → Payroll**

Select the payroll month.

## Overview tab

The dashboard shows:

- Active employees
- Monthly-based employees
- Daily-based employees
- Payroll total
- Overtime cost
- Total deductions
- Paid and unpaid salaries
- Pending salary slips
- Employees with missing attendance
- Recent final settlements

Filters are available for:

- Month and year
- Employee
- Payroll type
- Payment status
- Work location / contract

## Calculate payroll

1. Confirm attendance has been entered.
2. Click **Calculate payroll**.
3. The system creates one payroll record per eligible employee.
4. If a draft record already exists, **Refresh calculations** updates it instead of creating a duplicate.
5. Missing attendance warnings remain visible for review.

## Adjust additions and deductions

Open **Monthly Payroll**.

For an open month, select **Adjust** beside an employee and enter:

- Other additions
- Other deductions
- Adjustment explanation
- Payment method

Attendance-based basic earnings, overtime and missed-duty deductions remain calculated automatically.

## Approve payroll

1. Review every employee.
2. Click **Approve payroll**.
3. Confirm the approval message.
4. Payroll records become Approved.
5. Attendance for that month becomes locked.

## Mark salaries paid

After approval, use either:

- **Mark paid** beside one employee, or
- **Mark all paid** for the entire month.

Payment dates are saved.

## Close the month

After all salaries are paid:

1. Click **Close month**.
2. Confirm the closing message.
3. The payroll month remains permanently saved and locked.
4. Select the next month to begin the next payroll period.

## Reopen a month

Only a Manager or Administrator can reopen an approved or closed month.

1. Click **Reopen month**.
2. Correct attendance or adjustments.
3. Click **Refresh calculations**.
4. Approve the payroll again.

---

# 7. Salary slips

Open the **Salary Slips** tab.

Each salary slip includes:

- DF7 name and logo
- Employee name and ID
- Job title
- Work location / contract
- Payroll type
- Salary month
- Working days
- Actual hours
- Overtime hours
- Missed hours
- Fixed or hourly earnings
- Overtime pay
- Additions
- Deductions
- Net salary
- Payment status and date
- Manager approval area
- Employee acknowledgement area
- Salary-slip number

Available actions:

- View / Print
- Download PDF
- Mark paid
- Save to Google Drive
- Replace the existing Drive file
- Open the saved Drive file

Google Drive folders are organized by payroll type, year, month and employee ID.

Default currency is MVR.

---

# 8. Process a final salary

Open either:

- **Employees → Final Salary**, or
- **Payroll → Final Settlements → Process Final Salary**

1. Select the employee.
2. Enter the last working date.
3. Choose eligible-hours or eligible-days proration.
4. Enter the reason for leaving.
5. Review actual hours, overtime and missed hours.
6. Enter other additions or deductions.
7. Choose Approved or Paid.
8. Enter payment details where applicable.
9. Confirm the final settlement.

The system then:

- Saves the final settlement.
- Creates a final salary slip.
- Adds it to payroll history.
- Marks the employee inactive.
- Removes the employee from future attendance lists.
- Keeps every previous record.

---

# 9. Access control

## Administrator

`jaeitte@gmail.com`

Full access, including Administration and User Management.

## Manager

Can:

- Add and edit employees
- Configure payroll
- Enter and edit attendance while the month is open
- Calculate and adjust payroll
- Approve payroll
- Generate salary slips
- Mark salaries paid
- Close and reopen payroll months
- Process final salary settlements

Cannot access Administrator-only User Management and security settings.

## User

Can:

- View employees
- Enter and edit attendance while the month is open
- View calculated payroll information
- View and print salary slips
- Use the previously permitted Sales, CRM and Inventory pages

Cannot:

- Edit employee payroll configuration
- Calculate or adjust payroll
- Approve payroll
- Mark payroll paid
- Close or reopen payroll months
- Process final settlements
- Change approved payroll calculations

Firestore rules enforce these permissions, not only the visible buttons.

---

# 10. Firestore collections

## employees
Stores payroll type, rates, working hours, joining date, status and work location.

## attendance
Document ID:

`employeeId_YYYY-MM-DD`

This prevents duplicate employee/date records.

## payroll
Regular document ID:

`employeeId_YYYY-MM`

This prevents duplicate employee/month payroll records.

Final settlement copies use a `FINAL_` document ID and remain in payroll history.

## payrollPeriods
Document ID:

`YYYY-MM`

Status values:

- OPEN
- APPROVED
- CLOSED

## finalSettlements
Stores final pay calculations and leaving information.

---

# 11. Final test checklist

## Employee test

- Add one monthly-based guard.
- Add one daily-based guard.
- Confirm the form changes with payroll type.

## Attendance test

- Record Present, Off Day, Absent, Leave and Extra Duty.
- Confirm overtime and missed hours calculate automatically.
- Save the same employee/date again and confirm it updates instead of duplicating.

## Monthly payroll test

- Calculate payroll.
- Confirm monthly and daily formulas differ correctly.
- Add an adjustment.
- Change open-month attendance and confirm draft payroll refreshes automatically.
- Approve payroll.
- Confirm attendance becomes locked.
- View and download a salary slip.
- Mark salaries paid.
- Close the month.
- Reopen it as Manager and confirm attendance becomes editable.

## User-role test

- Sign in as User in a private browser window.
- Confirm employee profiles are read-only.
- Confirm attendance can be entered only for an open month.
- Confirm payroll and salary slips are read-only.
- Confirm approval and reopening controls do not appear.

## Final settlement test

- Process a test employee’s final salary.
- Confirm a final slip is created.
- Confirm the employee becomes inactive.
- Confirm the employee disappears from future attendance entry.
- Confirm historical attendance and payroll remain visible.

---

# 12. Troubleshooting

## Missing or insufficient permissions

Publish the included `backend/firestore.rules` file again and sign out/sign in.

## Old version on iPhone

Clear the `jaittey.github.io` Safari website data and reopen the URL containing `?build=v2-1-4-payroll-attendance`.

## Employee does not appear in attendance

Confirm:

- Employment status is Active.
- Joining date is not later than the attendance date.
- Final settlement has not already made the employee inactive.

## Attendance cannot be edited

The payroll period is Approved or Closed. A Manager must reopen it.

## Payroll amount did not change

For an open month, attendance changes refresh an existing draft payroll automatically. If no payroll record has been created yet, click **Calculate payroll** first.
