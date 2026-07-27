import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import { saveAttendanceBatch, savePayrollRecord } from '../services/database';
import { dateText, inputDate, safeNumber, salaryMonthLabel } from '../utils/format';
import {
  ATTENDANCE_STATUSES,
  PAYROLL_TYPES,
  attendanceStatusLabel,
  dateMonthKey,
  calculateAttendancePayroll,
  defaultAttendanceForEmployee,
  deriveAttendance,
  missingAttendanceDates,
  payrollTypeLabel,
  summarizeAttendance,
} from '../utils/payroll';

const statusActualHours = (status, scheduled) => {
  if (['ABSENT', 'OFF_DAY', 'LEAVE'].includes(status)) return 0;
  if (status === 'HALF_DAY') return scheduled / 2;
  if (status === 'EXTRA_DUTY') return scheduled * 1.5;
  return scheduled;
};

export default function Attendance({ attendance, employees, payroll = [], payrollPeriods, settings, notify, role }) {
  const [selectedDate, setSelectedDate] = useState(inputDate());
  const [selectedMonth, setSelectedMonth] = useState(inputDate().slice(0, 7));
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  const activeEmployees = useMemo(() => employees
    .filter((employee) => employee.status === 'ACTIVE' && (!employee.joiningDate || employee.joiningDate <= selectedDate))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')), [employees, selectedDate]);

  const dayRecords = useMemo(() => attendance.filter((row) => row.date === selectedDate), [attendance, selectedDate]);
  const monthRecords = useMemo(() => attendance.filter((row) => row.attendanceMonth === selectedMonth || dateMonthKey(row.date) === selectedMonth), [attendance, selectedMonth]);
  const period = payrollPeriods.find((row) => row.id === selectedMonth || row.month === selectedMonth);
  const periodStatus = period?.status || 'OPEN';
  const locked = ['APPROVED', 'CLOSED'].includes(periodStatus);

  useEffect(() => {
    const existingByEmployee = Object.fromEntries(dayRecords.map((row) => [row.employeeId, row]));
    const next = {};
    activeEmployees.forEach((employee) => {
      next[employee.id] = deriveAttendance(
        existingByEmployee[employee.id] || defaultAttendanceForEmployee(employee, selectedDate),
        employee,
      );
    });
    setDrafts(next);
  }, [selectedDate, dayRecords, activeEmployees]);

  const updateDraft = (employee, patch) => {
    setDrafts((current) => ({
      ...current,
      [employee.id]: deriveAttendance({ ...current[employee.id], ...patch }, employee),
    }));
  };

  const changeStatus = (employee, status) => {
    const current = drafts[employee.id] || defaultAttendanceForEmployee(employee, selectedDate);
    const scheduled = safeNumber(current.scheduledHours || employee.standardDailyHours || 8);
    updateDraft(employee, {
      status,
      actualHours: statusActualHours(status, scheduled),
      leaveDeductible: status === 'LEAVE' ? Boolean(current.leaveDeductible) : false,
    });
  };

  const saveAll = async () => {
    if (locked) return notify(`Attendance is locked because ${salaryMonthLabel(selectedMonth)} payroll is ${periodStatus}.`, 'error');
    const records = activeEmployees.map((employee) => {
      const draft = deriveAttendance(drafts[employee.id] || defaultAttendanceForEmployee(employee, selectedDate), employee);
      return {
        ...draft,
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber || '',
        employeeName: employee.name || '',
        designation: employee.designation || '',
        workLocation: employee.workLocation || '',
        payrollType: employee.payrollType || PAYROLL_TYPES.MONTHLY,
        date: selectedDate,
        attendanceMonth: dateMonthKey(selectedDate),
        enteredByRole: role,
      };
    });

    const invalid = records.find((row) => row.actualHours < 0 || row.scheduledHours < 0);
    if (invalid) return notify('Working hours cannot be negative.', 'error');

    setSaving(true);
    try {
      await saveAttendanceBatch(records);

      let refreshedPayroll = 0;
      const monthKey = dateMonthKey(selectedDate);
      for (const employee of activeEmployees) {
        const existingPayroll = payroll.find((row) => row.employeeId === employee.id && row.salaryMonth === monthKey && row.recordType !== 'FINAL_SETTLEMENT');
        if (!existingPayroll) continue;
        const savedRecord = records.find((row) => row.employeeId === employee.id);
        const combinedAttendance = attendance
          .filter((row) => row.employeeId === employee.id && (row.attendanceMonth || dateMonthKey(row.date)) === monthKey && row.date !== selectedDate)
          .concat(savedRecord ? [savedRecord] : []);
        const totals = calculateAttendancePayroll(employee, combinedAttendance, existingPayroll);
        const missing = missingAttendanceDates(employee, monthKey, combinedAttendance);
        await savePayrollRecord({
          ...existingPayroll,
          ...totals,
          attendanceRecordCount: combinedAttendance.length,
          missingAttendanceCount: missing.length,
          status: existingPayroll.status === 'PAID' ? 'PAID' : 'DRAFT',
          recalculatedFromAttendanceAt: new Date().toISOString(),
        }, existingPayroll.id);
        refreshedPayroll += 1;
      }

      notify(`Attendance saved for ${records.length} employee${records.length === 1 ? '' : 's'} on ${dateText(selectedDate)}.${refreshedPayroll ? ` ${refreshedPayroll} draft payroll calculation${refreshedPayroll === 1 ? '' : 's'} refreshed automatically.` : ''}`);
    } catch (reason) {
      notify(reason?.message || 'Could not save attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const summaryEmployees = useMemo(() => employees.filter((employee) => employee.status === 'ACTIVE' || monthRecords.some((row) => row.employeeId === employee.id)), [employees, monthRecords]);

  const summaryRows = useMemo(() => summaryEmployees.map((employee) => {
    const rows = monthRecords.filter((row) => row.employeeId === employee.id);
    const summary = summarizeAttendance(rows, employee);
    const missing = missingAttendanceDates(employee, selectedMonth, monthRecords);
    return { employee, ...summary, missingCount: missing.length, missingDates: missing };
  }).filter((row) => employeeFilter === 'ALL' || row.employee.id === employeeFilter), [summaryEmployees, monthRecords, selectedMonth, employeeFilter]);

  const monthSummary = summaryRows.reduce((totals, row) => ({
    hours: totals.hours + row.totalHoursWorked,
    overtime: totals.overtime + row.totalOvertimeHours,
    missed: totals.missed + row.totalMissedHours,
    absent: totals.absent + row.totalAbsentDays,
    missing: totals.missing + row.missingCount,
  }), { hours: 0, overtime: 0, missed: 0, absent: 0, missing: 0 });

  return <>
    <section className="attendance-toolbar panel">
      <div>
        <p className="eyebrow">DAILY ATTENDANCE</p>
        <h2>Record hours for every active employee</h2>
        <p>Monthly employees receive overtime or missed-hour calculations. Daily employees are paid from actual hours only.</p>
      </div>
      <div className="attendance-date-control">
        <label><span>Attendance date</span><input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedMonth(event.target.value.slice(0, 7)); }} /></label>
        <span className={`period-lock-badge ${locked ? 'locked' : 'open'}`}>{locked ? `🔒 ${periodStatus}` : '✓ OPEN'}</span>
      </div>
    </section>

    {locked && <div className="alert alert-error">Attendance for {salaryMonthLabel(selectedMonth)} is locked. A Manager must reopen the payroll month before records can be changed.</div>}

    <section className="attendance-day-grid">
      {activeEmployees.map((employee) => {
        const row = drafts[employee.id] || defaultAttendanceForEmployee(employee, selectedDate);
        const isMonthly = (employee.payrollType || PAYROLL_TYPES.MONTHLY) === PAYROLL_TYPES.MONTHLY;
        return <article className="panel attendance-entry-card" key={employee.id}>
          <header>
            <div className="attendance-avatar">{employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
            <div><h3>{employee.name}</h3><p>{employee.employeeNumber} · {employee.workLocation || employee.designation}</p></div>
            <span className={`payroll-chip ${isMonthly ? 'monthly' : 'daily'}`}>{isMonthly ? 'Monthly' : 'Daily'}</span>
          </header>

          <div className="attendance-input-grid">
            <label><span>Status</span><select disabled={locked} value={row.status} onChange={(event) => changeStatus(employee, event.target.value)}>{ATTENDANCE_STATUSES.map((status) => <option value={status} key={status}>{attendanceStatusLabel(status)}</option>)}</select></label>
            <label><span>Scheduled hours</span><input disabled={locked} type="number" min="0" step="0.25" value={row.scheduledHours} onChange={(event) => updateDraft(employee, { scheduledHours: event.target.value })} /></label>
            <label><span>Actual hours worked</span><input disabled={locked} type="number" min="0" step="0.25" value={row.actualHours} onChange={(event) => updateDraft(employee, { actualHours: event.target.value })} /></label>
            <div className="attendance-result overtime"><span>Extra / OT</span><strong>{safeNumber(row.overtimeHours).toFixed(2)} hrs</strong></div>
            <div className="attendance-result missed"><span>Missed</span><strong>{safeNumber(row.missedHours).toFixed(2)} hrs</strong></div>
          </div>

          {row.status === 'LEAVE' && isMonthly && <label className="checkbox-label attendance-leave-toggle"><input disabled={locked} type="checkbox" checked={Boolean(row.leaveDeductible)} onChange={(event) => updateDraft(employee, { leaveDeductible: event.target.checked })} /><span>Deduct missed hours for this leave</span></label>}
          <label className="attendance-notes"><span>Notes</span><input disabled={locked} value={row.notes || ''} onChange={(event) => updateDraft(employee, { notes: event.target.value })} placeholder="Optional note" /></label>
          <footer><small>{payrollTypeLabel(employee.payrollType)}</small><strong>{isMonthly ? 'Off Day and approved leave do not deduct salary.' : 'Payment uses actual hours, including extra duty.'}</strong></footer>
        </article>;
      })}
    </section>

    {!activeEmployees.length && <section className="panel"><EmptyState icon="◷" title="No active employees" text="Add active employees before recording attendance." /></section>}

    {activeEmployees.length > 0 && <div className="attendance-save-bar"><div><strong>{activeEmployees.length} employees</strong><small>{dateText(selectedDate)}</small></div><button className="button button-primary" disabled={locked || saving} onClick={saveAll}>{saving ? 'Saving attendance…' : 'Save all attendance'}</button></div>}

    <section className="attendance-month-section">
      <div className="page-actions">
        <div><p className="eyebrow">MONTHLY TOTALS</p><h2>Attendance summary</h2></div>
        <div className="employee-filters"><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /><select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="ALL">All employees</option>{summaryEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div>
      </div>

      <section className="stats-grid attendance-summary-stats">
        <article className="stat-card"><span>◷</span><p>Total hours</p><strong>{monthSummary.hours.toFixed(2)}</strong><small>{salaryMonthLabel(selectedMonth)}</small></article>
        <article className="stat-card"><span>↗</span><p>Overtime hours</p><strong>{monthSummary.overtime.toFixed(2)}</strong><small>Monthly-based extra duties</small></article>
        <article className="stat-card"><span>↘</span><p>Missed hours</p><strong>{monthSummary.missed.toFixed(2)}</strong><small>{monthSummary.absent} absent days</small></article>
        <article className={`stat-card ${monthSummary.missing ? 'warning-stat' : ''}`}><span>!</span><p>Missing attendance</p><strong>{monthSummary.missing}</strong><small>Dates requiring records</small></article>
      </section>

      <section className="panel">
        <div className="responsive-table"><table><thead><tr><th>Employee</th><th>Payroll type</th><th>Working days</th><th>Hours</th><th>Overtime</th><th>Missed</th><th>Off days</th><th>Absent</th><th>Missing</th></tr></thead><tbody>{summaryRows.map((row) => <tr key={row.employee.id}><td data-label="Employee"><strong>{row.employee.name}</strong><small className="cell-subtext">{row.employee.employeeNumber}</small></td><td data-label="Payroll type">{row.employee.payrollType === PAYROLL_TYPES.DAILY ? 'Daily' : 'Monthly'}</td><td data-label="Working days">{row.totalWorkingDays}</td><td data-label="Hours">{row.totalHoursWorked.toFixed(2)}</td><td data-label="Overtime">{row.totalOvertimeHours.toFixed(2)}</td><td data-label="Missed">{row.totalMissedHours.toFixed(2)}</td><td data-label="Off days">{row.totalOffDays}</td><td data-label="Absent">{row.totalAbsentDays}</td><td data-label="Missing"><span className={`status ${row.missingCount ? 'status-draft' : 'status-paid'}`}>{row.missingCount}</span></td></tr>)}</tbody></table></div>
      </section>
    </section>
  </>;
}
