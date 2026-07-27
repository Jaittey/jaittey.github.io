# DF7 Business v2.1.7 — Attendance, Reports and Salary-Slip Locking

This is a complete replacement project based on DF7 Business v2.1.6. Existing Firebase records are preserved.

## Changes in this release

### Salary Slip

- The PAID stamp is placed in a dedicated lower-right area and no longer covers the net salary.
- Salary slips show only a concise monthly attendance summary.
- Daily attendance rows are moved to the separate Monthly Attendance Report.
- Managers can approve salary slips using a past approval date.
- Paid salary slips remain editable until they are locked.
- Managers and Administrators can lock a completed paid slip.
- Only the Administrator can unlock a locked slip.
- The Administrator can edit a locked salary slip without first unlocking it.

### Attendance

- Scheduled and actual work times use 24-hour values such as `08:00`, `16:00` and `00:00`.
- Actual check-in and check-out times calculate worked hours automatically.
- Overnight shifts are supported.
- Overtime and missed hours are recalculated from scheduled duration versus actual duration.
- Official off days never create missed-hour deductions.
- Hours worked on an off day are counted as overtime.
- Approved non-deductible leave does not create missed hours.
- Deductible leave creates missed hours.
- Old attendance records that only contain a duration are displayed using a derived 24-hour time range until edited.
- Each employee month can produce:
  - Monthly Attendance Report PDF — detailed daily rows.
  - Monthly Attendance Slip PDF — compact monthly summary.

### Administrator override

The fixed Administrator account `jaeitte@gmail.com` can edit:

- Attendance inside approved or closed payroll months.
- Approved, paid and closed payroll calculations.
- Paid salary slips.
- Locked salary slips.
- Any Firestore record permitted by the application.

Manager accounts cannot edit a salary slip after the Manager locks it.

---

# Part 1 — Back up the current application

1. Open `https://github.com/Jaittey/jaittey.github.io`.
2. Select **Code**.
3. Select **Download ZIP**.
4. Store the ZIP until the new release has been tested.

Do not delete your Firebase project, Firestore data, Authentication users or GitHub Actions secrets.

---

# Part 2 — Upload the v2.1.7 project

## Step 1 — Extract the package

Extract:

`DF7_Business_v2_1_7_Attendance_Slip_Lock.zip`

Open the extracted folder:

`DF7_Business_v2_1_7_Attendance_Slip_Lock`

## Step 2 — Replace the project folders

In the GitHub repository, replace these folders completely:

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

- `V2_1_7_ATTENDANCE_SALARY_SLIP_SETUP.md`

## Step 3 — Keep the GitHub workflow

Confirm this file exists:

`.github/workflows/deploy-pages.yml`

The package includes the workflow. Keep all existing repository secrets unchanged.

## Step 4 — Commit the update

Use this commit message:

`Fix attendance calculations and add salary slip locking`

Commit to the `main` branch.

---

# Part 3 — Publish the updated Firestore rules

This step is mandatory.

1. Open Firebase Console.
2. Select the DF7 Firebase project.
3. Open **Firestore Database**.
4. Open **Rules**.
5. From the extracted project, open `backend/firestore.rules`.
6. Copy the complete file.
7. Replace the current rules in Firebase.
8. Select **Publish**.

The updated rules add:

- `attendanceDocuments` access.
- Salary-slip lock protection.
- Manager lock restrictions.
- Administrator full-access override.

No new composite Firestore index is required.

---

# Part 4 — Wait for GitHub deployment

1. Open the repository in GitHub.
2. Open **Actions**.
3. Open **Deploy DF7 to GitHub Pages**.
4. Wait until both jobs are green:

- Build ✅
- Deploy ✅

Open the release using:

`https://jaittey.github.io/?build=v2-1-7-attendance-slip-lock`

On Windows, use `Ctrl + Shift + R` after opening the URL.

---

# Part 5 — Clear the previous iPhone cache

If Safari continues showing the previous release:

1. Close every DF7 Safari tab.
2. Open iPhone **Settings**.
3. Open **Apps**.
4. Open **Safari**.
5. Open **Advanced**.
6. Open **Website Data**.
7. Search for `jaittey.github.io`.
8. Delete only that website entry.
9. Open the v2.1.7 URL again.

If DF7 was added to the Home Screen, remove the previous Home Screen shortcut and add it again after clearing the website data.

---

# Part 6 — Test the corrected attendance calculation

## Step 1 — Open an employee

Navigate to:

**Payroll & Attendance → Attendance**

Select an employee and the required month.

## Step 2 — Record a normal Morning shift

Enter:

- Scheduled start: `08:00`
- Scheduled end: `16:00`
- Actual check-in: `08:00`
- Actual check-out: `16:00`

Expected result:

- Actual hours: `8.00`
- Overtime: `0.00`
- Missed hours: `0.00`

## Step 3 — Test overtime

Enter:

- Scheduled: `08:00–16:00`
- Actual: `08:00–18:00`

Expected result:

- Actual hours: `10.00`
- Overtime: `2.00`
- Missed hours: `0.00`

## Step 4 — Test missed hours

Enter:

- Scheduled: `08:00–16:00`
- Actual: `09:00–16:00`

Expected result:

- Actual hours: `7.00`
- Overtime: `0.00`
- Missed hours: `1.00`

## Step 5 — Test an Evening overnight shift

Enter:

- Scheduled: `16:00–00:00`
- Actual: `16:00–01:00`

Expected result:

- Actual hours: `9.00`
- Overtime: `1.00`
- Missed hours: `0.00`

## Step 6 — Test an Off Day

Set status to **Off Day**.

When no actual time is entered:

- Overtime: `0.00`
- Missed hours: `0.00`

When the employee works `08:00–12:00` on the Off Day:

- Actual hours: `4.00`
- Overtime: `4.00`
- Missed hours: `0.00`

## Step 7 — Test leave

Approved leave with the deduction option disabled must create no missed hours.

When **Deduct missed hours for this leave** is enabled, the scheduled hours become missed hours.

---

# Part 7 — Generate a Monthly Attendance Report

1. Open **Payroll & Attendance → Attendance**.
2. Select an employee.
3. Select the required month.
4. Select **View Report** to preview it.
5. Select **Report PDF** to download it.

The detailed report contains:

- Employee details.
- Salary month.
- Working days and total hours.
- Overtime and missed totals.
- Date.
- Shift.
- Scheduled time in 24-hour format.
- Actual time in 24-hour format.
- Attendance status.
- Worked hours.
- Overtime.
- Missed hours.
- Notes.

A deterministic metadata record is saved in:

`attendanceDocuments/{employeeId}_{YYYY-MM}_report`

---

# Part 8 — Generate a Monthly Attendance Slip

1. Open the employee’s Attendance window.
2. Select the month.
3. Select **View Slip** to preview it.
4. Select **Slip PDF** to download it.

The Attendance Slip is a compact one-page summary with:

- Employee details.
- Payroll type.
- Recorded duty days.
- Working days.
- Total hours.
- Overtime hours.
- Missed hours.
- Off days.
- Absent days.
- Leave days.
- Employee and Manager signature areas.

The metadata record is saved in:

`attendanceDocuments/{employeeId}_{YYYY-MM}_slip`

---

# Part 9 — Approve a backdated Salary Slip

1. Open **Payroll & Attendance → Payroll**.
2. Select an employee.
3. Select a previous month.
4. Open **Salary Slip**.
5. Expand **Approval and notes**.
6. Enter the required past date under **Slip approval date**.
7. Select **Approve Slip**.

Past dates are accepted. The chosen approval date is printed on the Salary Slip.

The payroll month does not need to be the current month.

---

# Part 10 — Edit a paid Salary Slip

A paid Salary Slip remains editable until it is locked.

1. Open the employee’s Payroll Profile.
2. Select the paid month.
3. Open **Salary Slip**.
4. Edit the permitted fields.
5. Enter a reason when the issued salary differs from the calculated payroll amount.
6. Select **Save Changes**.
7. Preview or download the corrected PDF.
8. Replace the Google Drive copy when necessary.

The payment status remains **PAID** after saving changes.

---

# Part 11 — Lock a completed Salary Slip

Only paid Salary Slips can be locked.

## Manager or Administrator

1. Open a paid Salary Slip.
2. Confirm all values are final.
3. Select **Lock Slip**.
4. Confirm the warning.

After locking:

- A Manager can view, print and download the slip.
- A Manager cannot edit, replace the Drive file or unlock it.
- A User remains view-only.
- The Administrator can edit or unlock it.

The lock stores:

- `locked: true`
- `lockedAt`
- `lockedBy`

---

# Part 12 — Unlock a Salary Slip as Administrator

Sign in using:

`jaeitte@gmail.com`

1. Open **Payroll**.
2. Select the employee and month.
3. Open the locked Salary Slip.
4. Select **Unlock Slip**.
5. Confirm the Administrator override.

A Manager does not receive the Unlock button. Firestore rules also prevent a Manager from bypassing this restriction.

---

# Part 13 — Administrator corrections in locked months

When signed in as Administrator:

- Approved and closed attendance months display an Administrator override message.
- Attendance fields remain editable.
- Approved, paid and closed payroll records can be opened in Edit mode.
- Locked Salary Slips remain editable.
- The Administrator can unlock a Salary Slip.

All updates continue to create activity-log records.

---

# Part 14 — Verify the Salary Slip PDF

Open a paid Salary Slip and select **View / Print**.

Confirm:

1. The net salary remains fully visible.
2. The PAID stamp is below the salary calculation area.
3. The stamp does not cover the net salary.
4. The slip shows a compact attendance summary only.
5. No date-by-date attendance table appears.
6. The approval date is visible when entered.
7. Employee and Manager signature lines remain readable.

---

# Part 15 — Final permission test

## Manager test

Confirm that a Manager can:

- Edit attendance while the month is open.
- Generate attendance reports and slips.
- Approve a backdated Salary Slip.
- Edit a paid, unlocked Salary Slip.
- Lock a paid Salary Slip.

Confirm that a Manager cannot:

- Edit a locked Salary Slip.
- Unlock a locked Salary Slip.

## User test

Confirm that a User can:

- Enter open-month attendance.
- View attendance reports and slips.
- View and print salary slips.

Confirm that a User cannot:

- Approve or edit salary slips.
- Lock or unlock salary slips.

## Administrator test

Confirm that the Administrator can:

- Edit closed attendance.
- Edit approved or paid payroll.
- Edit a locked Salary Slip.
- Unlock a locked Salary Slip.
- Change any permitted application record.

---

# Data preservation

This update does not delete existing:

- Employees.
- Attendance records.
- Payroll history.
- Salary slips.
- Final settlements.
- Customers.
- Invoices.
- Quotations.
- Inventory.
- Expenses.
- Budgets.

Old attendance records without actual check-in and check-out values remain supported.
