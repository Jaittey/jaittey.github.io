import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { deleteRecord, saveAttendanceBatch, savePayrollRecord } from '../services/database';
import { dateText, inputDate, safeNumber, salaryMonthLabel } from '../utils/format';
import {
  ATTENDANCE_STATUSES,
  PAYROLL_TYPES,
  attendanceFromShift,
  attendanceStatusLabel,
  calculateAttendancePayroll,
  dateMonthKey,
  defaultAttendanceShift,
  deriveAttendance,
  missingAttendanceDates,
  normalizeAttendanceShifts,
  payrollTypeLabel,
  summarizeAttendance,
  timeRangeHours,
} from '../utils/payroll';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthDateKeys = (month) => {
  const [year, number] = String(month).split('-').map(Number);
  const days = new Date(year, number, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${year}-${String(number).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
};

const monthCalendarCells = (month) => {
  const dates = monthDateKeys(month);
  if (!dates.length) return [];
  const leading = new Date(`${dates[0]}T00:00:00`).getDay();
  return [...Array.from({ length: leading }, (_, index) => ({ blank: true, key: `blank-${index}` })), ...dates.map((date) => ({ date, key: date }))];
};

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

const dayNumber = (date) => Number(String(date).slice(-2));

const statusDefaultHours = (status, scheduledHours) => {
  if (['ABSENT', 'OFF_DAY', 'LEAVE'].includes(status)) return 0;
  if (status === 'HALF_DAY') return scheduledHours / 2;
  if (status === 'EXTRA_DUTY') return scheduledHours * 1.5;
  return scheduledHours;
};

export default function Attendance({
  attendance,
  employees,
  payroll = [],
  payrollPeriods,
  attendanceSettings,
  settings,
  notify,
  role,
  onOpenSettings,
}) {
  const [selectedMonth, setSelectedMonth] = useState(inputDate().slice(0, 7));
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [dayEditor, setDayEditor] = useState(null);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingDrafts, setMissingDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  const shifts = useMemo(() => normalizeAttendanceShifts(attendanceSettings).filter((shift) => shift.active), [attendanceSettings]);
  const defaultShift = useMemo(() => defaultAttendanceShift(attendanceSettings), [attendanceSettings]);
  const monthRecords = useMemo(() => attendance.filter((row) => (row.attendanceMonth || dateMonthKey(row.date)) === selectedMonth), [attendance, selectedMonth]);
  const period = payrollPeriods.find((row) => row.id === selectedMonth || row.month === selectedMonth);
  const periodStatus = period?.status || 'OPEN';
  const locked = ['APPROVED', 'CLOSED'].includes(periodStatus);
  const manager = role === 'manager' || role === 'administrator';
  const administrator = role === 'administrator';

  const employeesForMonth = useMemo(() => {
    const monthEnd = `${selectedMonth}-31`;
    const monthStart = `${selectedMonth}-01`;
    return employees
      .filter((employee) => (
        (employee.status === 'ACTIVE'
          && (!employee.joiningDate || employee.joiningDate <= monthEnd)
          && (!employee.lastWorkingDate || employee.lastWorkingDate >= monthStart))
        || monthRecords.some((row) => row.employeeId === employee.id)
      ))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [employees, monthRecords, selectedMonth]);

  const employeeRows = useMemo(() => employeesForMonth.map((employee) => {
    const records = monthRecords.filter((row) => row.employeeId === employee.id);
    const summary = summarizeAttendance(records, employee);
    const missing = missingAttendanceDates(employee, selectedMonth, monthRecords);
    return { employee, records, summary, missing };
  }), [employeesForMonth, monthRecords, selectedMonth]);

  const filteredRows = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return employeeRows;
    return employeeRows.filter(({ employee }) => [
      employee.name,
      employee.employeeNumber,
      employee.designation,
      employee.workLocation,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [employeeRows, employeeQuery]);

  const selectedRow = employeeRows.find(({ employee }) => employee.id === selectedEmployeeId) || null;
  const selectedEmployee = selectedRow?.employee || null;
  const selectedRecordsByDate = useMemo(() => Object.fromEntries((selectedRow?.records || []).map((row) => [row.date, row])), [selectedRow]);

  const refreshDraftPayroll = async (records) => {
    const employeeIds = [...new Set(records.map((record) => record.employeeId))];
    let refreshed = 0;

    for (const employeeId of employeeIds) {
      const employee = employees.find((row) => row.id === employeeId);
      if (!employee) continue;
      const existingPayroll = payroll.find((row) => row.employeeId === employeeId && row.salaryMonth === selectedMonth && row.recordType !== 'FINAL_SETTLEMENT');
      if (!existingPayroll || ['APPROVED', 'PAID'].includes(existingPayroll.status)) continue;

      const changedDates = new Set(records.filter((record) => record.employeeId === employeeId).map((record) => record.date));
      const combinedAttendance = attendance
        .filter((row) => row.employeeId === employeeId && (row.attendanceMonth || dateMonthKey(row.date)) === selectedMonth && !changedDates.has(row.date))
        .concat(records.filter((record) => record.employeeId === employeeId));
      const totals = calculateAttendancePayroll(employee, combinedAttendance, existingPayroll);
      const missing = missingAttendanceDates(employee, selectedMonth, combinedAttendance);

      await savePayrollRecord({
        ...existingPayroll,
        ...totals,
        attendanceRecordCount: combinedAttendance.length,
        missingAttendanceCount: missing.length,
        status: 'DRAFT',
        recalculatedFromAttendanceAt: new Date().toISOString(),
      }, existingPayroll.id);
      refreshed += 1;
    }

    return refreshed;
  };

  const saveRecords = async (records, message) => {
    if (locked) return notify(`Attendance is locked because ${salaryMonthLabel(selectedMonth)} payroll is ${periodStatus}.`, 'error');
    if (!records.length) return notify('No attendance records were selected.', 'error');
    const invalid = records.find((row) => row.scheduledHours < 0 || row.actualHours < 0 || !row.date || !row.employeeId);
    if (invalid) return notify('Check the attendance date and working hours.', 'error');

    setSaving(true);
    try {
      await saveAttendanceBatch(records);
      const refreshed = await refreshDraftPayroll(records);
      notify(`${message}${refreshed ? ` ${refreshed} draft payroll calculation${refreshed === 1 ? '' : 's'} refreshed.` : ''}`);
      return true;
    } catch (reason) {
      notify(reason?.message || 'Could not save attendance.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openDay = (date, existingRecord = null) => {
    if (!selectedEmployee) return;
    const storedShift = shifts.find((shift) => shift.id === existingRecord?.shiftId);
    const initialShift = storedShift || (existingRecord ? {
      id: 'custom',
      name: existingRecord.shiftName || 'Custom',
      startTime: existingRecord.scheduledStart || '08:00',
      endTime: existingRecord.scheduledEnd || '16:00',
    } : defaultShift);
    const scheduledHours = timeRangeHours(initialShift.startTime, initialShift.endTime) || safeNumber(selectedEmployee.standardDailyHours || 8);
    setDayEditor({
      id: existingRecord?.id || '',
      date,
      shiftId: storedShift?.id || (existingRecord ? 'custom' : initialShift.id),
      shiftName: existingRecord?.shiftName || initialShift.name,
      scheduledStart: existingRecord?.scheduledStart || initialShift.startTime,
      scheduledEnd: existingRecord?.scheduledEnd || initialShift.endTime,
      status: existingRecord?.status || 'PRESENT',
      actualHours: existingRecord?.actualHours ?? scheduledHours,
      leaveDeductible: Boolean(existingRecord?.leaveDeductible),
      notes: existingRecord?.notes || '',
    });
  };

  const changeEditorShift = (shiftId) => {
    if (shiftId === 'custom') {
      setDayEditor((current) => ({ ...current, shiftId: 'custom', shiftName: 'Custom' }));
      return;
    }
    const shift = shifts.find((row) => row.id === shiftId) || defaultShift;
    const hours = timeRangeHours(shift.startTime, shift.endTime);
    setDayEditor((current) => ({
      ...current,
      shiftId: shift.id,
      shiftName: shift.name,
      scheduledStart: shift.startTime,
      scheduledEnd: shift.endTime,
      actualHours: statusDefaultHours(current.status, hours),
    }));
  };

  const updateEditorStatus = (status) => {
    const hours = timeRangeHours(dayEditor.scheduledStart, dayEditor.scheduledEnd) || safeNumber(selectedEmployee?.standardDailyHours || 8);
    setDayEditor((current) => ({ ...current, status, actualHours: statusDefaultHours(status, hours), leaveDeductible: status === 'LEAVE' ? current.leaveDeductible : false }));
  };

  const saveDayEditor = async () => {
    if (!selectedEmployee || !dayEditor) return;
    const selectedShift = dayEditor.shiftId === 'custom'
      ? { id: 'custom', name: dayEditor.shiftName || 'Custom', startTime: dayEditor.scheduledStart, endTime: dayEditor.scheduledEnd }
      : shifts.find((shift) => shift.id === dayEditor.shiftId) || defaultShift;
    const scheduledHours = timeRangeHours(dayEditor.scheduledStart, dayEditor.scheduledEnd);
    if (scheduledHours <= 0) return notify('Enter a valid shift start and end time.', 'error');

    const record = attendanceFromShift(selectedEmployee, dayEditor.date, {
      ...selectedShift,
      startTime: dayEditor.scheduledStart,
      endTime: dayEditor.scheduledEnd,
    }, {
      status: dayEditor.status,
      actualHours: safeNumber(dayEditor.actualHours),
      leaveDeductible: Boolean(dayEditor.leaveDeductible),
      notes: dayEditor.notes,
      enteredByRole: role,
    });

    if (await saveRecords([record], `Attendance saved for ${selectedEmployee.name} on ${dateText(dayEditor.date)}.`)) setDayEditor(null);
  };

  const assignQuickShift = async (date, shiftId, existingRecord) => {
    if (shiftId === 'custom') return openDay(date, existingRecord);
    const shift = shifts.find((row) => row.id === shiftId);
    if (!shift || !selectedEmployee) return;
    const record = attendanceFromShift(selectedEmployee, date, shift, {
      status: existingRecord?.status || 'PRESENT',
      actualHours: existingRecord?.actualHours,
      leaveDeductible: Boolean(existingRecord?.leaveDeductible),
      notes: existingRecord?.notes || '',
      enteredByRole: role,
    });
    await saveRecords([record], `${shift.name} shift assigned for ${dateText(date)}.`);
  };

  const deleteDay = async () => {
    if (!dayEditor?.id || !manager || locked) return;
    if (!confirm(`Delete attendance for ${dateText(dayEditor.date)}? Payroll will need to be recalculated.`)) return;
    try {
      await deleteRecord('attendance', dayEditor.id);
      notify('Attendance record deleted.');
      setDayEditor(null);
    } catch (reason) {
      notify(reason?.message || 'Could not delete attendance.', 'error');
    }
  };

  const openMissing = () => {
    if (!selectedEmployee) return;
    const missing = missingAttendanceDates(selectedEmployee, selectedMonth, monthRecords);
    const hours = timeRangeHours(defaultShift.startTime, defaultShift.endTime);
    setMissingDrafts(Object.fromEntries(missing.map((date) => [date, {
      selected: true,
      shiftId: defaultShift.id,
      startTime: defaultShift.startTime,
      endTime: defaultShift.endTime,
      status: 'PRESENT',
      actualHours: hours,
    }])));
    setMissingOpen(true);
  };

  const updateMissing = (date, patch) => {
    setMissingDrafts((current) => ({ ...current, [date]: { ...current[date], ...patch } }));
  };

  const changeMissingShift = (date, shiftId) => {
    if (shiftId === 'custom') return updateMissing(date, { shiftId: 'custom' });
    const shift = shifts.find((row) => row.id === shiftId) || defaultShift;
    const hours = timeRangeHours(shift.startTime, shift.endTime);
    updateMissing(date, { shiftId: shift.id, startTime: shift.startTime, endTime: shift.endTime, actualHours: hours });
  };

  const applyShiftToMissing = (shift) => {
    const hours = timeRangeHours(shift.startTime, shift.endTime);
    setMissingDrafts((current) => Object.fromEntries(Object.entries(current).map(([date, draft]) => [date, draft.selected ? {
      ...draft,
      shiftId: shift.id,
      startTime: shift.startTime,
      endTime: shift.endTime,
      actualHours: statusDefaultHours(draft.status, hours),
    } : draft])));
  };

  const saveMissing = async () => {
    if (!selectedEmployee) return;
    const selected = Object.entries(missingDrafts).filter(([, draft]) => draft.selected);
    const records = selected.map(([date, draft]) => {
      const shift = draft.shiftId === 'custom'
        ? { id: 'custom', name: 'Custom', startTime: draft.startTime, endTime: draft.endTime }
        : shifts.find((row) => row.id === draft.shiftId) || defaultShift;
      return attendanceFromShift(selectedEmployee, date, shift, {
        status: draft.status,
        actualHours: safeNumber(draft.actualHours),
        enteredByRole: role,
      });
    });
    if (records.some((record) => record.scheduledHours <= 0)) return notify('One or more custom shifts have invalid times.', 'error');
    if (await saveRecords(records, `${records.length} missing attendance date${records.length === 1 ? '' : 's'} completed for ${selectedEmployee.name}.`)) setMissingOpen(false);
  };

  if (!selectedEmployee) {
    const totalMissing = employeeRows.reduce((sum, row) => sum + row.missing.length, 0);
    return (
      <>
        <section className="attendance-list-hero panel">
          <div>
            <p className="eyebrow">ATTENDANCE</p>
            <h2>Employees</h2>
            <p>Select an employee to open their monthly duty calendar and record shifts.</p>
          </div>
          <div className="attendance-list-controls">
            <label><span>Month</span><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
            {administrator && <button className="button button-secondary" onClick={onOpenSettings}>⚙ Attendance Settings</button>}
          </div>
        </section>

        <section className="attendance-list-summary">
          <article><span>♙</span><div><strong>{employeeRows.length}</strong><small>Employees</small></div></article>
          <article className={totalMissing ? 'warning' : ''}><span>!</span><div><strong>{totalMissing}</strong><small>Missing dates</small></div></article>
          <article><span>◷</span><div><strong>{employeeRows.reduce((sum, row) => sum + row.summary.totalHoursWorked, 0).toFixed(1)}</strong><small>Hours recorded</small></div></article>
          <article><span>🔒</span><div><strong>{periodStatus}</strong><small>Payroll period</small></div></article>
        </section>

        {locked && <div className="alert alert-error">{salaryMonthLabel(selectedMonth)} attendance is locked because payroll is {periodStatus}.</div>}

        <div className="attendance-employee-search"><input value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Search employee, ID, designation or location…" /></div>

        <section className="attendance-employee-list">
          {filteredRows.map(({ employee, summary, missing, records }) => (
            <article className="panel attendance-employee-list-card" key={employee.id} onClick={() => setSelectedEmployeeId(employee.id)}>
              <div className="attendance-avatar large">{initials(employee.name)}</div>
              <div className="attendance-employee-main">
                <div className="attendance-employee-title"><h3>{employee.name}</h3><span className={`payroll-chip ${(employee.payrollType || PAYROLL_TYPES.MONTHLY) === PAYROLL_TYPES.DAILY ? 'daily' : 'monthly'}`}>{(employee.payrollType || PAYROLL_TYPES.MONTHLY) === PAYROLL_TYPES.DAILY ? 'Daily' : 'Monthly'}</span></div>
                <p>{employee.employeeNumber || 'No employee ID'} · {employee.designation || 'No designation'}</p>
                <small>{employee.workLocation || 'No work location'}</small>
              </div>
              <div className="attendance-employee-metrics">
                <span><strong>{records.length}</strong> recorded</span>
                <span><strong>{summary.totalHoursWorked.toFixed(1)}</strong> hours</span>
                <span className={missing.length ? 'missing' : ''}><strong>{missing.length}</strong> missing</span>
              </div>
              <div className="attendance-employee-actions">
                <button className="button button-primary" onClick={(event) => { event.stopPropagation(); setSelectedEmployeeId(employee.id); }}>Open attendance</button>
                <button className="button button-ghost" disabled={!missing.length} onClick={(event) => { event.stopPropagation(); setSelectedEmployeeId(employee.id); setTimeout(() => {
                  const defaultHours = timeRangeHours(defaultShift.startTime, defaultShift.endTime);
                  setMissingDrafts(Object.fromEntries(missing.map((date) => [date, { selected: true, shiftId: defaultShift.id, startTime: defaultShift.startTime, endTime: defaultShift.endTime, status: 'PRESENT', actualHours: defaultHours }])));
                  setMissingOpen(true);
                }, 0); }}>Missing Attendance Dates</button>
              </div>
            </article>
          ))}
        </section>

        {!filteredRows.length && <section className="panel"><EmptyState icon="♙" title="No employees found" text="Add an active employee or change the search and month filters." /></section>}
      </>
    );
  }

  const calendarCells = monthCalendarCells(selectedMonth);
  const summary = selectedRow.summary;
  const missing = selectedRow.missing;

  return (
    <>
      <section className="employee-attendance-header panel">
        <button className="attendance-back-button" onClick={() => setSelectedEmployeeId('')}>← Employees</button>
        <div className="employee-attendance-identity">
          <div className="attendance-avatar large">{initials(selectedEmployee.name)}</div>
          <div>
            <p className="eyebrow">EMPLOYEE ATTENDANCE</p>
            <h2>{selectedEmployee.name}</h2>
            <p>{selectedEmployee.employeeNumber} · {selectedEmployee.designation} · {selectedEmployee.workLocation || 'No work location'}</p>
          </div>
        </div>
        <div className="employee-attendance-actions">
          <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          <button className={`button ${missing.length ? 'button-primary' : 'button-secondary'}`} disabled={!missing.length || locked} onClick={openMissing}>Missing Attendance Dates ({missing.length})</button>
        </div>
      </section>

      {locked && <div className="alert alert-error">This month is {periodStatus}. Attendance can be viewed but not changed.</div>}

      <section className="employee-attendance-summary">
        <article><small>Working days</small><strong>{summary.totalWorkingDays}</strong></article>
        <article><small>Total hours</small><strong>{summary.totalHoursWorked.toFixed(1)}</strong></article>
        <article><small>Overtime</small><strong>{summary.totalOvertimeHours.toFixed(1)}</strong></article>
        <article><small>Missed hours</small><strong>{summary.totalMissedHours.toFixed(1)}</strong></article>
        <article><small>Off days</small><strong>{summary.totalOffDays}</strong></article>
        <article className={missing.length ? 'warning' : ''}><small>Missing dates</small><strong>{missing.length}</strong></article>
      </section>

      <section className="attendance-calendar-panel panel">
        <header className="attendance-calendar-heading">
          <div><p className="eyebrow">MONTHLY DUTY CALENDAR</p><h2>{salaryMonthLabel(selectedMonth)}</h2></div>
          <p>Select a preset directly on any date, or tap the day to enter custom times and attendance details.</p>
        </header>
        <div className="attendance-calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="attendance-calendar-grid">
          {calendarCells.map((cell) => {
            if (cell.blank) return <div className="attendance-calendar-blank" key={cell.key} />;
            const record = selectedRecordsByDate[cell.date];
            const existingShift = shifts.find((shift) => shift.id === record?.shiftId);
            const eligible = (!selectedEmployee.joiningDate || selectedEmployee.joiningDate <= cell.date)
              && (!selectedEmployee.lastWorkingDate || selectedEmployee.lastWorkingDate >= cell.date);
            const shiftLabel = record?.shiftName || existingShift?.name || (record ? 'Recorded Hours' : 'Not assigned');
            const timeLabel = record?.scheduledStart && record?.scheduledEnd ? `${record.scheduledStart} – ${record.scheduledEnd}` : '';
            return (
              <article className={`attendance-calendar-day ${record ? 'recorded' : 'missing-day'} ${!eligible ? 'not-eligible' : ''}`} key={cell.date} onClick={() => eligible && openDay(cell.date, record)}>
                <header><strong>{dayNumber(cell.date)}</strong><small>{WEEKDAYS[new Date(`${cell.date}T00:00:00`).getDay()]}</small>{record && <span className={`attendance-status-dot status-${String(record.status || 'PRESENT').toLowerCase()}`} />}</header>
                <div className="calendar-shift-summary"><b>{shiftLabel}</b><span>{timeLabel || (eligible ? 'Choose a shift' : 'Not employed')}</span></div>
                {record && <div className="calendar-hours"><span>{safeNumber(record.actualHours).toFixed(1)} hrs</span><small>{attendanceStatusLabel(record.status)}</small></div>}
                {eligible && !locked && <select className="calendar-quick-shift" value={record?.shiftId && shifts.some((shift) => shift.id === record.shiftId) ? record.shiftId : (record ? 'custom' : '')} onClick={(event) => event.stopPropagation()} onChange={(event) => assignQuickShift(cell.date, event.target.value, record)}>
                  <option value="">Quick shift…</option>
                  {shifts.map((shift) => <option value={shift.id} key={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}
                  <option value="custom">Custom times…</option>
                </select>}
                {eligible && <button className="calendar-edit-button" onClick={(event) => { event.stopPropagation(); openDay(cell.date, record); }}>{record ? 'Edit details' : 'Add attendance'}</button>}
              </article>
            );
          })}
        </div>
      </section>

      {dayEditor && <Modal open title={`${dateText(dayEditor.date)} · ${selectedEmployee.name}`} onClose={() => setDayEditor(null)}>
        <div className="attendance-day-editor">
          <div className="day-editor-shift-pills">
            {shifts.map((shift) => <button className={dayEditor.shiftId === shift.id ? 'active' : ''} key={shift.id} onClick={() => changeEditorShift(shift.id)}><strong>{shift.name}</strong><span>{shift.startTime}–{shift.endTime}</span></button>)}
            <button className={dayEditor.shiftId === 'custom' ? 'active' : ''} onClick={() => changeEditorShift('custom')}><strong>Custom</strong><span>Set times</span></button>
          </div>

          <div className="form-grid attendance-editor-form">
            <label><span>Attendance status</span><select disabled={locked} value={dayEditor.status} onChange={(event) => updateEditorStatus(event.target.value)}>{ATTENDANCE_STATUSES.map((status) => <option value={status} key={status}>{attendanceStatusLabel(status)}</option>)}</select></label>
            <label><span>Actual hours worked</span><input disabled={locked} type="number" min="0" step="0.25" value={dayEditor.actualHours} onChange={(event) => setDayEditor((current) => ({ ...current, actualHours: event.target.value }))} /></label>
            <label><span>Duty start</span><input disabled={locked} type="time" value={dayEditor.scheduledStart} onChange={(event) => setDayEditor((current) => ({ ...current, shiftId: 'custom', shiftName: 'Custom', scheduledStart: event.target.value }))} /></label>
            <label><span>Duty end</span><input disabled={locked} type="time" value={dayEditor.scheduledEnd} onChange={(event) => setDayEditor((current) => ({ ...current, shiftId: 'custom', shiftName: 'Custom', scheduledEnd: event.target.value }))} /></label>
            <div className="attendance-editor-calculation"><span>Scheduled</span><strong>{timeRangeHours(dayEditor.scheduledStart, dayEditor.scheduledEnd).toFixed(2)} hrs</strong></div>
            <div className="attendance-editor-calculation"><span>Extra / missed</span><strong>{Math.max(0, safeNumber(dayEditor.actualHours) - timeRangeHours(dayEditor.scheduledStart, dayEditor.scheduledEnd)).toFixed(2)} / {Math.max(0, timeRangeHours(dayEditor.scheduledStart, dayEditor.scheduledEnd) - safeNumber(dayEditor.actualHours)).toFixed(2)} hrs</strong></div>
            {dayEditor.status === 'LEAVE' && (selectedEmployee.payrollType || PAYROLL_TYPES.MONTHLY) === PAYROLL_TYPES.MONTHLY && <label className="checkbox-label form-span-2"><input disabled={locked} type="checkbox" checked={dayEditor.leaveDeductible} onChange={(event) => setDayEditor((current) => ({ ...current, leaveDeductible: event.target.checked }))} /><span>Deduct missed hours for this leave</span></label>}
            <label className="form-span-2"><span>Notes</span><textarea disabled={locked} rows="3" value={dayEditor.notes} onChange={(event) => setDayEditor((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional attendance note" /></label>
          </div>
        </div>
        <footer className="modal-actions attendance-editor-actions">
          {manager && dayEditor.id && !locked && <button className="button button-danger" onClick={deleteDay}>Delete record</button>}
          <button className="button button-ghost" onClick={() => setDayEditor(null)}>Cancel</button>
          <button className="button button-primary" disabled={locked || saving} onClick={saveDayEditor}>{saving ? 'Saving…' : 'Save attendance'}</button>
        </footer>
      </Modal>}

      {missingOpen && <Modal open title={`Missing Attendance Dates · ${selectedEmployee.name}`} onClose={() => setMissingOpen(false)}>
        <div className="missing-attendance-modal">
          <div className="alert alert-info">These dates have no saved attendance record. Select the required dates and assign a shift before saving.</div>
          <div className="missing-bulk-shifts"><span>Apply to selected:</span>{shifts.map((shift) => <button key={shift.id} onClick={() => applyShiftToMissing(shift)}>{shift.name}<small>{shift.startTime}–{shift.endTime}</small></button>)}</div>
          <div className="missing-attendance-list">
            {Object.entries(missingDrafts).map(([date, draft]) => {
              const hours = timeRangeHours(draft.startTime, draft.endTime);
              return <article className={`missing-attendance-row ${draft.selected ? 'selected' : ''}`} key={date}>
                <label className="missing-date-check"><input type="checkbox" checked={draft.selected} onChange={(event) => updateMissing(date, { selected: event.target.checked })} /><div><strong>{dateText(date)}</strong><small>{WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]}</small></div></label>
                <select disabled={!draft.selected} value={draft.shiftId} onChange={(event) => changeMissingShift(date, event.target.value)}>{shifts.map((shift) => <option value={shift.id} key={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}<option value="custom">Custom</option></select>
                {draft.shiftId === 'custom' && <div className="missing-custom-times"><input disabled={!draft.selected} type="time" value={draft.startTime} onChange={(event) => updateMissing(date, { startTime: event.target.value, actualHours: timeRangeHours(event.target.value, draft.endTime) })} /><span>to</span><input disabled={!draft.selected} type="time" value={draft.endTime} onChange={(event) => updateMissing(date, { endTime: event.target.value, actualHours: timeRangeHours(draft.startTime, event.target.value) })} /></div>}
                <select disabled={!draft.selected} value={draft.status} onChange={(event) => updateMissing(date, { status: event.target.value, actualHours: statusDefaultHours(event.target.value, hours) })}>{ATTENDANCE_STATUSES.map((status) => <option value={status} key={status}>{attendanceStatusLabel(status)}</option>)}</select>
                <label className="missing-hours"><span>Actual hours</span><input disabled={!draft.selected} type="number" min="0" step="0.25" value={draft.actualHours} onChange={(event) => updateMissing(date, { actualHours: event.target.value })} /></label>
              </article>;
            })}
          </div>
          {!Object.keys(missingDrafts).length && <div className="healthy-state">✓ No missing attendance dates for this month.</div>}
        </div>
        <footer className="modal-actions"><button className="button button-ghost" onClick={() => setMissingOpen(false)}>Cancel</button><button className="button button-primary" disabled={locked || saving || !Object.values(missingDrafts).some((draft) => draft.selected)} onClick={saveMissing}>{saving ? 'Saving…' : `Save selected dates (${Object.values(missingDrafts).filter((draft) => draft.selected).length})`}</button></footer>
      </Modal>}
    </>
  );
}
