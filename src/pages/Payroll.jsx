import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import {
  processFinalSettlementRecord,
  savePayrollRecord,
  saveRecord,
  setPayrollMonthStatus,
} from '../services/database';
import { createSalarySlipPdf, downloadBlob, previewBlob } from '../services/pdf';
import { uploadBusinessPdf } from '../services/drive';
import {
  currency,
  currentSalaryMonth,
  dateText,
  inputDate,
  makeNumber,
  safeNumber,
  salaryMonthLabel,
} from '../utils/format';
import { normalizeRole } from '../config/erp';
import {
  PAYROLL_TYPES,
  calculateAttendancePayroll,
  calculateFinalSettlement,
  missingAttendanceDates,
  monthBounds,
  payrollTypeLabel,
} from '../utils/payroll';

const defaultAdjustment = {
  otherAdditions: 0,
  otherDeductions: 0,
  adjustmentNotes: '',
};

const blankFinalSettlement = (settings, employee = null) => ({
  employeeId: employee?.id || '',
  lastWorkingDate: inputDate(),
  reasonForLeaving: '',
  prorationMethod: 'HOURS',
  otherAdditions: 0,
  otherDeductions: 0,
  settlementStatus: 'APPROVED',
  paymentDate: '',
  paymentMethod: 'Bank Transfer',
  salarySlipNumber: makeNumber(`${settings.salarySlipPrefix || 'PAY'}-FINAL`),
  notes: '',
});

const statusTone = (status) => String(status || 'DRAFT').toLowerCase();

export default function Payroll({
  payroll,
  attendance,
  payrollPeriods,
  finalSettlements,
  employees,
  settings,
  notify,
  role,
  markDriveConnected,
  initialEmployee,
  clearInitialEmployee,
  initialFinalEmployee,
  clearInitialFinalEmployee,
}) {
  const [tab, setTab] = useState('dashboard');
  const [month, setMonth] = useState(currentSalaryMonth());
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [payrollTypeFilter, setPayrollTypeFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustment, setAdjustment] = useState(defaultAdjustment);
  const [processing, setProcessing] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const [finalForm, setFinalForm] = useState(() => blankFinalSettlement(settings));
  const [uploadingId, setUploadingId] = useState('');

  const canManage = ['administrator', 'manager'].includes(normalizeRole(role));
  const period = payrollPeriods.find((row) => row.id === month || row.month === month);
  const periodStatus = period?.status || 'OPEN';
  const monthLocked = ['APPROVED', 'CLOSED'].includes(periodStatus);
  const { end: monthEnd } = monthBounds(month);
  const monthEndKey = inputDate(monthEnd);

  const regularPayroll = useMemo(() => payroll.filter((row) => row.recordType !== 'FINAL_SETTLEMENT'), [payroll]);
  const monthPayroll = useMemo(() => regularPayroll.filter((row) => row.salaryMonth === month), [regularPayroll, month]);
  const monthAttendance = useMemo(() => attendance.filter((row) => (row.attendanceMonth || String(row.date).slice(0, 7)) === month), [attendance, month]);
  const eligibleEmployees = useMemo(() => employees.filter((employee) => (
    employee.status === 'ACTIVE'
    && (!employee.joiningDate || employee.joiningDate <= monthEndKey)
  )), [employees, monthEndKey]);

  const locations = useMemo(() => [...new Set(employees.map((row) => row.workLocation).filter(Boolean))].sort(), [employees]);
  const filteredEmployees = useMemo(() => eligibleEmployees.filter((employee) => (
    (employeeFilter === 'ALL' || employee.id === employeeFilter)
    && (payrollTypeFilter === 'ALL' || (employee.payrollType || PAYROLL_TYPES.MONTHLY) === payrollTypeFilter)
    && (locationFilter === 'ALL' || employee.workLocation === locationFilter)
  )), [eligibleEmployees, employeeFilter, payrollTypeFilter, locationFilter]);

  const filteredPayroll = useMemo(() => monthPayroll.filter((record) => {
    const employee = employees.find((row) => row.id === record.employeeId);
    const text = `${record.salarySlipNumber} ${record.employeeNumber} ${record.employeeName}`.toLowerCase();
    return text.includes(search.toLowerCase())
      && (employeeFilter === 'ALL' || record.employeeId === employeeFilter)
      && (payrollTypeFilter === 'ALL' || record.payrollType === payrollTypeFilter)
      && (paymentStatusFilter === 'ALL' || record.status === paymentStatusFilter)
      && (locationFilter === 'ALL' || (record.workLocation || employee?.workLocation) === locationFilter);
  }), [monthPayroll, employees, search, employeeFilter, payrollTypeFilter, paymentStatusFilter, locationFilter]);

  const missingByEmployee = useMemo(() => Object.fromEntries(eligibleEmployees.map((employee) => [
    employee.id,
    missingAttendanceDates(employee, month, monthAttendance),
  ])), [eligibleEmployees, month, monthAttendance]);

  const metrics = useMemo(() => {
    const records = filteredPayroll;
    return {
      active: filteredEmployees.length,
      monthly: filteredEmployees.filter((employee) => (employee.payrollType || PAYROLL_TYPES.MONTHLY) === PAYROLL_TYPES.MONTHLY).length,
      daily: filteredEmployees.filter((employee) => employee.payrollType === PAYROLL_TYPES.DAILY).length,
      total: records.reduce((sum, row) => sum + safeNumber(row.netSalary), 0),
      overtime: records.reduce((sum, row) => sum + safeNumber(row.overtimePay ?? row.overtimeAmount), 0),
      deductions: records.reduce((sum, row) => sum + safeNumber(row.totalDeductions), 0),
      pending: records.filter((row) => ['DRAFT', 'APPROVED'].includes(row.status)).length,
      paid: records.filter((row) => row.status === 'PAID').length,
      unpaid: records.filter((row) => row.status !== 'PAID' && row.status !== 'CANCELLED').length,
      missing: filteredEmployees.filter((employee) => (missingByEmployee[employee.id] || []).length > 0).length,
    };
  }, [filteredPayroll, filteredEmployees, missingByEmployee]);

  useEffect(() => {
    if (initialEmployee) {
      setEmployeeFilter(initialEmployee.id);
      setTab('slips');
      clearInitialEmployee?.();
    }
  }, [initialEmployee]);

  useEffect(() => {
    if (initialFinalEmployee) {
      setFinalForm(blankFinalSettlement(settings, initialFinalEmployee));
      setFinalOpen(true);
      setTab('settlements');
      clearInitialFinalEmployee?.();
    }
  }, [initialFinalEmployee]);

  const buildPayrollPayload = (employee, existing = null) => {
    const records = monthAttendance.filter((row) => row.employeeId === employee.id);
    const totals = calculateAttendancePayroll(employee, records, existing || defaultAdjustment);
    return {
      ...existing,
      ...totals,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber || '',
      employeeName: employee.name || '',
      designation: employee.designation || '',
      department: employee.department || '',
      workLocation: employee.workLocation || '',
      salaryMonth: month,
      salarySlipNumber: existing?.salarySlipNumber || makeNumber(settings.salarySlipPrefix || 'PAY'),
      payrollType: employee.payrollType || PAYROLL_TYPES.MONTHLY,
      standardDailyHours: safeNumber(employee.standardDailyHours),
      standardWorkingDays: safeNumber(employee.standardWorkingDays),
      attendanceRecordCount: records.length,
      missingAttendanceCount: (missingByEmployee[employee.id] || []).length,
      status: existing?.status === 'PAID' ? 'PAID' : 'DRAFT',
      paymentDate: existing?.paymentDate || '',
      paymentMethod: existing?.paymentMethod || 'Bank Transfer',
      managerApproval: existing?.managerApproval || '',
      employeeAcknowledgement: existing?.employeeAcknowledgement || '',
      adjustmentNotes: existing?.adjustmentNotes || '',
    };
  };

  const calculateMonthPayroll = async () => {
    if (!canManage) return notify('Only a Manager can calculate payroll.', 'error');
    if (monthLocked) return notify('Reopen this payroll month before recalculating salaries.', 'error');
    if (!eligibleEmployees.length) return notify('No active employees are eligible for this payroll month.', 'error');
    const missingEmployees = eligibleEmployees.filter((employee) => (missingByEmployee[employee.id] || []).length > 0);
    const warning = missingEmployees.length
      ? ` ${missingEmployees.length} employee(s) have missing daily attendance; their saved records will still be used.`
      : '';
    if (!confirm(`Calculate or refresh salaries for ${eligibleEmployees.length} employee(s) for ${salaryMonthLabel(month)}?${warning}`)) return;

    setProcessing(true);
    try {
      for (const employee of eligibleEmployees) {
        const existing = monthPayroll.find((row) => row.employeeId === employee.id);
        const payload = buildPayrollPayload(employee, existing);
        await savePayrollRecord(payload, existing?.id || null);
      }
      await saveRecord('payrollPeriods', { month, status: 'OPEN', calculatedAt: new Date().toISOString(), employeeCount: eligibleEmployees.length }, month);
      notify(`Payroll calculated for ${eligibleEmployees.length} employee${eligibleEmployees.length === 1 ? '' : 's'}.`);
      setTab('monthly');
    } catch (reason) {
      notify(reason?.message || 'Could not calculate monthly payroll.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const approveMonth = async () => {
    if (!canManage) return;
    if (!monthPayroll.length) return notify('Calculate payroll before approving the month.', 'error');
    if (periodStatus !== 'OPEN') return notify('Only an open payroll month can be approved.', 'error');
    const missing = eligibleEmployees.reduce((sum, employee) => sum + (missingByEmployee[employee.id] || []).length, 0);
    if (!confirm(`Approve ${salaryMonthLabel(month)} payroll and lock attendance?${missing ? ` Warning: ${missing} attendance date(s) are missing.` : ''}`)) return;
    await setPayrollMonthStatus(month, 'APPROVED', monthPayroll.map((row) => row.id));
    notify('Payroll approved. Attendance for this month is now locked.');
  };

  const markMonthPaid = async () => {
    if (!canManage) return;
    if (!monthPayroll.length) return notify('No salary records are available.', 'error');
    if (periodStatus === 'OPEN') return notify('Approve payroll before marking salaries as paid.', 'error');
    if (periodStatus === 'CLOSED') return notify('Reopen the closed payroll month before changing payment status.', 'error');
    const unpaid = monthPayroll.filter((row) => row.status !== 'PAID');
    if (!unpaid.length) return notify('All salaries are already marked as paid.');
    if (!confirm(`Mark ${unpaid.length} salary record(s) as paid today?`)) return;
    await setPayrollMonthStatus(month, periodStatus, unpaid.map((row) => row.id), { markPaid: true, paymentDate: inputDate() });
    notify('Salaries marked as paid.');
  };

  const markRecordPaid = async (record) => {
    if (!canManage) return;
    if (periodStatus !== 'APPROVED') return notify('The payroll month must be approved before marking a salary as paid.', 'error');
    if (record.status === 'PAID') return notify('This salary is already marked as paid.');
    if (!confirm(`Mark ${record.employeeName}'s ${salaryMonthLabel(record.salaryMonth)} salary as paid?`)) return;
    await savePayrollRecord({
      ...record,
      status: 'PAID',
      paymentDate: record.paymentDate || inputDate(),
      paidAt: new Date().toISOString(),
    }, record.id);
    notify(`${record.employeeName}'s salary marked as paid.`);
  };

  const closeMonth = async () => {
    if (!canManage) return;
    if (periodStatus !== 'APPROVED') return notify('The month must be approved before it can be closed.', 'error');
    if (monthPayroll.some((row) => row.status !== 'PAID')) return notify('Mark every salary as paid before closing the payroll month.', 'error');
    if (!confirm(`Close and permanently lock ${salaryMonthLabel(month)} payroll?`)) return;
    await setPayrollMonthStatus(month, 'CLOSED');
    notify('Payroll month closed. Select the next month to begin a new attendance period.');
  };

  const reopenMonth = async () => {
    if (!canManage) return;
    if (periodStatus === 'OPEN') return;
    if (!confirm(`Reopen ${salaryMonthLabel(month)}? Attendance and payroll adjustments will become editable again.`)) return;
    await setPayrollMonthStatus(month, 'OPEN');
    notify('Payroll month reopened. Recalculate payroll after changing attendance.');
  };

  const openAdjustment = (record) => {
    if (!canManage || monthLocked) return;
    setAdjusting(record);
    setAdjustment({
      otherAdditions: safeNumber(record.otherAdditions),
      otherDeductions: safeNumber(record.otherDeductions),
      adjustmentNotes: record.adjustmentNotes || '',
      paymentMethod: record.paymentMethod || 'Bank Transfer',
    });
  };

  const saveAdjustment = async () => {
    const employee = employees.find((row) => row.id === adjusting?.employeeId);
    if (!employee) return notify('Employee record was not found.', 'error');
    const records = monthAttendance.filter((row) => row.employeeId === employee.id);
    const totals = calculateAttendancePayroll(employee, records, adjustment);
    await savePayrollRecord({ ...adjusting, ...totals, ...adjustment, status: 'DRAFT' }, adjusting.id);
    setAdjusting(null);
    notify('Payroll adjustments saved.');
  };

  const makePdf = (record) => createSalarySlipPdf(record, settings);
  const preview = async (record) => {
    try { previewBlob(await makePdf(record)); }
    catch (reason) { notify(reason?.message || 'Could not open the salary slip.', 'error'); }
  };
  const download = async (record) => {
    try { downloadBlob(await makePdf(record), `${record.salarySlipNumber || 'salary-slip'}.pdf`); }
    catch (reason) { notify(reason?.message || 'Could not download the salary slip.', 'error'); }
  };
  const upload = async (record, collectionName = 'payroll') => {
    if (!canManage) return;
    setUploadingId(record.id);
    try {
      const blob = await makePdf(record);
      const salaryMonth = record.salaryMonth || String(record.lastWorkingDate).slice(0, 7);
      const [year] = salaryMonth.split('-');
      const folder = record.recordType === 'FINAL_SETTLEMENT' ? 'Final Settlements' : 'Payroll';
      const result = await uploadBusinessPdf(blob, `${record.salarySlipNumber}-${record.employeeNumber}.pdf`, folder, settings.driveRootFolder, record.driveFileId || '', { year, subfolders: [salaryMonthLabel(salaryMonth).split(' ')[0], record.employeeNumber || 'Employee'] });
      await saveRecord(collectionName, { driveFileId: result.id, driveWebViewLink: result.webViewLink || '', driveUpdatedAt: new Date().toISOString() }, record.id);
      markDriveConnected(true);
      notify(result.replaced ? 'Salary slip replaced on Google Drive.' : 'Salary slip saved to Google Drive.');
    } catch (reason) {
      notify(reason?.message || 'Could not save the salary slip to Drive.', 'error');
    } finally {
      setUploadingId('');
    }
  };

  const openFinal = (employee = null) => {
    setFinalForm(blankFinalSettlement(settings, employee));
    setFinalOpen(true);
  };
  const finalEmployee = employees.find((row) => row.id === finalForm.employeeId);
  const finalMonth = String(finalForm.lastWorkingDate || '').slice(0, 7);
  const finalAttendance = attendance.filter((row) => row.employeeId === finalForm.employeeId && (row.attendanceMonth || String(row.date).slice(0, 7)) === finalMonth && row.date <= finalForm.lastWorkingDate);
  const finalTotals = useMemo(() => finalEmployee ? calculateFinalSettlement(finalEmployee, finalAttendance, finalForm) : null, [finalEmployee, finalAttendance, finalForm]);
  const finalMissing = finalEmployee && finalMonth ? missingAttendanceDates(finalEmployee, finalMonth, attendance.filter((row) => row.employeeId === finalEmployee.id), finalForm.lastWorkingDate) : [];

  const saveFinalSettlement = async () => {
    if (!canManage) return;
    if (!finalEmployee) return notify('Select an active employee.', 'error');
    if (!finalForm.lastWorkingDate || !finalForm.reasonForLeaving.trim()) return notify('Last working date and reason for leaving are required.', 'error');
    if (finalMissing.length && !confirm(`${finalMissing.length} attendance date(s) are missing before the last working date. Continue with the saved attendance records?`)) return;
    if (!confirm(`Approve the final salary for ${finalEmployee.name} and mark the employee inactive?`)) return;

    const record = {
      ...finalForm,
      ...finalTotals,
      salaryMonth: finalMonth,
      status: finalForm.settlementStatus === 'PAID' ? 'PAID' : 'APPROVED',
      settlementStatus: finalForm.settlementStatus,
      paymentDate: finalForm.settlementStatus === 'PAID' ? (finalForm.paymentDate || inputDate()) : finalForm.paymentDate,
      managerApproval: 'Approved',
      attendanceRecordCount: finalAttendance.length,
      missingAttendanceCount: finalMissing.length,
    };
    try {
      await processFinalSettlementRecord(finalEmployee, record);
      setFinalOpen(false);
      notify('Final salary settlement approved, saved in payroll history and employee marked inactive.');
    } catch (reason) {
      notify(reason?.message || 'Could not process the final settlement.', 'error');
    }
  };

  const workflowStep = periodStatus === 'CLOSED' ? 5 : periodStatus === 'APPROVED' ? 3 : monthPayroll.length ? 2 : monthAttendance.length ? 1 : 0;

  return <>
    <div className="payroll-page-header">
      <div><p className="eyebrow">PAYROLL & ATTENDANCE</p><h2>Monthly payroll control centre</h2><p>Attendance-driven salary calculations, approval, salary slips and final settlements.</p></div>
      <div className="payroll-month-picker"><label><span>Payroll month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><span className={`period-lock-badge ${periodStatus === 'OPEN' ? 'open' : 'locked'}`}>{periodStatus === 'OPEN' ? '✓ OPEN' : `🔒 ${periodStatus}`}</span></div>
    </div>

    <nav className="payroll-tabs">
      <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Overview</button>
      <button className={tab === 'monthly' ? 'active' : ''} onClick={() => setTab('monthly')}>Monthly Payroll</button>
      <button className={tab === 'slips' ? 'active' : ''} onClick={() => setTab('slips')}>Salary Slips</button>
      <button className={tab === 'settlements' ? 'active' : ''} onClick={() => setTab('settlements')}>Final Settlements</button>
    </nav>

    <section className="payroll-filter-bar panel">
      <label><span>Employee</span><select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="ALL">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      <label><span>Payroll type</span><select value={payrollTypeFilter} onChange={(event) => setPayrollTypeFilter(event.target.value)}><option value="ALL">All types</option><option value={PAYROLL_TYPES.MONTHLY}>Monthly-based</option><option value={PAYROLL_TYPES.DAILY}>Daily-based</option></select></label>
      <label><span>Payment status</span><select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option>DRAFT</option><option>APPROVED</option><option>PAID</option></select></label>
      <label><span>Work location</span><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="ALL">All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label>
    </section>

    {tab === 'dashboard' && <>
      <section className="stats-grid payroll-dashboard-stats">
        <article className="stat-card"><span>◎</span><p>Active employees</p><strong>{metrics.active}</strong><small>{metrics.monthly} monthly · {metrics.daily} daily</small></article>
        <article className="stat-card"><span>▣</span><p>Payroll total</p><strong>{currency(metrics.total, settings.currency)}</strong><small>{salaryMonthLabel(month)}</small></article>
        <article className="stat-card"><span>↗</span><p>Overtime cost</p><strong>{currency(metrics.overtime, settings.currency)}</strong><small>Extra duties</small></article>
        <article className="stat-card"><span>↘</span><p>Total deductions</p><strong>{currency(metrics.deductions, settings.currency)}</strong><small>Missed duty and adjustments</small></article>
        <article className="stat-card"><span>✓</span><p>Paid salaries</p><strong>{metrics.paid}</strong><small>{metrics.unpaid} unpaid · {metrics.pending} pending slips</small></article>
        <article className={`stat-card ${metrics.missing ? 'warning-stat' : ''}`}><span>!</span><p>Missing attendance</p><strong>{metrics.missing}</strong><small>Employees needing review</small></article>
      </section>

      <section className="panel payroll-workflow-card">
        <div className="panel-heading"><div><p className="eyebrow">MONTHLY WORKFLOW</p><h2>{salaryMonthLabel(month)}</h2></div><span className={`status status-${statusTone(periodStatus)}`}>{periodStatus}</span></div>
        <div className="workflow-steps">
          {['Record attendance', 'Calculate salaries', 'Review adjustments', 'Approve & lock', 'Mark paid', 'Close month'].map((label, index) => <div className={index <= workflowStep ? 'complete' : ''} key={label}><span>{index < workflowStep ? '✓' : index + 1}</span><b>{label}</b></div>)}
        </div>
        {canManage && <div className="workflow-actions">
          <button className="button button-primary" disabled={processing || monthLocked} onClick={calculateMonthPayroll}>{processing ? 'Calculating…' : monthPayroll.length ? 'Refresh calculations' : 'Calculate payroll'}</button>
          <button className="button button-secondary" disabled={periodStatus !== 'OPEN' || !monthPayroll.length} onClick={approveMonth}>Approve payroll</button>
          <button className="button button-secondary" disabled={periodStatus !== 'APPROVED' || !monthPayroll.length} onClick={markMonthPaid}>Mark all paid</button>
          <button className="button button-secondary" disabled={periodStatus !== 'APPROVED'} onClick={closeMonth}>Close month</button>
          {periodStatus !== 'OPEN' && <button className="button button-ghost" onClick={reopenMonth}>Reopen month</button>}
        </div>}
        {!canManage && <div className="alert alert-info">You can review calculated payroll and print salary slips. Approval, payment and reopening controls are restricted to Managers.</div>}
      </section>

      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">ATTENDANCE READINESS</p><h2>Employees requiring attention</h2></div></div>
        <div className="payroll-readiness-list">{eligibleEmployees.map((employee) => {
          const count = (missingByEmployee[employee.id] || []).length;
          const record = monthPayroll.find((row) => row.employeeId === employee.id);
          return <article key={employee.id}><div><strong>{employee.name}</strong><small>{payrollTypeLabel(employee.payrollType)} · {employee.workLocation || 'No location'}</small></div><span className={`status ${count ? 'status-draft' : 'status-paid'}`}>{count ? `${count} missing` : 'Attendance ready'}</span><span className={`status status-${statusTone(record?.status)}`}>{record?.status || 'Not calculated'}</span></article>;
        })}{!eligibleEmployees.length && <EmptyState icon="◎" title="No eligible employees" text="Add active employees for this payroll month." />}</div>
      </section>

      <section className="panel recent-settlements-card"><div className="panel-heading"><div><p className="eyebrow">FINAL SETTLEMENTS</p><h2>Recently completed</h2></div>{canManage && <button className="panel-link-button" onClick={() => { setTab('settlements'); openFinal(); }}>Process final salary</button>}</div>{finalSettlements.slice(0, 5).map((row) => <div className="settlement-summary-row" key={row.id}><div><strong>{row.employeeName}</strong><small>Last working date: {dateText(row.lastWorkingDate)}</small></div><b>{currency(row.finalNetAmount || row.netSalary, settings.currency)}</b><span className={`status status-${statusTone(row.status || row.settlementStatus)}`}>{row.status || row.settlementStatus}</span></div>)}{!finalSettlements.length && <p className="table-empty">No final settlements completed.</p>}</section>
    </>}

    {tab === 'monthly' && <>
      <div className="page-actions"><div><p className="eyebrow">MONTHLY PAYROLL</p><h2>Review salary calculations</h2></div>{canManage && <button className="button button-primary" disabled={processing || monthLocked} onClick={calculateMonthPayroll}>{processing ? 'Calculating…' : 'Calculate / Refresh'}</button>}</div>
      <section className="panel"><div className="responsive-table"><table><thead><tr><th>Employee</th><th>Type</th><th>Hours</th><th>OT</th><th>Missed</th><th>Base earnings</th><th>Additions</th><th>Deductions</th><th>Net salary</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredPayroll.map((record) => <tr key={record.id}><td data-label="Employee"><strong>{record.employeeName}</strong><small className="cell-subtext">{record.employeeNumber} · {record.workLocation || '—'}</small></td><td data-label="Type">{record.payrollType === PAYROLL_TYPES.DAILY ? 'Daily' : 'Monthly'}</td><td data-label="Hours">{safeNumber(record.totalHoursWorked).toFixed(2)}</td><td data-label="OT">{safeNumber(record.totalOvertimeHours ?? record.overtimeHours).toFixed(2)}</td><td data-label="Missed">{safeNumber(record.totalMissedHours).toFixed(2)}</td><td data-label="Base earnings">{currency(record.payrollType === PAYROLL_TYPES.DAILY ? record.hourlyEarnings : record.fixedSalary, settings.currency)}</td><td data-label="Additions">{currency(record.otherAdditions, settings.currency)}</td><td data-label="Deductions">{currency(record.totalDeductions, settings.currency)}</td><td data-label="Net salary"><strong>{currency(record.netSalary, settings.currency)}</strong></td><td data-label="Status"><span className={`status status-${statusTone(record.status)}`}>{record.status}</span>{record.missingAttendanceCount > 0 && <small className="missing-warning">{record.missingAttendanceCount} attendance missing</small>}</td><td data-label="Actions"><div className="row-actions">{canManage && !monthLocked && <button onClick={() => openAdjustment(record)}>Adjust</button>}<button onClick={() => preview(record)}>View slip</button><button onClick={() => download(record)}>PDF</button>{canManage && periodStatus === 'APPROVED' && record.status !== 'PAID' && <button onClick={() => markRecordPaid(record)}>Mark paid</button>}</div></td></tr>)}</tbody></table></div>{!filteredPayroll.length && <EmptyState icon="▣" title="Payroll not calculated" text="Record attendance, then calculate salaries for the selected month." />}</section>
    </>}

    {tab === 'slips' && <>
      <div className="page-actions"><div><p className="eyebrow">SALARY SLIPS</p><h2>Saved employee salary history</h2></div><div className="search-box">⌕<input placeholder="Search salary slips" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      <section className="salary-slip-grid">{filteredPayroll.map((record) => <article className="panel salary-slip-card" key={record.id}><header><div><small>{record.salarySlipNumber}</small><h3>{record.employeeName}</h3><p>{salaryMonthLabel(record.salaryMonth)} · {record.employeeNumber}</p></div><span className={`status status-${statusTone(record.status)}`}>{record.status}</span></header><dl><div><dt>Payroll type</dt><dd>{record.payrollType === PAYROLL_TYPES.DAILY ? 'Daily-based' : 'Monthly-based'}</dd></div><div><dt>Hours worked</dt><dd>{safeNumber(record.totalHoursWorked).toFixed(2)}</dd></div><div><dt>Overtime</dt><dd>{safeNumber(record.totalOvertimeHours ?? record.overtimeHours).toFixed(2)}</dd></div><div><dt>Net salary</dt><dd>{currency(record.netSalary, settings.currency)}</dd></div></dl><div className="row-actions"><button onClick={() => preview(record)}>View / Print</button><button onClick={() => download(record)}>Download PDF</button>{canManage && periodStatus === 'APPROVED' && record.status !== 'PAID' && <button onClick={() => markRecordPaid(record)}>Mark paid</button>}{canManage && <button disabled={uploadingId === record.id} onClick={() => upload(record)}>{record.driveFileId ? 'Replace Drive' : 'Google Drive'}</button>}{record.driveWebViewLink && <a href={record.driveWebViewLink} target="_blank" rel="noreferrer">Open Drive</a>}</div></article>)}</section>
      {!filteredPayroll.length && <section className="panel"><EmptyState icon="▣" title="No salary slips found" text="Change the filters or calculate payroll for this month." /></section>}
    </>}

    {tab === 'settlements' && <>
      <div className="page-actions"><div><p className="eyebrow">FINAL SALARY</p><h2>Employee final settlements</h2><p className="page-subtitle">Final salary is saved permanently and the employee is removed from future attendance after approval.</p></div>{canManage && <button className="button button-primary" onClick={() => openFinal()}>＋ Process final salary</button>}</div>
      <section className="panel"><div className="responsive-table"><table><thead><tr><th>Salary slip</th><th>Employee</th><th>Last working date</th><th>Prorated basic</th><th>Overtime</th><th>Deductions</th><th>Final net</th><th>Status</th><th>Actions</th></tr></thead><tbody>{finalSettlements.map((record) => <tr key={record.id}><td data-label="Salary slip">{record.salarySlipNumber}</td><td data-label="Employee"><strong>{record.employeeName}</strong><small className="cell-subtext">{record.reasonForLeaving}</small></td><td data-label="Last working date">{dateText(record.lastWorkingDate)}</td><td data-label="Prorated basic">{currency(record.proratedBasicSalary, settings.currency)}</td><td data-label="Overtime">{currency(record.overtimePay, settings.currency)}</td><td data-label="Deductions">{currency(record.totalDeductions, settings.currency)}</td><td data-label="Final net"><strong>{currency(record.finalNetAmount || record.netSalary, settings.currency)}</strong></td><td data-label="Status"><span className={`status status-${statusTone(record.status || record.settlementStatus)}`}>{record.status || record.settlementStatus}</span></td><td data-label="Actions"><div className="row-actions"><button onClick={() => preview(record)}>View / Print</button><button onClick={() => download(record)}>PDF</button>{canManage && <button disabled={uploadingId === record.id} onClick={() => upload(record, 'finalSettlements')}>{record.driveFileId ? 'Replace Drive' : 'Drive'}</button>}</div></td></tr>)}</tbody></table></div>{!finalSettlements.length && <EmptyState icon="✓" title="No final settlements" text="Use Process final salary when an employee permanently leaves DF7." />}</section>
    </>}

    <Modal open={Boolean(adjusting)} title="Review payroll adjustments" onClose={() => setAdjusting(null)}>
      {adjusting && <><div className="employee-payroll-modal-summary"><strong>{adjusting.employeeName}</strong><span>{salaryMonthLabel(adjusting.salaryMonth)}</span></div><div className="form-grid"><label><span>Other additions</span><input type="number" min="0" step="0.01" value={adjustment.otherAdditions} onChange={(event) => setAdjustment({ ...adjustment, otherAdditions: event.target.value })} /></label><label><span>Other deductions</span><input type="number" min="0" step="0.01" value={adjustment.otherDeductions} onChange={(event) => setAdjustment({ ...adjustment, otherDeductions: event.target.value })} /></label><label><span>Payment method</span><select value={adjustment.paymentMethod} onChange={(event) => setAdjustment({ ...adjustment, paymentMethod: event.target.value })}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option></select></label><label className="form-span-2"><span>Adjustment explanation</span><textarea rows="4" value={adjustment.adjustmentNotes} onChange={(event) => setAdjustment({ ...adjustment, adjustmentNotes: event.target.value })} /></label></div><div className="payroll-calculation"><div><span>Current net salary</span><strong>{currency(adjusting.netSalary, settings.currency)}</strong></div><div><span>Updated additions</span><strong>{currency(adjustment.otherAdditions, settings.currency)}</strong></div><div><span>Updated deductions</span><strong>{currency(adjustment.otherDeductions, settings.currency)}</strong></div></div><footer className="modal-actions"><button className="button button-ghost" onClick={() => setAdjusting(null)}>Cancel</button><button className="button button-primary" onClick={saveAdjustment}>Save adjustments</button></footer></>}
    </Modal>

    <Modal open={finalOpen} title="Process Final Salary" onClose={() => setFinalOpen(false)}>
      <div className="form-grid">
        <label className="form-span-2"><span>Employee</span><select value={finalForm.employeeId} onChange={(event) => setFinalForm(blankFinalSettlement(settings, employees.find((row) => row.id === event.target.value)))}><option value="">Select active employee</option>{employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.name}</option>)}</select></label>
        <label><span>Last working date</span><input type="date" value={finalForm.lastWorkingDate} onChange={(event) => setFinalForm({ ...finalForm, lastWorkingDate: event.target.value })} /></label>
        <label><span>Proration method</span><select value={finalForm.prorationMethod} onChange={(event) => setFinalForm({ ...finalForm, prorationMethod: event.target.value })}><option value="HOURS">Eligible hours</option><option value="DAYS">Eligible days</option></select></label>
        <label className="form-span-2"><span>Reason for leaving</span><input value={finalForm.reasonForLeaving} onChange={(event) => setFinalForm({ ...finalForm, reasonForLeaving: event.target.value })} placeholder="Resignation, contract ended, termination…" /></label>
        <label><span>Other additions</span><input type="number" min="0" step="0.01" value={finalForm.otherAdditions} onChange={(event) => setFinalForm({ ...finalForm, otherAdditions: event.target.value })} /></label>
        <label><span>Other deductions</span><input type="number" min="0" step="0.01" value={finalForm.otherDeductions} onChange={(event) => setFinalForm({ ...finalForm, otherDeductions: event.target.value })} /></label>
        <label><span>Settlement status</span><select value={finalForm.settlementStatus} onChange={(event) => setFinalForm({ ...finalForm, settlementStatus: event.target.value })}><option>APPROVED</option><option>PAID</option></select></label>
        <label><span>Payment date</span><input type="date" value={finalForm.paymentDate} onChange={(event) => setFinalForm({ ...finalForm, paymentDate: event.target.value })} /></label>
        <label><span>Payment method</span><select value={finalForm.paymentMethod} onChange={(event) => setFinalForm({ ...finalForm, paymentMethod: event.target.value })}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option></select></label>
        <label><span>Salary slip number</span><input value={finalForm.salarySlipNumber} onChange={(event) => setFinalForm({ ...finalForm, salarySlipNumber: event.target.value })} /></label>
        <label className="form-span-2"><span>Notes</span><textarea rows="3" value={finalForm.notes} onChange={(event) => setFinalForm({ ...finalForm, notes: event.target.value })} /></label>
      </div>
      {finalEmployee && finalTotals && <><div className="final-settlement-attendance"><span>Attendance records: <b>{finalAttendance.length}</b></span><span className={finalMissing.length ? 'warning-text' : ''}>Missing dates: <b>{finalMissing.length}</b></span><span>Actual hours: <b>{finalTotals.totalHoursWorked.toFixed(2)}</b></span><span>Overtime: <b>{finalTotals.totalOvertimeHours.toFixed(2)}</b></span><span>Missed: <b>{finalTotals.totalMissedHours.toFixed(2)}</b></span></div><div className="payroll-calculation final-calculation"><div><span>Prorated basic salary</span><strong>{currency(finalTotals.proratedBasicSalary, settings.currency)}</strong></div><div><span>Overtime pay</span><strong>{currency(finalTotals.overtimePay, settings.currency)}</strong></div><div><span>Missed-duty deduction</span><strong>− {currency(finalTotals.missedDutyDeduction, settings.currency)}</strong></div><div><span>Other deductions</span><strong>− {currency(finalTotals.otherDeductions, settings.currency)}</strong></div><div className="payroll-net"><span>Final net amount</span><strong>{currency(finalTotals.finalNetAmount, settings.currency)}</strong></div></div></>}
      <div className="alert alert-info">Approving the final settlement permanently saves the slip, marks the employee inactive and removes them from future attendance lists. Previous records remain available.</div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setFinalOpen(false)}>Cancel</button><button className="button button-primary" onClick={saveFinalSettlement}>Approve final settlement</button></footer>
    </Modal>
  </>;
}
