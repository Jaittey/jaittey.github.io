import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { saveAttendanceBatch, savePayrollRecord } from '../services/database';
import { dateText, inputDate, safeNumber, salaryMonthLabel } from '../utils/format';
import { PAYROLL_TYPES, calculateAttendancePayroll, dateMonthKey, defaultAttendanceForEmployee, deriveAttendance, missingAttendanceDates, payrollTypeLabel, summarizeAttendance } from '../utils/payroll';
import { normalizeShifts, shiftHours } from '../utils/shifts';

const monthDates = (month) => {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(year, number, 0).getDate();
  return Array.from({ length: last }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
};
const weekday = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const initials = (name = '') => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export default function Attendance({ attendance, employees, payroll = [], payrollPeriods, shifts = [], settings, notify, role }) {
  const [selectedMonth, setSelectedMonth] = useState(inputDate().slice(0, 7));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingDrafts, setMissingDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.status === 'ACTIVE').sort((a, b) => (a.name || '').localeCompare(b.name || '')), [employees]);
  const visibleEmployees = activeEmployees.filter((employee) => `${employee.name} ${employee.employeeNumber} ${employee.workLocation}`.toLowerCase().includes(search.toLowerCase()));
  const selectedEmployee = activeEmployees.find((employee) => employee.id === selectedEmployeeId);
  const shiftOptions = normalizeShifts(shifts);
  const defaultShift = shiftOptions.find((shift) => shift.isDefault) || shiftOptions[0];
  const period = payrollPeriods.find((row) => row.id === selectedMonth || row.month === selectedMonth);
  const locked = ['APPROVED', 'CLOSED'].includes(period?.status || 'OPEN');
  const employeeRecords = attendance.filter((row) => row.employeeId === selectedEmployeeId && (row.attendanceMonth || dateMonthKey(row.date)) === selectedMonth);
  const recordMap = Object.fromEntries(employeeRecords.map((row) => [row.date, row]));
  const summary = selectedEmployee ? summarizeAttendance(employeeRecords, selectedEmployee) : null;
  const missingDates = selectedEmployee ? missingAttendanceDates(selectedEmployee, selectedMonth, attendance) : [];

  const saveRecord = async (employee, date, patch) => {
    if (locked) return notify(`${salaryMonthLabel(selectedMonth)} attendance is locked.`, 'error');
    const existing = recordMap[date] || defaultAttendanceForEmployee(employee, date);
    const row = deriveAttendance({
      ...existing,
      ...patch,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber || '',
      employeeName: employee.name || '',
      designation: employee.designation || '',
      workLocation: employee.workLocation || '',
      payrollType: employee.payrollType || PAYROLL_TYPES.MONTHLY,
      attendanceMonth: selectedMonth,
      date,
      enteredByRole: role,
    }, employee);
    await saveAttendanceBatch([row]);
    const existingPayroll = payroll.find((item) => item.employeeId === employee.id && item.salaryMonth === selectedMonth && item.recordType !== 'FINAL_SETTLEMENT');
    if (existingPayroll) {
      const combined = employeeRecords.filter((item) => item.date !== date).concat(row);
      await savePayrollRecord({ ...existingPayroll, ...calculateAttendancePayroll(employee, combined, existingPayroll), attendanceRecordCount: combined.length, missingAttendanceCount: missingAttendanceDates(employee, selectedMonth, combined).length, status: existingPayroll.status === 'PAID' ? 'PAID' : 'DRAFT' }, existingPayroll.id);
    }
    notify(`Attendance saved for ${dateText(date)}.`);
  };

  const applyShift = async (date, shift) => {
    const hours = shiftHours(shift.startTime, shift.endTime);
    await saveRecord(selectedEmployee, date, { shiftId: shift.id, shiftName: shift.name, startTime: shift.startTime, endTime: shift.endTime, scheduledHours: hours, actualHours: hours, status: 'PRESENT' });
  };

  const openMissing = () => {
    const initial = {};
    missingDates.forEach((date) => { initial[date] = { shiftId: defaultShift.id, startTime: defaultShift.startTime, endTime: defaultShift.endTime, status: 'PRESENT' }; });
    setMissingDrafts(initial);
    setMissingOpen(true);
  };

  const saveMissing = async () => {
    if (!selectedEmployee || !missingDates.length) return;
    setSaving(true);
    try {
      const records = missingDates.map((date) => {
        const draft = missingDrafts[date] || {};
        const shift = shiftOptions.find((item) => item.id === draft.shiftId) || defaultShift;
        const hours = draft.status === 'OFF_DAY' || draft.status === 'ABSENT' ? 0 : shiftHours(draft.startTime || shift.startTime, draft.endTime || shift.endTime);
        return deriveAttendance({
          ...defaultAttendanceForEmployee(selectedEmployee, date),
          shiftId: shift.id, shiftName: shift.name,
          startTime: draft.startTime || shift.startTime, endTime: draft.endTime || shift.endTime,
          scheduledHours: hours || safeNumber(selectedEmployee.standardDailyHours || 8), actualHours: hours,
          status: draft.status || 'PRESENT', notes: draft.notes || '',
        }, selectedEmployee);
      });
      await saveAttendanceBatch(records);
      notify(`${records.length} missing attendance date${records.length === 1 ? '' : 's'} updated.`);
      setMissingOpen(false);
    } catch (reason) { notify(reason?.message || 'Could not save missing attendance.', 'error'); }
    finally { setSaving(false); }
  };

  if (!selectedEmployee) return <>
    <div className="page-actions"><div><p className="eyebrow">ATTENDANCE</p><h2>Employee attendance</h2><p className="page-subtitle">Select an employee to open their monthly duty calendar.</p></div><label className="attendance-month-picker"><span>Month</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /></label></div>
    <section className="panel attendance-employee-toolbar"><input placeholder="Search employee, ID or location…" value={search} onChange={(e) => setSearch(e.target.value)} /><span>{visibleEmployees.length} active employee{visibleEmployees.length === 1 ? '' : 's'}</span></section>
    <section className="attendance-employee-list">
      {visibleEmployees.map((employee) => {
        const rows = attendance.filter((row) => row.employeeId === employee.id && (row.attendanceMonth || dateMonthKey(row.date)) === selectedMonth);
        const missing = missingAttendanceDates(employee, selectedMonth, attendance).length;
        return <button className="panel attendance-employee-card" key={employee.id} onClick={() => setSelectedEmployeeId(employee.id)}>
          <span className="attendance-avatar">{initials(employee.name)}</span><span className="attendance-employee-copy"><strong>{employee.name}</strong><small>{employee.employeeNumber} · {employee.designation || 'Employee'}</small><small>{employee.workLocation || 'No work location'}</small></span><span className="attendance-employee-meta"><b>{rows.length}</b><small>recorded</small><em className={missing ? 'missing' : 'complete'}>{missing ? `${missing} missing` : 'Complete'}</em></span><span className="attendance-open-arrow">›</span>
        </button>;
      })}
      {!visibleEmployees.length && <article className="panel"><EmptyState icon="♙" title="No active employees" text="Add or activate employees in Employee Management." /></article>}
    </section>
  </>;

  return <>
    <section className="attendance-calendar-header panel">
      <button className="button button-ghost" onClick={() => setSelectedEmployeeId('')}>← Employees</button>
      <div className="attendance-calendar-person"><span className="attendance-avatar">{initials(selectedEmployee.name)}</span><div><p className="eyebrow">MONTHLY ATTENDANCE</p><h2>{selectedEmployee.name}</h2><p>{selectedEmployee.employeeNumber} · {payrollTypeLabel(selectedEmployee.payrollType)} · {selectedEmployee.workLocation || selectedEmployee.designation}</p></div></div>
      <div className="attendance-calendar-actions"><label><span>Month</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /></label><button className={`button ${missingDates.length ? 'button-primary' : 'button-secondary'}`} onClick={openMissing} disabled={!missingDates.length || locked}>Missing Attendance Dates ({missingDates.length})</button></div>
    </section>
    {locked && <div className="alert alert-error">🔒 This payroll month is {period.status}. Attendance cannot be changed until a Manager reopens it.</div>}
    <section className="attendance-summary-strip">
      <article><span>Worked</span><strong>{summary.totalHoursWorked.toFixed(1)}h</strong></article><article><span>Overtime</span><strong>{summary.totalOvertimeHours.toFixed(1)}h</strong></article><article><span>Missed</span><strong>{summary.totalMissedHours.toFixed(1)}h</strong></article><article><span>Off days</span><strong>{summary.totalOffDays}</strong></article><article><span>Absent</span><strong>{summary.totalAbsentDays}</strong></article>
    </section>
    <section className="attendance-calendar-grid">
      {monthDates(selectedMonth).map((date) => {
        const row = recordMap[date];
        return <article className={`attendance-calendar-day panel ${row ? 'recorded' : 'missing'}`} key={date}>
          <header><div><strong>{Number(date.slice(-2))}</strong><span>{weekday(date)}</span></div><span className={`attendance-day-status ${row ? '' : 'missing'}`}>{row ? row.status?.replace('_', ' ') : 'MISSING'}</span></header>
          <div className="shift-quick-selector">{shiftOptions.slice(0, 3).map((shift) => <button disabled={locked} className={row?.shiftId === shift.id ? 'active' : ''} key={shift.id} onClick={() => applyShift(date, shift)}><b>{shift.name}</b><small>{shift.startTime}–{shift.endTime}</small></button>)}</div>
          <div className="custom-shift-row"><input disabled={locked} aria-label="Start time" type="time" value={row?.startTime || defaultShift.startTime} onChange={(e) => saveRecord(selectedEmployee, date, { startTime: e.target.value, endTime: row?.endTime || defaultShift.endTime, shiftName: 'Custom', shiftId: 'custom', scheduledHours: shiftHours(e.target.value, row?.endTime || defaultShift.endTime), actualHours: shiftHours(e.target.value, row?.endTime || defaultShift.endTime), status: 'PRESENT' })} /><span>to</span><input disabled={locked} aria-label="End time" type="time" value={row?.endTime || defaultShift.endTime} onChange={(e) => saveRecord(selectedEmployee, date, { startTime: row?.startTime || defaultShift.startTime, endTime: e.target.value, shiftName: 'Custom', shiftId: 'custom', scheduledHours: shiftHours(row?.startTime || defaultShift.startTime, e.target.value), actualHours: shiftHours(row?.startTime || defaultShift.startTime, e.target.value), status: 'PRESENT' })} /></div>
          {row && <footer><span>{safeNumber(row.actualHours).toFixed(1)} hours</span><span>{row.shiftName || 'Custom'}</span></footer>}
        </article>;
      })}
    </section>

    <Modal open={missingOpen} title={`Missing Attendance — ${selectedEmployee.name}`} onClose={() => setMissingOpen(false)}>
      <p className="page-subtitle">Assign shifts to all unrecorded dates, then save them together.</p>
      <div className="missing-attendance-list">{missingDates.map((date) => {
        const draft = missingDrafts[date] || {};
        return <article key={date}><div><strong>{dateText(date)}</strong><small>{weekday(date)}</small></div><select value={draft.status || 'PRESENT'} onChange={(e) => setMissingDrafts((current) => ({ ...current, [date]: { ...current[date], status: e.target.value } }))}><option value="PRESENT">Present</option><option value="OFF_DAY">Off Day</option><option value="ABSENT">Absent</option><option value="LEAVE">Leave</option></select><select value={draft.shiftId || defaultShift.id} onChange={(e) => { const shift = shiftOptions.find((item) => item.id === e.target.value); setMissingDrafts((current) => ({ ...current, [date]: { ...current[date], shiftId: shift.id, startTime: shift.startTime, endTime: shift.endTime } })); }}>{shiftOptions.map((shift) => <option value={shift.id} key={shift.id}>{shift.name} ({shift.startTime}–{shift.endTime})</option>)}</select></article>;
      })}</div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setMissingOpen(false)}>Cancel</button><button className="button button-primary" disabled={saving} onClick={saveMissing}>{saving ? 'Saving…' : `Save ${missingDates.length} dates`}</button></footer>
    </Modal>
  </>;
}
