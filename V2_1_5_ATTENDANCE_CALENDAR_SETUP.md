# DF7 Business v2.1.5 — Employee Attendance Calendar

## New attendance workflow

1. Attendance opens with an active employee list.
2. Select an employee to open their monthly calendar.
3. Each date includes Morning, Evening and Night quick shifts.
4. Morning is the default: 08:00–16:00.
5. Custom start and end times can be entered for any date.
6. Missing Attendance Dates opens a batch-entry modal.
7. Administrator-only Attendance Settings controls shift names and times.

## Default shifts

- Morning: 08:00–16:00 (default)
- Evening: 16:00–00:00
- Night: 00:00–08:00

Overnight shifts are calculated correctly across midnight.

## Deployment

1. Back up the current GitHub repository using **Code → Download ZIP**.
2. Extract `DF7_Business_v2_1_5_Attendance_Calendar.zip`.
3. Replace the existing `src`, `public`, and `backend` folders.
4. Replace `index.html`, `package.json`, `vite.config.js`, `firebase.json`, and `README.md`.
5. Keep `.github/workflows/deploy-pages.yml` and all GitHub Secrets.
6. Commit with: `Add employee attendance calendar and shift settings`.
7. Publish the new Firestore rules from `backend/firestore.rules`.
8. Wait for GitHub Actions Build and Deploy to become green.
9. Open `https://jaittey.github.io/?build=v2-1-5-attendance-calendar`.
10. Clear the Safari website data for `jaittey.github.io` if an older cached version appears.

## Firestore update

A new collection is used:

- `attendanceShifts`

All authorized operational users can read shift presets. Only the fixed Administrator can create, edit, or delete shifts.

## Configure shifts

Sign in with `jaeitte@gmail.com` and open:

**Payroll & Attendance → Attendance Settings**

The page initially uses the three built-in defaults. Edit a shift and click Save to store it in Firebase. New shifts can also be added.

Only the first three active shifts are displayed as quick buttons on each calendar day. Additional shifts remain selectable in the Missing Attendance Dates modal.

## Daily use

1. Open **Payroll & Attendance → Attendance**.
2. Choose the month.
3. Search for an employee or select them from the list.
4. Tap Morning, Evening or Night on a calendar date.
5. For a custom duty, edit the start and end time.
6. Open **Missing Attendance Dates** to complete several dates at once.
7. Approved or closed payroll months remain locked.

## Mobile use

- Employee records appear as large touch-friendly rows.
- The calendar uses two columns on tablets and one column on phones.
- Shift buttons are large enough for touch input.
- The missing-date modal stacks all controls vertically on narrow screens.
