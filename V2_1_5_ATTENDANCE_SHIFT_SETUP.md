# DF7 Business v2.1.5 — Attendance Calendar & Shift Scheduler

## New attendance workflow

The Attendance module now opens with an employee list instead of showing every employee's form on one screen.

1. Choose the attendance month.
2. Search or select an employee.
3. Open the employee's monthly duty calendar.
4. Assign Morning, Evening, Night, or a custom duty time on any date.
5. Tap a date to edit status, actual hours, leave deduction and notes.
6. Use Missing Attendance Dates to complete all unrecorded dates quickly.

## Default shifts

- Morning: 08:00–16:00 — default
- Evening: 16:00–00:00
- Night: 00:00–08:00

Overnight shifts are calculated correctly as eight hours.

## Attendance Settings

Only the Administrator account can open:

Payroll & Attendance → Attendance Settings

The Administrator can:

- Rename shifts
- Change shift start and end times
- Add additional shift types
- Disable shifts
- Select the default shift
- Restore Morning, Evening and Night defaults

Shift settings are stored in Firestore at:

`settings/attendance`

Existing attendance records keep their saved shift name and times even if a preset is later changed or removed.

## Mobile design

- Employee list cards fit mobile screens.
- The employee calendar changes to a clear date-by-date agenda on phones.
- Shift selectors use full-width touch controls.
- Attendance and Missing Dates editors are mobile-friendly.
- Employee identity, monthly totals and missing-date warnings remain visible.
- The existing fixed mobile navigation and corrected menu drawer remain unchanged.

# Deployment instructions

## Step 1 — Back up the current repository

Open:

`https://github.com/Jaittey/jaittey.github.io`

Choose:

`Code → Download ZIP`

Keep the backup until v2.1.5 is tested.

## Step 2 — Extract the update

Extract:

`DF7_Business_v2_1_5_Attendance_Shifts.zip`

Open the folder:

`DF7_Business_v2_1_5_Attendance_Shifts`

## Step 3 — Replace project files

Replace these complete folders in GitHub:

- `src`
- `public`
- `backend`

Replace these root files:

- `index.html`
- `package.json`
- `vite.config.js`
- `firebase.json`
- `README.md`

Keep the existing GitHub Actions secrets.

Keep this workflow file:

`.github/workflows/deploy-pages.yml`

The package also contains the workflow.

## Step 4 — Commit the update

Use this commit message:

`Add employee attendance calendars and shift settings`

Commit directly to:

`main`

## Step 5 — Firestore rules

No new Firestore collection or composite index is required when upgrading from v2.1.4.

The new shift configuration uses the existing protected settings area. The included rules already allow:

- All authorized users to read shift settings
- Only the Administrator to change shift settings
- Managers and Users to enter attendance while the payroll period is open
- Managers to delete attendance records while the period is open

For safety, compare or republish the included file if the live rules are older:

`backend/firestore.rules`

Firebase Console path:

`Firestore Database → Rules → Publish`

## Step 6 — Wait for GitHub deployment

Open:

`GitHub → Actions → Deploy DF7 to GitHub Pages`

Wait for:

- Build ✅
- Deploy ✅

## Step 7 — Open the new version

Open:

`https://jaittey.github.io/?build=v2-1-5-attendance-shifts`

If Safari shows the old version, close all DF7 tabs and remove the `jaittey.github.io` Website Data entry before reopening the URL.

# First-time configuration

## Step 1 — Review shift settings

Sign in as Administrator:

`jaeitte@gmail.com`

Open:

`Payroll & Attendance → Attendance Settings`

Confirm:

- Morning: 08:00–16:00 and selected as default
- Evening: 16:00–00:00
- Night: 00:00–08:00

Change names or times if needed and select Save Shift Settings.

## Step 2 — Open Attendance

Open:

`Payroll & Attendance → Attendance`

The first screen shows one card per employee with:

- Employee name and ID
- Designation and work location
- Payroll type
- Recorded attendance count
- Total monthly hours
- Missing attendance count

## Step 3 — Open an employee calendar

Select Open Attendance on an employee.

The calendar displays:

- Assigned shift and duty time
- Attendance status
- Actual hours
- Missing or unassigned days
- Monthly working hours, overtime, missed hours and off days

## Step 4 — Assign a quick shift

On a calendar date, use Quick Shift and select:

- Morning
- Evening
- Night
- Custom Times

Selecting a preset saves its scheduled start, end and duration.

Tap Edit Details to change:

- Attendance status
- Actual hours worked
- Custom start and end time
- Leave deduction option
- Notes

## Step 5 — Complete missing attendance

Select:

`Missing Attendance Dates`

The pop-up lists every missing eligible date through the current date.

1. Select the dates to complete.
2. Use Apply to Selected for a bulk Morning, Evening or Night shift.
3. Change individual rows when needed.
4. Enter custom times or actual hours where necessary.
5. Select Save Selected Dates.

Duplicate employee/date records are prevented because attendance continues to use the deterministic ID:

`employeeId_date`

## Step 6 — Payroll integration

Before payroll approval, each saved attendance change automatically refreshes an existing draft payroll record for that employee and month.

After the payroll month becomes Approved or Closed:

- Attendance becomes read-only.
- Quick shift controls are disabled.
- Missing-date entries cannot be saved.
- Existing attendance remains visible.

A Manager must reopen the payroll period before editing locked attendance.

# Permissions

## Administrator

- All Attendance functions
- Attendance Settings
- Add, rename, disable and remove shift presets
- Set the default shift

## Manager

- View employee attendance list
- Enter and edit attendance
- Assign shifts
- Complete missing dates
- Delete records while the month is open
- Reopen locked payroll months through Payroll

## User

- View employee attendance list
- Enter and edit attendance while the month is open
- Assign shifts and complete missing dates
- View attendance and salary information

Users cannot:

- Open Attendance Settings
- Change shift presets
- Delete attendance records
- Reopen an approved or closed payroll month

# Existing data

This update does not delete or replace existing:

- Employees
- Attendance records
- Payroll records
- Payroll periods
- Salary slips
- Final settlements
- Invoices or other business data

Older attendance records without a saved shift name remain visible as Recorded Hours. Editing the record allows a preset or custom shift to be assigned.
