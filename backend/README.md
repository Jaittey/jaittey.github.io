# Firebase backend configuration

Publish `firestore.rules` in Firebase Console after deploying v2.1.7.

Collections used by this update:

- `attendance` — daily scheduled and actual 24-hour attendance times.
- `attendanceDocuments` — monthly Attendance Report and Attendance Slip metadata.
- `payroll` — monthly payroll calculations.
- `salarySlips` — editable salary slips and lock status.
- `payrollPeriods` — open, approved and closed payroll periods.
- `activityLogs` — payroll, attendance and document actions.

No new composite Firestore index is required for v2.1.7.
