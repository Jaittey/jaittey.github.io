import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import {
  markPayrollAndSalarySlipPaid,
  processFinalSettlementRecord,
  savePayrollRecord,
  saveRecord,
  saveSalarySlipRecord,
  setPayrollMonthStatus,
} from '../services/database';
import { createSalarySlipPdf, downloadBlob, previewBlob } from '../services/pdf';
import { uploadBusinessPdf } from '../services/drive';
import {
  currency,
  currentSalaryMonth,
  dateText,
  inputDate,
  safeNumber,
  salaryMonthLabel,
} from '../utils/format';
import { normalizeRole } from '../config/erp';
import {
  PAYROLL_TYPES,
  calculateFinalSettlement,
  calculatePayrollWithDayAdjustments,
  employeePayrollMonthKeys,
  missingAttendanceDates,
  monthBounds,
  payrollTypeLabel,
} from '../utils/payroll';

const payrollStatusTone = (status = 'NOT_CALCULATED') => String(status).toLowerCase().replaceAll('_', '-');

const blankPayment = () => ({
  paymentDate: inputDate(),
  paymentMethod: 'Bank Transfer',
  paymentReference: '',
  paymentNotes: '',
});

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
  salarySlipNumber: `${settings.salarySlipPrefix || 'PAY'}-FINAL-${Date.now().toString().slice(-6)}`,
  notes: '',
});

const initialEditForm = (summary = {}) => ({
  paidDays: safeNumber(summary.paidDays),
  unpaidDays: safeNumber(summary.unpaidDays),
  paidLeaveDays: safeNumber(summary.paidLeaveDays),
  unpaidLeaveDays: safeNumber(summary.unpaidLeaveDays),
  otherAdditions: safeNumber(summary.otherAdditions),
  otherDeductions: safeNumber(summary.otherDeductions),
  adjustmentNotes: summary.adjustmentNotes || '',
});

const salarySlipNumber = (settings, employee, month) => (
  `${settings.salarySlipPrefix || 'PAY'}-${String(month || '').replace('-', '')}-${employee.employeeNumber || employee.id}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toUpperCase()
);

const slipFormFromPayroll = (employee, month, summary, existing, settings) => ({
  ...existing,
  payrollId: summary.id || `${employee.id}_${month}`,
  employeeId: employee.id,
  employeeNumber: existing?.employeeNumber ?? employee.employeeNumber ?? '',
  employeeName: existing?.employeeName ?? employee.name ?? '',
  designation: existing?.designation ?? employee.designation ?? '',
  workLocation: existing?.workLocation ?? employee.workLocation ?? '',
  payrollType: existing?.payrollType ?? employee.payrollType ?? PAYROLL_TYPES.MONTHLY,
  salaryMonth: month,
  salarySlipNumber: existing?.salarySlipNumber || summary.salarySlipNumber || salarySlipNumber(settings, employee, month),
  totalWorkingDays: existing?.totalWorkingDays ?? summary.totalWorkingDays ?? 0,
  paidDays: existing?.paidDays ?? summary.paidDays ?? 0,
  unpaidDays: existing?.unpaidDays ?? summary.unpaidDays ?? 0,
  paidLeaveDays: existing?.paidLeaveDays ?? summary.paidLeaveDays ?? 0,
  unpaidLeaveDays: existing?.unpaidLeaveDays ?? summary.unpaidLeaveDays ?? 0,
  totalHoursWorked: existing?.totalHoursWorked ?? summary.totalHoursWorked ?? 0,
  totalOvertimeHours: existing?.totalOvertimeHours ?? summary.totalOvertimeHours ?? 0,
  totalMissedHours: existing?.totalMissedHours ?? summary.totalMissedHours ?? 0,
  totalOffDays: existing?.totalOffDays ?? summary.totalOffDays ?? 0,
  totalAbsentDays: existing?.totalAbsentDays ?? summary.totalAbsentDays ?? 0,
  fixedSalary: existing?.fixedSalary ?? summary.fixedSalary ?? 0,
  hourlyRate: existing?.hourlyRate ?? summary.hourlyRate ?? 0,
  hourlyEarnings: existing?.hourlyEarnings ?? summary.hourlyEarnings ?? 0,
  overtimePay: existing?.overtimePay ?? summary.overtimePay ?? 0,
  otherAdditions: existing?.otherAdditions ?? (safeNumber(summary.otherAdditions) + safeNumber(summary.paidDayAdjustment)),
  customAddition: existing?.customAddition ?? 0,
  missedDutyDeduction: existing?.missedDutyDeduction ?? summary.missedDutyDeduction ?? 0,
  otherDeductions: existing?.otherDeductions ?? (safeNumber(summary.otherDeductions) + safeNumber(summary.unpaidDayDeduction)),
  customDeduction: existing?.customDeduction ?? 0,
  calculatedPayrollAmount: safeNumber(summary.netSalary),
  adjustmentReason: existing?.adjustmentReason || '',
  paymentStatus: existing?.paymentStatus || (summary.status === 'PAID' ? 'PAID' : 'UNPAID'),
  paymentDate: existing?.paymentDate || summary.paymentDate || '',
  paymentMethod: existing?.paymentMethod || summary.paymentMethod || 'Bank Transfer',
  paymentReference: existing?.paymentReference || summary.paymentReference || '',
  managerApproval: existing?.managerApproval || summary.managerApproval || '',
  employeeAcknowledgement: existing?.employeeAcknowledgement || summary.employeeAcknowledgement || '',
  notes: existing?.notes || summary.adjustmentNotes || '',
  status: existing?.status || (summary.status === 'PAID' ? 'PAID' : 'DRAFT'),
  driveFileId: existing?.driveFileId || '',
  driveWebViewLink: existing?.driveWebViewLink || '',
});

const calculateSlipTotals = (form = {}) => {
  const daily = form.payrollType === PAYROLL_TYPES.DAILY;
  const baseEarnings = daily ? safeNumber(form.hourlyEarnings) : safeNumber(form.fixedSalary);
  const grossSalary = baseEarnings
    + safeNumber(form.overtimePay)
    + safeNumber(form.otherAdditions)
    + safeNumber(form.customAddition);
  const totalDeductions = safeNumber(form.missedDutyDeduction)
    + safeNumber(form.otherDeductions)
    + safeNumber(form.customDeduction);
  const issuedSalaryAmount = Math.max(0, grossSalary - totalDeductions);
  const difference = issuedSalaryAmount - safeNumber(form.calculatedPayrollAmount);
  return {
    baseEarnings,
    grossSalary,
    totalDeductions,
    issuedSalaryAmount,
    netSalary: issuedSalaryAmount,
    difference,
  };
};

export default function Payroll({
  payroll,
  salarySlips,
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
  const [view, setView] = useState('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentSalaryMonth());
  const [listMonth, setListMonth] = useState(currentSalaryMonth());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [slipStatusFilter, setSlipStatusFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(initialEditForm());
  const [slipOpen, setSlipOpen] = useState(false);
  const [slipForm, setSlipForm] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(blankPayment());
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [finalForm, setFinalForm] = useState(() => blankFinalSettlement(settings));
  const [processing, setProcessing] = useState(false);
  const [uploadingId, setUploadingId] = useState('');

  const normalizedRole = normalizeRole(role);
  const canManage = ['administrator', 'manager'].includes(normalizedRole);
  const regularPayroll = useMemo(() => payroll.filter((row) => row.recordType !== 'FINAL_SETTLEMENT'), [payroll]);
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || null;
  const locations = useMemo(() => [...new Set(employees.map((row) => row.workLocation).filter(Boolean))].sort(), [employees]);

  const recordsForEmployeeMonth = (employeeId, month) => attendance.filter((row) => (
    row.employeeId === employeeId
    && (row.attendanceMonth || String(row.date || '').slice(0, 7)) === month
  ));
  const payrollForEmployeeMonth = (employeeId, month) => regularPayroll.find((row) => row.employeeId === employeeId && row.salaryMonth === month);
  const slipForEmployeeMonth = (employeeId, month) => salarySlips.find((row) => row.employeeId === employeeId && row.salaryMonth === month);
  const periodForMonth = (month) => payrollPeriods.find((row) => row.id === month || row.month === month);

  const buildMonthSummary = (employee, month) => {
    const existing = payrollForEmployeeMonth(employee.id, month);
    const records = recordsForEmployeeMonth(employee.id, month);
    const period = periodForMonth(month);
    const calculated = calculatePayrollWithDayAdjustments(employee, records, existing || {});
    const locked = ['APPROVED', 'CLOSED'].includes(period?.status) || ['APPROVED', 'PAID'].includes(existing?.status);
    const merged = locked && existing ? { ...calculated, ...existing } : { ...existing, ...calculated };
    const status = period?.status === 'CLOSED'
      ? 'CLOSED'
      : (existing?.status || (records.length ? 'NOT_CALCULATED' : 'NOT_CALCULATED'));
    return {
      ...merged,
      id: existing?.id || `${employee.id}_${month}`,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber || '',
      employeeName: employee.name || '',
      designation: employee.designation || '',
      workLocation: employee.workLocation || '',
      payrollType: employee.payrollType || PAYROLL_TYPES.MONTHLY,
      salaryMonth: month,
      status,
      periodStatus: period?.status || 'OPEN',
      attendanceRecordCount: records.length,
      missingAttendanceCount: missingAttendanceDates(employee, month, records).length,
      salarySlipNumber: existing?.salarySlipNumber || salarySlipNumber(settings, employee, month),
    };
  };

  const currentEmployeeCards = useMemo(() => employees
    .filter((employee) => {
      const text = `${employee.name} ${employee.employeeNumber} ${employee.designation} ${employee.workLocation}`.toLowerCase();
      return text.includes(search.toLowerCase())
        && (statusFilter === 'ALL' || employee.status === statusFilter)
        && (typeFilter === 'ALL' || (employee.payrollType || PAYROLL_TYPES.MONTHLY) === typeFilter)
        && (locationFilter === 'ALL' || employee.workLocation === locationFilter);
    })
    .map((employee) => ({ employee, summary: buildMonthSummary(employee, listMonth) })), [employees, attendance, regularPayroll, payrollPeriods, search, statusFilter, typeFilter, locationFilter, listMonth]);

  const employeeMonths = useMemo(() => selectedEmployee
    ? employeePayrollMonthKeys(selectedEmployee, attendance, regularPayroll, salarySlips)
    : [], [selectedEmployee, attendance, regularPayroll, salarySlips]);

  const monthsByYear = useMemo(() => employeeMonths.reduce((groups, month) => {
    const year = month.slice(0, 4);
    if (!groups[year]) groups[year] = [];
    groups[year].push(month);
    return groups;
  }, {}), [employeeMonths]);

  const selectedSummary = selectedEmployee ? buildMonthSummary(selectedEmployee, selectedMonth) : null;
  const selectedSlip = selectedEmployee ? slipForEmployeeMonth(selectedEmployee.id, selectedMonth) : null;
  const selectedPeriod = periodForMonth(selectedMonth);
  const selectedPeriodStatus = selectedPeriod?.status || 'OPEN';
  const selectedLocked = ['APPROVED', 'CLOSED'].includes(selectedPeriodStatus);
  const slipEditable = canManage && slipForm?.status !== 'PAID' && selectedPeriodStatus !== 'CLOSED';

  useEffect(() => {
    if (initialEmployee) {
      setSelectedEmployeeId(initialEmployee.id);
      setView('profile');
      clearInitialEmployee?.();
    }
  }, [initialEmployee]);

  useEffect(() => {
    if (initialFinalEmployee) {
      setSelectedEmployeeId(initialFinalEmployee.id);
      setFinalForm(blankFinalSettlement(settings, initialFinalEmployee));
      setFinalOpen(true);
      setView('profile');
      clearInitialFinalEmployee?.();
    }
  }, [initialFinalEmployee]);

  const openProfile = (employee) => {
    setSelectedEmployeeId(employee.id);
    setSelectedMonth(listMonth);
    setView('profile');
  };

  const openMonthMenu = (month) => {
    setSelectedMonth(month);
    setMonthMenuOpen(true);
  };

  const saveCalculatedRecord = async (employee, month, adjustments = {}, status = 'DRAFT') => {
    const existing = payrollForEmployeeMonth(employee.id, month);
    const records = recordsForEmployeeMonth(employee.id, month);
    const totals = calculatePayrollWithDayAdjustments(employee, records, adjustments);
    const payload = {
      ...existing,
      ...totals,
      ...adjustments,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber || '',
      employeeName: employee.name || '',
      designation: employee.designation || '',
      department: employee.department || '',
      workLocation: employee.workLocation || '',
      payrollType: employee.payrollType || PAYROLL_TYPES.MONTHLY,
      salaryMonth: month,
      payrollYear: Number(month.slice(0, 4)),
      salarySlipNumber: existing?.salarySlipNumber || salarySlipNumber(settings, employee, month),
      attendanceRecordCount: records.length,
      missingAttendanceCount: missingAttendanceDates(employee, month, records).length,
      status,
      paymentStatus: existing?.paymentStatus || (status === 'PAID' ? 'PAID' : 'UNPAID'),
      calculatedAt: new Date().toISOString(),
    };
    const id = await savePayrollRecord(payload, existing?.id || null);
    return { ...payload, id };
  };

  const calculateAllEmployees = async (month = listMonth, showConfirmation = true) => {
    if (!canManage) return notify('Only a Manager can calculate payroll.', 'error');
    if (['APPROVED', 'CLOSED'].includes(periodForMonth(month)?.status)) return notify('Reopen this month before recalculating payroll.', 'error');
    const { end } = monthBounds(month);
    const monthEnd = inputDate(end);
    const eligible = employees.filter((employee) => employee.status === 'ACTIVE' && (!employee.joiningDate || employee.joiningDate <= monthEnd));
    if (!eligible.length) return notify('No active employees are eligible for this month.', 'error');
    if (showConfirmation && !confirm(`Calculate payroll for ${eligible.length} employee(s) for ${salaryMonthLabel(month)}?`)) return;
    setProcessing(true);
    try {
      for (const employee of eligible) {
        const existing = payrollForEmployeeMonth(employee.id, month);
        await saveCalculatedRecord(employee, month, existing || {}, existing?.status === 'PAID' ? 'PAID' : 'DRAFT');
      }
      await saveRecord('payrollPeriods', { month, status: 'OPEN', calculatedAt: new Date().toISOString(), employeeCount: eligible.length }, month);
      notify(`Payroll calculated for ${eligible.length} employee${eligible.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      notify(reason?.message || 'Could not calculate payroll.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const approveMonth = async (month) => {
    if (!canManage) return;
    if (periodForMonth(month)?.status !== 'OPEN' && periodForMonth(month)) return notify('Only an open payroll month can be approved.', 'error');
    const { end } = monthBounds(month);
    const eligible = employees.filter((employee) => employee.status === 'ACTIVE' && (!employee.joiningDate || employee.joiningDate <= inputDate(end)));
    const missingCount = eligible.reduce((total, employee) => total + missingAttendanceDates(employee, month, recordsForEmployeeMonth(employee.id, month)).length, 0);
    if (!confirm(`Approve ${salaryMonthLabel(month)} payroll and lock attendance for all employees?${missingCount ? ` Warning: ${missingCount} attendance date(s) are missing.` : ''}`)) return;
    setProcessing(true);
    try {
      const ids = [];
      for (const employee of eligible) {
        const existing = payrollForEmployeeMonth(employee.id, month);
        const saved = await saveCalculatedRecord(employee, month, existing || {}, 'DRAFT');
        ids.push(saved.id);
      }
      await setPayrollMonthStatus(month, 'APPROVED', ids);
      notify('Payroll approved and attendance locked for this month.');
      setMonthMenuOpen(false);
    } catch (reason) {
      notify(reason?.message || 'Could not approve payroll.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const reopenMonth = async (month) => {
    if (!canManage) return;
    if (!confirm(`Reopen ${salaryMonthLabel(month)}? Attendance and draft payroll details will become editable again.`)) return;
    const payrollIds = regularPayroll.filter((row) => row.salaryMonth === month).map((row) => row.id);
    await setPayrollMonthStatus(month, 'OPEN', payrollIds);
    notify('Payroll month reopened. Recalculate payroll after changing attendance.');
  };

  const closeMonth = async (month) => {
    if (!canManage) return;
    const records = regularPayroll.filter((row) => row.salaryMonth === month);
    if (periodForMonth(month)?.status !== 'APPROVED') return notify('Approve the payroll month before closing it.', 'error');
    if (!records.length || records.some((row) => row.status !== 'PAID')) return notify('Every employee salary must be marked paid before closing the month.', 'error');
    if (!confirm(`Close ${salaryMonthLabel(month)}? The completed payroll history will remain permanently available.`)) return;
    await setPayrollMonthStatus(month, 'CLOSED');
    notify('Payroll month closed.');
  };

  const openEdit = () => {
    if (!selectedEmployee || !selectedSummary) return;
    if (!canManage) return notify('Users can view payroll but only Managers can edit calculations.', 'error');
    if (selectedLocked || ['APPROVED', 'PAID', 'CLOSED'].includes(selectedSummary.status)) return notify('Reopen this payroll month before editing.', 'error');
    setEditForm(initialEditForm(selectedSummary));
    setMonthMenuOpen(false);
    setEditOpen(true);
  };

  const resetEditFromAttendance = () => {
    if (!selectedEmployee) return;
    const fresh = calculatePayrollWithDayAdjustments(selectedEmployee, recordsForEmployeeMonth(selectedEmployee.id, selectedMonth), {});
    setEditForm(initialEditForm(fresh));
  };

  const editedTotals = selectedEmployee
    ? calculatePayrollWithDayAdjustments(selectedEmployee, recordsForEmployeeMonth(selectedEmployee.id, selectedMonth), editForm)
    : null;

  const saveEdit = async () => {
    if (!selectedEmployee) return;
    try {
      await saveCalculatedRecord(selectedEmployee, selectedMonth, editForm, 'DRAFT');
      setEditOpen(false);
      notify('Payroll details saved as draft.');
    } catch (reason) {
      notify(reason?.message || 'Could not save payroll details.', 'error');
    }
  };

  const openSalarySlip = () => {
    if (!selectedEmployee || !selectedSummary) return;
    const form = slipFormFromPayroll(selectedEmployee, selectedMonth, selectedSummary, selectedSlip, settings);
    setSlipForm({ ...form, ...calculateSlipTotals(form) });
    setMonthMenuOpen(false);
    setSlipOpen(true);
  };

  const updateSlip = (changes) => {
    setSlipForm((current) => {
      const next = { ...current, ...changes };
      return { ...next, ...calculateSlipTotals(next) };
    });
  };

  const saveSlip = async (status = 'DRAFT') => {
    if (!slipEditable) return notify('This salary slip is locked. Reopen the month before changing an issued slip.', 'error');
    if (!selectedEmployee || !slipForm) return;
    const totals = calculateSlipTotals(slipForm);
    if (Math.abs(totals.difference) > 0.009 && !String(slipForm.adjustmentReason || '').trim()) {
      return notify('Enter a reason because the issued salary differs from the calculated payroll.', 'error');
    }
    if (status === 'APPROVED' && !['APPROVED', 'PAID'].includes(selectedSummary?.status)) {
      return notify('Approve the payroll month before issuing the salary slip.', 'error');
    }
    try {
      const id = await saveSalarySlipRecord({
        ...slipForm,
        ...totals,
        status,
        paymentStatus: status === 'PAID' ? 'PAID' : slipForm.paymentStatus,
        issuedAt: status === 'APPROVED' ? new Date().toISOString() : slipForm.issuedAt || '',
      }, selectedSlip?.id || slipForm.id || null);
      setSlipForm((current) => ({ ...current, ...totals, id, status }));
      notify(status === 'APPROVED' ? 'Salary slip approved and permanently saved.' : 'Salary slip saved as draft.');
    } catch (reason) {
      notify(reason?.message || 'Could not save the salary slip.', 'error');
    }
  };

  const previewSlip = async () => {
    if (!slipForm) return;
    try { previewBlob(await createSalarySlipPdf({ ...slipForm, ...calculateSlipTotals(slipForm) }, settings)); }
    catch (reason) { notify(reason?.message || 'Could not open the salary slip.', 'error'); }
  };

  const downloadSlip = async () => {
    if (!slipForm) return;
    try { downloadBlob(await createSalarySlipPdf({ ...slipForm, ...calculateSlipTotals(slipForm) }, settings), `${slipForm.salarySlipNumber || 'salary-slip'}.pdf`); }
    catch (reason) { notify(reason?.message || 'Could not download the salary slip.', 'error'); }
  };

  const uploadSlip = async () => {
    if (!canManage || !slipForm || !selectedEmployee) return;
    setUploadingId(slipForm.id || 'new');
    try {
      const savedId = slipForm.id || await saveSalarySlipRecord({ ...slipForm, ...calculateSlipTotals(slipForm) }, selectedSlip?.id || null);
      const blob = await createSalarySlipPdf({ ...slipForm, ...calculateSlipTotals(slipForm) }, settings);
      const [year] = selectedMonth.split('-');
      const result = await uploadBusinessPdf(
        blob,
        `${slipForm.salarySlipNumber || 'salary-slip'}.pdf`,
        'Employees',
        settings.driveRootFolder,
        slipForm.driveFileId || '',
        { year, subfolders: [`${selectedEmployee.employeeNumber || 'Employee'} - ${selectedEmployee.name}`, 'Payroll', salaryMonthLabel(selectedMonth).split(' ')[0]] },
      );
      await saveSalarySlipRecord({ driveFileId: result.id, driveWebViewLink: result.webViewLink || '', driveUpdatedAt: new Date().toISOString() }, savedId);
      setSlipForm((current) => ({ ...current, id: savedId, driveFileId: result.id, driveWebViewLink: result.webViewLink || '' }));
      markDriveConnected(true);
      notify(result.replaced ? 'Salary slip replaced on Google Drive.' : 'Salary slip saved to Google Drive.');
    } catch (reason) {
      notify(reason?.message || 'Could not save the salary slip to Drive.', 'error');
    } finally {
      setUploadingId('');
    }
  };

  const reopenSlip = async () => {
    if (!canManage || !slipForm?.id || selectedPeriodStatus !== 'OPEN') return;
    if (!confirm('Reopen this salary slip for editing? Its payment status will return to Unpaid until it is approved and paid again.')) return;
    await saveSalarySlipRecord({
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      paymentDate: '',
      paidAt: '',
      reopenedAt: new Date().toISOString(),
    }, slipForm.id);
    setSlipForm((current) => ({ ...current, status: 'DRAFT', paymentStatus: 'UNPAID', paymentDate: '' }));
    notify('Salary slip reopened for editing.');
  };

  const openPayment = async () => {
    if (!canManage || !selectedEmployee || !selectedSummary) return;
    if (!['APPROVED', 'PAID'].includes(selectedSummary.status)) return notify('Approve payroll before marking it paid.', 'error');
    let slip = selectedSlip || slipForm;
    if (!slip) {
      const form = slipFormFromPayroll(selectedEmployee, selectedMonth, selectedSummary, null, settings);
      const totals = calculateSlipTotals(form);
      const id = await saveSalarySlipRecord({ ...form, ...totals, status: 'APPROVED' });
      slip = { ...form, ...totals, id, status: 'APPROVED' };
    }
    setPaymentTarget({ payroll: selectedSummary, slip });
    setPaymentForm({
      paymentDate: slip.paymentDate || selectedSummary.paymentDate || inputDate(),
      paymentMethod: slip.paymentMethod || selectedSummary.paymentMethod || 'Bank Transfer',
      paymentReference: slip.paymentReference || selectedSummary.paymentReference || '',
      paymentNotes: slip.paymentNotes || '',
    });
    setMonthMenuOpen(false);
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    if (!paymentTarget?.payroll?.id || !paymentTarget?.slip?.id) return notify('Payroll and salary-slip records are required.', 'error');
    if (!paymentForm.paymentDate || !paymentForm.paymentMethod) return notify('Payment date and method are required.', 'error');
    if (!confirm(`Mark ${paymentTarget.payroll.employeeName}'s ${salaryMonthLabel(paymentTarget.payroll.salaryMonth)} salary as paid?`)) return;
    try {
      await markPayrollAndSalarySlipPaid(paymentTarget.payroll.id, paymentTarget.slip.id, paymentForm);
      setPaymentOpen(false);
      setSlipOpen(false);
      notify('Payroll and salary slip marked as paid.');
    } catch (reason) {
      notify(reason?.message || 'Could not update the payment status.', 'error');
    }
  };

  const openFinal = (employee = selectedEmployee) => {
    setFinalForm(blankFinalSettlement(settings, employee));
    setFinalOpen(true);
  };

  const finalEmployee = employees.find((row) => row.id === finalForm.employeeId);
  const finalMonth = String(finalForm.lastWorkingDate || '').slice(0, 7);
  const finalAttendance = attendance.filter((row) => row.employeeId === finalForm.employeeId && (row.attendanceMonth || String(row.date).slice(0, 7)) === finalMonth && row.date <= finalForm.lastWorkingDate);
  const finalTotals = finalEmployee ? calculateFinalSettlement(finalEmployee, finalAttendance, finalForm) : null;
  const finalMissing = finalEmployee && finalMonth ? missingAttendanceDates(finalEmployee, finalMonth, attendance.filter((row) => row.employeeId === finalEmployee.id), finalForm.lastWorkingDate) : [];

  const saveFinalSettlement = async () => {
    if (!canManage) return;
    if (!finalEmployee) return notify('Select an active employee.', 'error');
    if (!finalForm.lastWorkingDate || !finalForm.reasonForLeaving.trim()) return notify('Last working date and reason for leaving are required.', 'error');
    if (finalMissing.length && !confirm(`${finalMissing.length} attendance date(s) are missing. Continue using the saved records?`)) return;
    if (!confirm(`Approve final salary for ${finalEmployee.name} and mark the employee inactive?`)) return;
    try {
      await processFinalSettlementRecord(finalEmployee, {
        ...finalForm,
        ...finalTotals,
        salaryMonth: finalMonth,
        status: finalForm.settlementStatus === 'PAID' ? 'PAID' : 'APPROVED',
        paymentDate: finalForm.settlementStatus === 'PAID' ? (finalForm.paymentDate || inputDate()) : finalForm.paymentDate,
        managerApproval: 'Approved',
        attendanceRecordCount: finalAttendance.length,
        missingAttendanceCount: finalMissing.length,
      });
      setFinalOpen(false);
      notify('Final settlement saved and employee marked inactive.');
    } catch (reason) {
      notify(reason?.message || 'Could not process final settlement.', 'error');
    }
  };

  return <>
    {view === 'employees' && <>
      <div className="payroll-employee-first-header">
        <div>
          <p className="eyebrow">PAYROLL & ATTENDANCE</p>
          <h2>Employee Payroll</h2>
          <p>Select an employee to view every month, edit salary details and issue salary slips.</p>
        </div>
        <div className="payroll-primary-controls">
          <label><span>Display month</span><input type="month" value={listMonth} onChange={(event) => setListMonth(event.target.value)} /></label>
          {canManage && <button className="button button-primary" disabled={processing} onClick={() => calculateAllEmployees(listMonth)}>{processing ? 'Calculating…' : 'Calculate all'}</button>}
        </div>
      </div>

      <section className="payroll-simple-filters panel">
        <label className="payroll-search-field"><span>Search employee</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, employee ID, designation…" /></label>
        <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ALL">All</option></select></label>
        <label><span>Payroll type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">All types</option><option value={PAYROLL_TYPES.MONTHLY}>Monthly-based</option><option value={PAYROLL_TYPES.DAILY}>Daily-based</option></select></label>
        <label><span>Location</span><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="ALL">All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label>
      </section>

      <section className="payroll-list-month-controls panel">
        <div><small>{salaryMonthLabel(listMonth)}</small><strong>{periodForMonth(listMonth)?.status || 'OPEN'}</strong></div>
        {canManage && <div className="row-actions">
          <button disabled={periodForMonth(listMonth)?.status === 'APPROVED' || periodForMonth(listMonth)?.status === 'CLOSED'} onClick={() => approveMonth(listMonth)}>Approve & lock</button>
          {['APPROVED', 'CLOSED'].includes(periodForMonth(listMonth)?.status) && <button onClick={() => reopenMonth(listMonth)}>Reopen</button>}
          <button disabled={periodForMonth(listMonth)?.status !== 'APPROVED'} onClick={() => closeMonth(listMonth)}>Close month</button>
          <button onClick={() => { setView('settlements'); }}>Final settlements</button>
        </div>}
      </section>

      <section className="payroll-employee-list">
        {currentEmployeeCards.map(({ employee, summary }) => <article className="panel payroll-employee-card" key={employee.id} onClick={() => openProfile(employee)}>
          <div className="payroll-employee-avatar">{(employee.name || '?').slice(0, 1).toUpperCase()}</div>
          <div className="payroll-employee-identity">
            <small>{employee.employeeNumber || 'No employee ID'}</small>
            <h3>{employee.name}</h3>
            <p>{employee.designation || 'No designation'} · {employee.workLocation || 'No work location'}</p>
            <span>{payrollTypeLabel(employee.payrollType)}</span>
          </div>
          <div className="payroll-card-salary">
            <small>{salaryMonthLabel(listMonth)}</small>
            <strong>{currency(summary.netSalary, settings.currency || 'MVR')}</strong>
            <span className={`status status-${payrollStatusTone(summary.status)}`}>{summary.status.replaceAll('_', ' ')}</span>
            {summary.missingAttendanceCount > 0 && <em>{summary.missingAttendanceCount} missing attendance date(s)</em>}
          </div>
          <button className="button button-secondary payroll-open-profile" onClick={(event) => { event.stopPropagation(); openProfile(employee); }}>Open Payroll Profile</button>
        </article>)}
      </section>
      {!currentEmployeeCards.length && <section className="panel"><EmptyState icon="◎" title="No employees found" text="Change the filters or add employees through Employee Management." /></section>}
    </>}

    {view === 'profile' && selectedEmployee && <>
      <button className="payroll-back-button" onClick={() => setView('employees')}>← Employee List</button>
      <section className="panel payroll-profile-header">
        <div className="payroll-profile-avatar">{(selectedEmployee.name || '?').slice(0, 1).toUpperCase()}</div>
        <div className="payroll-profile-main">
          <p className="eyebrow">EMPLOYEE PAYROLL PROFILE</p>
          <h2>{selectedEmployee.name}</h2>
          <p>{selectedEmployee.employeeNumber || 'No ID'} · {selectedEmployee.designation || 'No designation'} · {selectedEmployee.workLocation || 'No location'}</p>
          <div className="payroll-profile-tags"><span>{payrollTypeLabel(selectedEmployee.payrollType)}</span><span>{selectedEmployee.status || 'ACTIVE'}</span><span>Joined {dateText(selectedEmployee.joiningDate)}</span></div>
        </div>
        <div className="payroll-profile-rate">
          <small>{selectedEmployee.payrollType === PAYROLL_TYPES.DAILY ? 'Hourly rate' : 'Fixed monthly salary'}</small>
          <strong>{currency(selectedEmployee.payrollType === PAYROLL_TYPES.DAILY ? selectedEmployee.hourlyRate : (selectedEmployee.fixedMonthlySalary ?? selectedEmployee.basicSalary), settings.currency || 'MVR')}</strong>
          {canManage && selectedEmployee.status === 'ACTIVE' && <button className="button button-ghost" onClick={() => openFinal(selectedEmployee)}>Process Final Salary</button>}
        </div>
      </section>

      <section className="payroll-profile-toolbar panel">
        <label><span>Find month or slip</span><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="July 2026 or PAY-…" /></label>
        <label><span>Salary slip status</span><select value={slipStatusFilter} onChange={(event) => setSlipStatusFilter(event.target.value)}><option value="ALL">All months</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="PAID">Paid</option></select></label>
        <p>Click a month to choose Edit Payroll or Salary Slip.</p>
      </section>

      <div className="payroll-year-groups">
        {Object.entries(monthsByYear).sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => {
          const filteredMonths = months.filter((month) => {
            const summary = buildMonthSummary(selectedEmployee, month);
            const slip = slipForEmployeeMonth(selectedEmployee.id, month);
            const effective = slip?.status || summary.status;
            const historyText = `${month} ${salaryMonthLabel(month)} ${slip?.salarySlipNumber || summary.salarySlipNumber || ''}`.toLowerCase();
            return (slipStatusFilter === 'ALL' || effective === slipStatusFilter)
              && historyText.includes(historySearch.toLowerCase());
          });
          if (!filteredMonths.length) return null;
          return <details className="panel payroll-year-section" open key={year}>
            <summary><strong>{year}</strong><span>{filteredMonths.length} month{filteredMonths.length === 1 ? '' : 's'}</span></summary>
            <div className="payroll-month-list">{filteredMonths.map((month) => {
              const summary = buildMonthSummary(selectedEmployee, month);
              const slip = slipForEmployeeMonth(selectedEmployee.id, month);
              const displayStatus = summary.periodStatus === 'CLOSED' ? 'CLOSED' : (slip?.status === 'PAID' ? 'PAID' : summary.status);
              return <button className="payroll-month-row" key={month} onClick={() => openMonthMenu(month)}>
                <div><strong>{salaryMonthLabel(month)}</strong><small>{summary.totalWorkingDays || 0} working days · {safeNumber(summary.totalHoursWorked).toFixed(2)} hours</small></div>
                <div className="payroll-month-attendance"><span>OT {safeNumber(summary.totalOvertimeHours).toFixed(2)}h</span><span>Missed {safeNumber(summary.totalMissedHours).toFixed(2)}h</span></div>
                <div className="payroll-month-value"><strong>{currency(summary.netSalary, settings.currency || 'MVR')}</strong><span className={`status status-${payrollStatusTone(displayStatus)}`}>{displayStatus.replaceAll('_', ' ')}</span></div>
                <span className="payroll-month-chevron">›</span>
              </button>;
            })}</div>
          </details>;
        })}
      </div>
    </>}

    {view === 'settlements' && <>
      <div className="page-actions"><div><button className="payroll-back-button" onClick={() => setView('employees')}>← Employee Payroll</button><p className="eyebrow">FINAL SALARY</p><h2>Final settlements</h2></div>{canManage && <button className="button button-primary" onClick={() => openFinal(null)}>＋ Process Final Salary</button>}</div>
      <section className="final-settlement-card-list">{finalSettlements.map((record) => <article className="panel final-settlement-card" key={record.id}><div><small>{record.salarySlipNumber}</small><h3>{record.employeeName}</h3><p>Last working date: {dateText(record.lastWorkingDate)}</p></div><strong>{currency(record.finalNetAmount || record.netSalary, settings.currency || 'MVR')}</strong><span className={`status status-${payrollStatusTone(record.status || record.settlementStatus)}`}>{record.status || record.settlementStatus}</span><div className="row-actions"><button onClick={async () => previewBlob(await createSalarySlipPdf(record, settings))}>View / Print</button><button onClick={async () => downloadBlob(await createSalarySlipPdf(record, settings), `${record.salarySlipNumber}.pdf`)}>PDF</button></div></article>)}</section>
      {!finalSettlements.length && <section className="panel"><EmptyState icon="✓" title="No final settlements" text="Final settlement history will appear here." /></section>}
    </>}

    <Modal open={monthMenuOpen} title={selectedEmployee ? `${salaryMonthLabel(selectedMonth)} · ${selectedEmployee.name}` : 'Payroll month'} onClose={() => setMonthMenuOpen(false)}>
      {selectedSummary && <div className="payroll-month-action-sheet">
        <div className="payroll-action-net"><small>Calculated monthly salary</small><strong>{currency(selectedSummary.netSalary, settings.currency || 'MVR')}</strong><span className={`status status-${payrollStatusTone(selectedSummary.periodStatus === 'CLOSED' ? 'CLOSED' : selectedSummary.status)}`}>{selectedSummary.periodStatus === 'CLOSED' ? 'CLOSED' : selectedSummary.status.replaceAll('_', ' ')}</span></div>
        <div className="payroll-action-summary-grid"><div><span>Working days</span><b>{selectedSummary.totalWorkingDays || 0}</b></div><div><span>Total hours</span><b>{safeNumber(selectedSummary.totalHoursWorked).toFixed(2)}</b></div><div><span>Overtime</span><b>{safeNumber(selectedSummary.totalOvertimeHours).toFixed(2)}</b></div><div><span>Missed</span><b>{safeNumber(selectedSummary.totalMissedHours).toFixed(2)}</b></div></div>
        {selectedSummary.missingAttendanceCount > 0 && <div className="alert alert-error">{selectedSummary.missingAttendanceCount} attendance date(s) are missing for this employee.</div>}
        <div className="payroll-month-main-actions">
          <button className="payroll-big-action" disabled={!canManage || selectedLocked || ['APPROVED', 'PAID', 'CLOSED'].includes(selectedSummary.status)} onClick={openEdit}><span>✎</span><div><strong>Edit Payroll</strong><small>Paid/unpaid days, leave and adjustments</small></div></button>
          <button className="payroll-big-action" onClick={openSalarySlip}><span>▣</span><div><strong>Salary Slip</strong><small>Edit, preview, print and issue</small></div></button>
        </div>
        {canManage && <div className="row-actions payroll-month-admin-actions">
          {selectedPeriodStatus === 'OPEN' && <button onClick={() => approveMonth(selectedMonth)}>Approve month</button>}
          {['APPROVED', 'CLOSED'].includes(selectedPeriodStatus) && <button onClick={() => reopenMonth(selectedMonth)}>Reopen month</button>}
          {selectedSummary.status === 'APPROVED' && <button onClick={openPayment}>Mark paid</button>}
          {selectedPeriodStatus === 'APPROVED' && <button onClick={() => closeMonth(selectedMonth)}>Close month</button>}
        </div>}
      </div>}
    </Modal>

    <Modal open={editOpen} title={`Edit Payroll · ${salaryMonthLabel(selectedMonth)}`} onClose={() => setEditOpen(false)}>
      {selectedEmployee && editedTotals && <div className="simple-payroll-editor">
        <section className="payroll-editor-employee"><div><strong>{selectedEmployee.name}</strong><small>{selectedEmployee.employeeNumber} · {payrollTypeLabel(selectedEmployee.payrollType)}</small></div><button className="button button-ghost" onClick={resetEditFromAttendance}>Reset from attendance</button></section>
        <details open className="payroll-editor-section"><summary>Attendance and paid days</summary><div className="form-grid">
          <label><span>Paid days</span><input type="number" min="0" step="0.5" value={editForm.paidDays} onChange={(event) => setEditForm({ ...editForm, paidDays: event.target.value })} /></label>
          <label><span>Unpaid days</span><input type="number" min="0" step="0.5" value={editForm.unpaidDays} onChange={(event) => setEditForm({ ...editForm, unpaidDays: event.target.value })} /></label>
          <label><span>Paid leave days</span><input type="number" min="0" step="0.5" value={editForm.paidLeaveDays} onChange={(event) => setEditForm({ ...editForm, paidLeaveDays: event.target.value })} /></label>
          <label><span>Unpaid leave days</span><input type="number" min="0" step="0.5" value={editForm.unpaidLeaveDays} onChange={(event) => setEditForm({ ...editForm, unpaidLeaveDays: event.target.value })} /></label>
        </div><div className="attendance-auto-reference"><span>From attendance:</span><b>{editedTotals.automaticPaidDays} paid</b><b>{editedTotals.automaticUnpaidDays} unpaid</b><b>{editedTotals.automaticPaidLeaveDays} paid leave</b><b>{editedTotals.automaticUnpaidLeaveDays} unpaid leave</b></div></details>
        <details open className="payroll-editor-section"><summary>Additions and deductions</summary><div className="form-grid">
          <label><span>Other additions</span><input type="number" min="0" step="0.01" value={editForm.otherAdditions} onChange={(event) => setEditForm({ ...editForm, otherAdditions: event.target.value })} /></label>
          <label><span>Other deductions</span><input type="number" min="0" step="0.01" value={editForm.otherDeductions} onChange={(event) => setEditForm({ ...editForm, otherDeductions: event.target.value })} /></label>
          <label className="form-span-2"><span>Manager explanation</span><textarea rows="4" value={editForm.adjustmentNotes} onChange={(event) => setEditForm({ ...editForm, adjustmentNotes: event.target.value })} placeholder="Reason for paid leave, unpaid days or custom adjustment…" /></label>
        </div></details>
        <section className="payroll-live-calculation">
          <div><span>{selectedEmployee.payrollType === PAYROLL_TYPES.DAILY ? 'Hourly earnings' : 'Fixed salary'}</span><strong>{currency(selectedEmployee.payrollType === PAYROLL_TYPES.DAILY ? editedTotals.hourlyEarnings : editedTotals.fixedSalary, settings.currency || 'MVR')}</strong></div>
          <div><span>Overtime pay</span><strong>{currency(editedTotals.overtimePay, settings.currency || 'MVR')}</strong></div>
          <div><span>Additions</span><strong>{currency(safeNumber(editedTotals.otherAdditions) + safeNumber(editedTotals.paidDayAdjustment), settings.currency || 'MVR')}</strong></div>
          <div><span>Missed-duty deduction</span><strong>− {currency(editedTotals.missedDutyDeduction, settings.currency || 'MVR')}</strong></div>
          <div><span>Other/unpaid deductions</span><strong>− {currency(safeNumber(editedTotals.otherDeductions) + safeNumber(editedTotals.unpaidDayDeduction), settings.currency || 'MVR')}</strong></div>
          <div className="payroll-editor-net"><span>NET SALARY</span><strong>{currency(editedTotals.netSalary, settings.currency || 'MVR')}</strong></div>
        </section>
        <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditOpen(false)}>Cancel</button><button className="button button-primary" onClick={saveEdit}>Save Draft</button></footer>
      </div>}
    </Modal>

    <Modal open={slipOpen} title={`Salary Slip · ${salaryMonthLabel(selectedMonth)}`} onClose={() => setSlipOpen(false)}>
      {slipForm && <div className="salary-slip-editor">
        <div className="salary-slip-editor-status"><div><small>Calculated payroll</small><strong>{currency(slipForm.calculatedPayrollAmount, settings.currency || 'MVR')}</strong></div><div><small>Salary slip total</small><strong>{currency(slipForm.issuedSalaryAmount, settings.currency || 'MVR')}</strong></div><span className={`salary-difference ${Math.abs(slipForm.difference) > 0.009 ? 'changed' : ''}`}>{slipForm.difference >= 0 ? '+' : '−'} {currency(Math.abs(slipForm.difference), settings.currency || 'MVR')}</span></div>
        {!slipEditable && <div className="alert alert-info">This salary slip is read-only. Paid slips and slips inside closed payroll months cannot be changed.</div>}
        <details open className="payroll-editor-section"><summary>Employee and slip details</summary><div className="form-grid">
          <label><span>Salary slip number</span><input disabled={!slipEditable} value={slipForm.salarySlipNumber} onChange={(event) => updateSlip({ salarySlipNumber: event.target.value })} /></label>
          <label><span>Salary month</span><input type="month" disabled value={slipForm.salaryMonth} /></label>
          <label><span>Employee name</span><input disabled={!slipEditable} value={slipForm.employeeName} onChange={(event) => updateSlip({ employeeName: event.target.value })} /></label>
          <label><span>Employee ID</span><input disabled={!slipEditable} value={slipForm.employeeNumber} onChange={(event) => updateSlip({ employeeNumber: event.target.value })} /></label>
          <label><span>Job title</span><input disabled={!slipEditable} value={slipForm.designation} onChange={(event) => updateSlip({ designation: event.target.value })} /></label>
          <label><span>Work location</span><input disabled={!slipEditable} value={slipForm.workLocation} onChange={(event) => updateSlip({ workLocation: event.target.value })} /></label>
        </div></details>
        <details open className="payroll-editor-section"><summary>Attendance summary</summary><div className="form-grid payroll-slip-number-grid">
          {[
            ['totalWorkingDays', 'Working days'], ['paidDays', 'Paid days'], ['unpaidDays', 'Unpaid days'], ['paidLeaveDays', 'Paid leave'], ['unpaidLeaveDays', 'Unpaid leave'], ['totalHoursWorked', 'Total hours'], ['totalOvertimeHours', 'Overtime hours'], ['totalMissedHours', 'Missed hours'],
          ].map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm[key]} onChange={(event) => updateSlip({ [key]: event.target.value })} /></label>)}
        </div></details>
        <details open className="payroll-editor-section"><summary>Earnings</summary><div className="form-grid">
          {slipForm.payrollType === PAYROLL_TYPES.DAILY
            ? <label><span>Hourly earnings</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.hourlyEarnings} onChange={(event) => updateSlip({ hourlyEarnings: event.target.value })} /></label>
            : <label><span>Fixed salary</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.fixedSalary} onChange={(event) => updateSlip({ fixedSalary: event.target.value })} /></label>}
          <label><span>Overtime pay</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.overtimePay} onChange={(event) => updateSlip({ overtimePay: event.target.value })} /></label>
          <label><span>Other additions</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.otherAdditions} onChange={(event) => updateSlip({ otherAdditions: event.target.value })} /></label>
          <label><span>Custom addition</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.customAddition} onChange={(event) => updateSlip({ customAddition: event.target.value })} /></label>
        </div></details>
        <details open className="payroll-editor-section"><summary>Deductions</summary><div className="form-grid">
          <label><span>Missed-duty deduction</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.missedDutyDeduction} onChange={(event) => updateSlip({ missedDutyDeduction: event.target.value })} /></label>
          <label><span>Other deductions</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.otherDeductions} onChange={(event) => updateSlip({ otherDeductions: event.target.value })} /></label>
          <label><span>Custom deduction</span><input type="number" min="0" step="0.01" disabled={!slipEditable} value={slipForm.customDeduction} onChange={(event) => updateSlip({ customDeduction: event.target.value })} /></label>
          <label><span>Payment method</span><select disabled={!slipEditable} value={slipForm.paymentMethod} onChange={(event) => updateSlip({ paymentMethod: event.target.value })}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
          <label className="form-span-2"><span>Reason for salary-slip difference</span><textarea rows="3" disabled={!slipEditable} value={slipForm.adjustmentReason} onChange={(event) => updateSlip({ adjustmentReason: event.target.value })} placeholder="Required when the issued total differs from payroll…" /></label>
        </div></details>
        <details className="payroll-editor-section"><summary>Approval and notes</summary><div className="form-grid">
          <label><span>Manager approval</span><input disabled={!slipEditable} value={slipForm.managerApproval} onChange={(event) => updateSlip({ managerApproval: event.target.value })} /></label>
          <label><span>Employee acknowledgement</span><input disabled={!slipEditable} value={slipForm.employeeAcknowledgement} onChange={(event) => updateSlip({ employeeAcknowledgement: event.target.value })} /></label>
          <label className="form-span-2"><span>Remarks</span><textarea rows="3" disabled={!slipEditable} value={slipForm.notes} onChange={(event) => updateSlip({ notes: event.target.value })} /></label>
        </div></details>
        <div className="salary-slip-fixed-total"><span>NET SALARY</span><strong>{currency(slipForm.issuedSalaryAmount, settings.currency || 'MVR')}</strong></div>
        <div className="salary-slip-action-grid">
          {slipEditable && <button className="button button-secondary" onClick={() => saveSlip('DRAFT')}>Save Draft</button>}
          {slipEditable && <button className="button button-primary" onClick={() => saveSlip('APPROVED')}>Approve Slip</button>}
          <button className="button button-secondary" onClick={previewSlip}>View / Print</button>
          <button className="button button-secondary" onClick={downloadSlip}>Download PDF</button>
          {canManage && <button className="button button-secondary" disabled={uploadingId === (slipForm.id || 'new')} onClick={uploadSlip}>{slipForm.driveFileId ? 'Replace Drive' : 'Google Drive'}</button>}
          {slipForm.driveWebViewLink && <a className="button button-ghost" href={slipForm.driveWebViewLink} target="_blank" rel="noreferrer">Open Drive</a>}
          {canManage && !slipEditable && selectedPeriodStatus === 'OPEN' && slipForm.id && <button className="button button-secondary" onClick={reopenSlip}>Reopen Slip</button>}
          {canManage && ['APPROVED', 'PAID'].includes(selectedSummary?.status) && slipForm.paymentStatus !== 'PAID' && <button className="button button-primary" onClick={openPayment}>Mark Paid</button>}
        </div>
      </div>}
    </Modal>

    <Modal open={paymentOpen} title="Mark Salary as Paid" onClose={() => setPaymentOpen(false)}>
      <div className="form-grid">
        <label><span>Payment date</span><input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></label>
        <label><span>Payment method</span><select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
        <label className="form-span-2"><span>Bank / payment reference</span><input value={paymentForm.paymentReference} onChange={(event) => setPaymentForm({ ...paymentForm, paymentReference: event.target.value })} /></label>
        <label className="form-span-2"><span>Payment notes</span><textarea rows="3" value={paymentForm.paymentNotes} onChange={(event) => setPaymentForm({ ...paymentForm, paymentNotes: event.target.value })} /></label>
      </div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setPaymentOpen(false)}>Cancel</button><button className="button button-primary" onClick={savePayment}>Confirm Payment</button></footer>
    </Modal>

    <Modal open={finalOpen} title="Process Final Salary" onClose={() => setFinalOpen(false)}>
      <div className="form-grid">
        <label className="form-span-2"><span>Employee</span><select value={finalForm.employeeId} onChange={(event) => setFinalForm(blankFinalSettlement(settings, employees.find((row) => row.id === event.target.value)))}><option value="">Select active employee</option>{employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.name}</option>)}</select></label>
        <label><span>Last working date</span><input type="date" value={finalForm.lastWorkingDate} onChange={(event) => setFinalForm({ ...finalForm, lastWorkingDate: event.target.value })} /></label>
        <label><span>Proration method</span><select value={finalForm.prorationMethod} onChange={(event) => setFinalForm({ ...finalForm, prorationMethod: event.target.value })}><option value="HOURS">Eligible hours</option><option value="DAYS">Eligible days</option></select></label>
        <label className="form-span-2"><span>Reason for leaving</span><input value={finalForm.reasonForLeaving} onChange={(event) => setFinalForm({ ...finalForm, reasonForLeaving: event.target.value })} /></label>
        <label><span>Other additions</span><input type="number" min="0" step="0.01" value={finalForm.otherAdditions} onChange={(event) => setFinalForm({ ...finalForm, otherAdditions: event.target.value })} /></label>
        <label><span>Other deductions</span><input type="number" min="0" step="0.01" value={finalForm.otherDeductions} onChange={(event) => setFinalForm({ ...finalForm, otherDeductions: event.target.value })} /></label>
        <label><span>Settlement status</span><select value={finalForm.settlementStatus} onChange={(event) => setFinalForm({ ...finalForm, settlementStatus: event.target.value })}><option>APPROVED</option><option>PAID</option></select></label>
        <label><span>Payment date</span><input type="date" value={finalForm.paymentDate} onChange={(event) => setFinalForm({ ...finalForm, paymentDate: event.target.value })} /></label>
        <label><span>Payment method</span><select value={finalForm.paymentMethod} onChange={(event) => setFinalForm({ ...finalForm, paymentMethod: event.target.value })}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option></select></label>
        <label><span>Salary slip number</span><input value={finalForm.salarySlipNumber} onChange={(event) => setFinalForm({ ...finalForm, salarySlipNumber: event.target.value })} /></label>
        <label className="form-span-2"><span>Notes</span><textarea rows="3" value={finalForm.notes} onChange={(event) => setFinalForm({ ...finalForm, notes: event.target.value })} /></label>
      </div>
      {finalEmployee && finalTotals && <div className="payroll-live-calculation"><div><span>Actual hours</span><strong>{safeNumber(finalTotals.totalHoursWorked).toFixed(2)}</strong></div><div><span>Prorated basic</span><strong>{currency(finalTotals.proratedBasicSalary, settings.currency || 'MVR')}</strong></div><div><span>Overtime pay</span><strong>{currency(finalTotals.overtimePay, settings.currency || 'MVR')}</strong></div><div><span>Deductions</span><strong>− {currency(finalTotals.totalDeductions, settings.currency || 'MVR')}</strong></div><div className="payroll-editor-net"><span>FINAL NET</span><strong>{currency(finalTotals.finalNetAmount, settings.currency || 'MVR')}</strong></div></div>}
      {finalMissing.length > 0 && <div className="alert alert-error">{finalMissing.length} attendance date(s) are missing before the last working date.</div>}
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setFinalOpen(false)}>Cancel</button><button className="button button-primary" onClick={saveFinalSettlement}>Approve Final Settlement</button></footer>
    </Modal>
  </>;
}
