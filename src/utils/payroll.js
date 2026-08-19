import { safeNumber } from './format.js';

export const PAYROLL_TYPES = {
  MONTHLY: 'MONTHLY',
  DAILY: 'DAILY',
};



export const DEFAULT_ATTENDANCE_SHIFTS = [
  { id: 'morning', name: 'Morning', startTime: '08:00', endTime: '16:00', isDefault: true, active: true },
  { id: 'evening', name: 'Evening', startTime: '16:00', endTime: '00:00', isDefault: false, active: true },
  { id: 'night', name: 'Night', startTime: '00:00', endTime: '08:00', isDefault: false, active: true },
];

export const normalizeTime24 = (value = '') => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const timeRangeHours = (startTime = '', endTime = '') => {
  const normalizedStart = normalizeTime24(startTime);
  const normalizedEnd = normalizeTime24(endTime);
  if (!normalizedStart || !normalizedEnd) return 0;
  const [startHour, startMinute] = normalizedStart.split(':').map(Number);
  const [endHour, endMinute] = normalizedEnd.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end === start) return 0;
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
};

export const addHoursToTime = (startTime = '', hours = 0) => {
  const normalized = normalizeTime24(startTime);
  if (!normalized) return '';
  const [hour, minute] = normalized.split(':').map(Number);
  const totalMinutes = Math.round(hour * 60 + minute + Math.max(0, safeNumber(hours)) * 60);
  const wrapped = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

export const timeRangeLabel24 = (startTime = '', endTime = '') => {
  const start = normalizeTime24(startTime);
  const end = normalizeTime24(endTime);
  return start && end ? `${start} – ${end}` : '—';
};

export const normalizeAttendanceShifts = (settings = {}) => {
  const source = Array.isArray(settings.shifts) && settings.shifts.length
    ? settings.shifts
    : DEFAULT_ATTENDANCE_SHIFTS;
  const normalized = source
    .filter((shift) => shift && shift.id && shift.name)
    .map((shift) => ({
      id: String(shift.id),
      name: String(shift.name),
      startTime: shift.startTime || '08:00',
      endTime: shift.endTime || '16:00',
      isDefault: Boolean(shift.isDefault),
      active: shift.active !== false,
    }));
  if (!normalized.some((shift) => shift.isDefault)) {
    const firstActive = normalized.find((shift) => shift.active) || normalized[0];
    if (firstActive) firstActive.isDefault = true;
  }
  return normalized;
};

export const defaultAttendanceShift = (settings = {}) => (
  normalizeAttendanceShifts(settings).find((shift) => shift.isDefault && shift.active)
  || normalizeAttendanceShifts(settings).find((shift) => shift.active)
  || DEFAULT_ATTENDANCE_SHIFTS[0]
);

export const attendanceFromShift = (employee, date, shift, overrides = {}) => {
  const selectedShift = shift || DEFAULT_ATTENDANCE_SHIFTS[0];
  const scheduledStart = normalizeTime24(selectedShift.startTime || overrides.scheduledStart);
  const scheduledEnd = normalizeTime24(selectedShift.endTime || overrides.scheduledEnd);
  const scheduledHours = timeRangeHours(scheduledStart, scheduledEnd)
    || Math.max(0, safeNumber(employee?.standardDailyHours || 8));
  const status = overrides.status || 'PRESENT';

  let actualStart = normalizeTime24(overrides.actualStart);
  let actualEnd = normalizeTime24(overrides.actualEnd);
  let actualHours = overrides.actualHours;

  if (!actualStart && !actualEnd && !['ABSENT', 'OFF_DAY', 'LEAVE'].includes(status)) {
    actualStart = scheduledStart;
    const defaultWorkedHours = actualHours === undefined || actualHours === null || actualHours === ''
      ? (status === 'HALF_DAY' ? scheduledHours / 2 : status === 'EXTRA_DUTY' ? scheduledHours * 1.5 : scheduledHours)
      : Math.max(0, safeNumber(actualHours));
    actualEnd = addHoursToTime(actualStart, defaultWorkedHours);
  }

  if (actualStart && actualEnd) {
    actualHours = timeRangeHours(actualStart, actualEnd);
  } else if (actualHours === undefined || actualHours === null || actualHours === '') {
    actualHours = ['ABSENT', 'OFF_DAY', 'LEAVE'].includes(status) ? 0 : scheduledHours;
  }

  return deriveAttendance({
    employeeId: employee?.id || '',
    employeeNumber: employee?.employeeNumber || '',
    employeeName: employee?.name || '',
    designation: employee?.designation || '',
    workLocation: employee?.workLocation || employee?.contract || '',
    payrollType: employee?.payrollType || PAYROLL_TYPES.MONTHLY,
    date,
    attendanceMonth: dateMonthKey(date),
    leaveDeductible: false,
    notes: '',
    ...overrides,
    status,
    actualStart,
    actualEnd,
    actualHours,
    shiftId: selectedShift.id || 'custom',
    shiftName: selectedShift.name || 'Custom',
    scheduledStart,
    scheduledEnd,
    scheduledHours,
  }, employee || {});
};

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'OFF_DAY',
  'LEAVE',
  'HALF_DAY',
  'EXTRA_DUTY',
];

export const PERIOD_STATUSES = ['OPEN', 'APPROVED', 'CLOSED'];

export const attendanceStatusLabel = (value) => ({
  PRESENT: 'Present',
  ABSENT: 'Absent',
  OFF_DAY: 'Off Day',
  LEAVE: 'Leave',
  HALF_DAY: 'Half Day',
  EXTRA_DUTY: 'Extra Duty',
}[value] || value || 'Present');

export const payrollTypeLabel = (value) => (
  value === PAYROLL_TYPES.DAILY ? 'Daily-Based Salary' : 'Monthly-Based Salary'
);

export const dateMonthKey = (date = '') => String(date).slice(0, 7);

export const monthBounds = (month) => {
  const [year, number] = String(month).split('-').map(Number);
  const start = new Date(year, number - 1, 1);
  const end = new Date(year, number, 0);
  return { start, end };
};

const localDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const eligibleAttendanceDates = (employee, month, throughDate = null) => {
  if (!month) return [];
  const { start, end } = monthBounds(month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = throughDate ? new Date(`${throughDate}T00:00:00`) : (end < today ? end : today);
  const joining = employee?.joiningDate ? new Date(`${employee.joiningDate}T00:00:00`) : start;
  const leaving = employee?.lastWorkingDate ? new Date(`${employee.lastWorkingDate}T00:00:00`) : end;
  const first = joining > start ? joining : start;
  const last = [end, limit, leaving].reduce((earliest, value) => value < earliest ? value : earliest, end);
  if (first > last) return [];
  const dates = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    dates.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const deriveAttendance = (draft, employee = {}) => {
  const payrollType = draft.payrollType || employee.payrollType || PAYROLL_TYPES.MONTHLY;
  const status = draft.status || 'PRESENT';
  const scheduledStart = normalizeTime24(draft.scheduledStart);
  const scheduledEnd = normalizeTime24(draft.scheduledEnd);
  let actualStart = normalizeTime24(draft.actualStart);
  let actualEnd = normalizeTime24(draft.actualEnd);
  const scheduledHours = Math.max(0, timeRangeHours(scheduledStart, scheduledEnd)
    || safeNumber(draft.scheduledHours ?? employee.standardDailyHours));
  const storedActualHours = Math.max(0, safeNumber(draft.actualHours));
  // Older attendance records stored only a duration. Display them in 24-hour format
  // by deriving a check-out time from the scheduled start until the record is edited.
  if (!actualStart && !actualEnd && storedActualHours > 0 && scheduledStart) {
    actualStart = scheduledStart;
    actualEnd = addHoursToTime(scheduledStart, storedActualHours);
  }

  let actualHours = actualStart && actualEnd
    ? timeRangeHours(actualStart, actualEnd)
    : storedActualHours;
  if (status === 'ABSENT') actualHours = 0;
  if (status === 'LEAVE' && !actualStart && !actualEnd) actualHours = 0;
  if (status === 'OFF_DAY' && !actualStart && !actualEnd) actualHours = 0;

  const leaveDeductible = Boolean(draft.leaveDeductible);
  let overtimeHours = 0;
  let missedHours = 0;

  // Off days and approved leave never create missed-duty deductions.
  // Any hours actually worked on those protected days are counted as extra hours.
  if (status === 'OFF_DAY' || (status === 'LEAVE' && !leaveDeductible)) {
    overtimeHours = actualHours;
    missedHours = 0;
  } else {
    overtimeHours = Math.max(0, actualHours - scheduledHours);
    missedHours = Math.max(0, scheduledHours - actualHours);
  }

  return {
    ...draft,
    payrollType,
    scheduledStart,
    scheduledEnd,
    actualStart,
    actualEnd,
    scheduledHours,
    actualHours,
    overtimeHours,
    missedHours,
  };
};

export const defaultAttendanceForEmployee = (employee, date) => {
  const scheduledHours = Math.max(0, safeNumber(employee.standardDailyHours || 8));
  return deriveAttendance({
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber || '',
    employeeName: employee.name || '',
    designation: employee.designation || '',
    workLocation: employee.workLocation || employee.contract || '',
    payrollType: employee.payrollType || PAYROLL_TYPES.MONTHLY,
    date,
    attendanceMonth: dateMonthKey(date),
    scheduledStart: '08:00',
    scheduledEnd: addHoursToTime('08:00', scheduledHours),
    actualStart: '08:00',
    actualEnd: addHoursToTime('08:00', scheduledHours),
    scheduledHours,
    actualHours: scheduledHours,
    status: 'PRESENT',
    leaveDeductible: false,
    notes: '',
  }, employee);
};

export const summarizeAttendance = (records = [], employee = null) => {
  const rows = records.map((row) => deriveAttendance(row, employee || {}));
  return {
    totalRecords: rows.length,
    totalWorkingDays: rows.filter((row) => row.actualHours > 0).length,
    totalHoursWorked: rows.reduce((sum, row) => sum + row.actualHours, 0),
    totalOvertimeHours: rows.reduce((sum, row) => sum + row.overtimeHours, 0),
    totalMissedHours: rows.reduce((sum, row) => sum + row.missedHours, 0),
    totalOffDays: rows.filter((row) => row.status === 'OFF_DAY').length,
    totalAbsentDays: rows.filter((row) => row.status === 'ABSENT').length,
    totalLeaveDays: rows.filter((row) => row.status === 'LEAVE').length,
    totalHalfDays: rows.filter((row) => row.status === 'HALF_DAY').length,
  };
};

export const missingAttendanceDates = (employee, month, records = [], throughDate = null) => {
  const recorded = new Set(records.filter((row) => row.employeeId === employee.id).map((row) => row.date));
  return eligibleAttendanceDates(employee, month, throughDate).filter((date) => !recorded.has(date));
};

export const calculateAttendancePayroll = (employee, records = [], adjustments = {}) => {
  const payrollType = employee.payrollType || PAYROLL_TYPES.MONTHLY;
  const summary = summarizeAttendance(records, employee);
  const otherAdditions = Math.max(0, safeNumber(adjustments.otherAdditions));
  const otherDeductions = Math.max(0, safeNumber(adjustments.otherDeductions));

  const fixedSalary = payrollType === PAYROLL_TYPES.MONTHLY
    ? Math.max(0, safeNumber(employee.fixedMonthlySalary ?? employee.basicSalary))
    : 0;
  const hourlyRate = payrollType === PAYROLL_TYPES.DAILY
    ? Math.max(0, safeNumber(employee.hourlyRate))
    : 0;
  const overtimeRate = Math.max(0, safeNumber(employee.overtimeHourlyRate));
  const missedDutyRate = Math.max(0, safeNumber(employee.missedDutyDeductionRate ?? employee.hourlyDeductionRate));

  const hourlyEarnings = payrollType === PAYROLL_TYPES.DAILY
    ? summary.totalHoursWorked * hourlyRate
    : 0;
  const overtimePay = payrollType === PAYROLL_TYPES.MONTHLY
    ? summary.totalOvertimeHours * overtimeRate
    : 0;
  const missedDutyDeduction = payrollType === PAYROLL_TYPES.MONTHLY
    ? summary.totalMissedHours * missedDutyRate
    : 0;
  const baseEarnings = payrollType === PAYROLL_TYPES.MONTHLY ? fixedSalary : hourlyEarnings;
  const grossSalary = baseEarnings + overtimePay + otherAdditions;
  const totalDeductions = missedDutyDeduction + otherDeductions;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    payrollType,
    ...summary,
    fixedSalary,
    hourlyRate,
    hourlyEarnings,
    overtimeRate,
    overtimePay,
    missedDutyRate,
    missedDutyDeduction,
    otherAdditions,
    otherDeductions,
    grossSalary,
    totalDeductions,
    netSalary,
    // Compatibility fields used by older dashboard/report code.
    basicSalary: baseEarnings,
    overtimeHours: summary.totalOvertimeHours,
    overtimeAmount: overtimePay,
  };
};

export const calculateFinalSettlement = (employee, records = [], data = {}) => {
  const payrollType = employee.payrollType || PAYROLL_TYPES.MONTHLY;
  const summary = summarizeAttendance(records, employee);
  const otherAdditions = Math.max(0, safeNumber(data.otherAdditions));
  const otherDeductions = Math.max(0, safeNumber(data.otherDeductions));
  const overtimeRate = Math.max(0, safeNumber(employee.overtimeHourlyRate));
  const missedDutyRate = Math.max(0, safeNumber(employee.missedDutyDeductionRate ?? employee.hourlyDeductionRate));
  const overtimePay = payrollType === PAYROLL_TYPES.MONTHLY ? summary.totalOvertimeHours * overtimeRate : 0;
  const missedDutyDeduction = payrollType === PAYROLL_TYPES.MONTHLY ? summary.totalMissedHours * missedDutyRate : 0;

  let proratedBasicSalary = 0;
  let prorationUnits = 0;
  let standardUnits = 0;
  const prorationMethod = data.prorationMethod || 'HOURS';

  if (payrollType === PAYROLL_TYPES.DAILY) {
    prorationUnits = summary.totalHoursWorked;
    standardUnits = prorationUnits;
    proratedBasicSalary = summary.totalHoursWorked * Math.max(0, safeNumber(employee.hourlyRate));
  } else if (prorationMethod === 'DAYS') {
    standardUnits = Math.max(1, safeNumber(employee.standardWorkingDays || 26));
    prorationUnits = records.filter((row) => (
      safeNumber(row.actualHours) > 0
      || row.status === 'OFF_DAY'
      || (row.status === 'LEAVE' && !row.leaveDeductible)
    )).length;
    proratedBasicSalary = Math.max(0, safeNumber(employee.fixedMonthlySalary ?? employee.basicSalary))
      * Math.min(1, prorationUnits / standardUnits);
  } else {
    const dailyHours = Math.max(1, safeNumber(employee.standardDailyHours || 8));
    const workingDays = Math.max(1, safeNumber(employee.standardWorkingDays || 26));
    standardUnits = dailyHours * workingDays;
    const protectedHours = records.reduce((sum, row) => {
      if (row.status === 'OFF_DAY' || (row.status === 'LEAVE' && !row.leaveDeductible)) {
        return sum + safeNumber(row.scheduledHours);
      }
      return sum;
    }, 0);
    prorationUnits = Math.min(standardUnits, summary.totalHoursWorked + protectedHours);
    proratedBasicSalary = Math.max(0, safeNumber(employee.fixedMonthlySalary ?? employee.basicSalary))
      * Math.min(1, prorationUnits / standardUnits);
  }

  const grossSalary = proratedBasicSalary + overtimePay + otherAdditions;
  const totalDeductions = missedDutyDeduction + otherDeductions;
  const finalNetAmount = Math.max(0, grossSalary - totalDeductions);

  return {
    payrollType,
    ...summary,
    prorationMethod,
    prorationUnits,
    standardUnits,
    proratedBasicSalary,
    overtimeRate,
    overtimePay,
    missedDutyRate,
    missedDutyDeduction,
    otherAdditions,
    otherDeductions,
    grossSalary,
    totalDeductions,
    finalNetAmount,
    netSalary: finalNetAmount,
    basicSalary: proratedBasicSalary,
    overtimeHours: summary.totalOvertimeHours,
    overtimeAmount: overtimePay,
  };
};

export const attendancePayDaySummary = (records = [], employee = null) => {
  const rows = records.map((row) => deriveAttendance(row, employee || {}));
  const paidLeaveDays = rows.filter((row) => row.status === 'LEAVE' && !row.leaveDeductible).length;
  const unpaidLeaveDays = rows.filter((row) => row.status === 'LEAVE' && row.leaveDeductible).length;
  const unpaidDays = rows.filter((row) => row.status === 'ABSENT').length;
  const workedDays = rows.filter((row) => row.actualHours > 0).length;
  const offDays = rows.filter((row) => row.status === 'OFF_DAY').length;
  return {
    paidDays: workedDays + offDays + paidLeaveDays,
    unpaidDays,
    paidLeaveDays,
    unpaidLeaveDays,
  };
};

export const calculatePayrollWithDayAdjustments = (employee, records = [], adjustments = {}) => {
  const base = calculateAttendancePayroll(employee, records, adjustments);
  const automaticDays = attendancePayDaySummary(records, employee);
  const paidDays = adjustments.paidDays === undefined || adjustments.paidDays === null || adjustments.paidDays === ''
    ? automaticDays.paidDays
    : Math.max(0, safeNumber(adjustments.paidDays));
  const unpaidDays = adjustments.unpaidDays === undefined || adjustments.unpaidDays === null || adjustments.unpaidDays === ''
    ? automaticDays.unpaidDays
    : Math.max(0, safeNumber(adjustments.unpaidDays));
  const paidLeaveDays = adjustments.paidLeaveDays === undefined || adjustments.paidLeaveDays === null || adjustments.paidLeaveDays === ''
    ? automaticDays.paidLeaveDays
    : Math.max(0, safeNumber(adjustments.paidLeaveDays));
  const unpaidLeaveDays = adjustments.unpaidLeaveDays === undefined || adjustments.unpaidLeaveDays === null || adjustments.unpaidLeaveDays === ''
    ? automaticDays.unpaidLeaveDays
    : Math.max(0, safeNumber(adjustments.unpaidLeaveDays));

  const standardDailyHours = Math.max(0, safeNumber(employee?.standardDailyHours || 8));
  const missedDutyRate = Math.max(0, safeNumber(employee?.missedDutyDeductionRate ?? employee?.hourlyDeductionRate));
  const automaticUnpaidUnits = automaticDays.unpaidDays + automaticDays.unpaidLeaveDays;
  const adjustedUnpaidUnits = unpaidDays + unpaidLeaveDays;
  const dayRate = employee?.payrollType === PAYROLL_TYPES.DAILY
    ? 0
    : standardDailyHours * missedDutyRate;
  const dayClassificationAdjustment = (automaticUnpaidUnits - adjustedUnpaidUnits) * dayRate;
  const paidDayAdjustment = Math.max(0, dayClassificationAdjustment);
  const unpaidDayDeduction = Math.max(0, -dayClassificationAdjustment);

  const grossSalary = base.grossSalary + paidDayAdjustment;
  const totalDeductions = base.totalDeductions + unpaidDayDeduction;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    ...base,
    ...automaticDays,
    paidDays,
    unpaidDays,
    paidLeaveDays,
    unpaidLeaveDays,
    automaticPaidDays: automaticDays.paidDays,
    automaticUnpaidDays: automaticDays.unpaidDays,
    automaticPaidLeaveDays: automaticDays.paidLeaveDays,
    automaticUnpaidLeaveDays: automaticDays.unpaidLeaveDays,
    dayRate,
    paidDayAdjustment,
    unpaidDayDeduction,
    grossSalary,
    totalDeductions,
    netSalary,
  };
};

const monthKeyFromDate = (value) => String(value || '').slice(0, 7);

export const employeePayrollMonthKeys = (employee, attendance = [], payroll = [], salarySlips = []) => {
  const months = new Set();
  attendance.filter((row) => row.employeeId === employee?.id).forEach((row) => months.add(row.attendanceMonth || monthKeyFromDate(row.date)));
  payroll.filter((row) => row.employeeId === employee?.id && row.recordType !== 'FINAL_SETTLEMENT').forEach((row) => months.add(row.salaryMonth));
  salarySlips.filter((row) => row.employeeId === employee?.id).forEach((row) => months.add(row.salaryMonth));

  const startMonth = monthKeyFromDate(employee?.joiningDate) || [...months].sort()[0] || dateMonthKey(new Date().toISOString());
  const endMonth = monthKeyFromDate(employee?.lastWorkingDate) || dateMonthKey(new Date().toISOString());
  if (/^\d{4}-\d{2}$/.test(startMonth) && /^\d{4}-\d{2}$/.test(endMonth)) {
    let [year, month] = startMonth.split('-').map(Number);
    const [endYear, endNumber] = endMonth.split('-').map(Number);
    let guard = 0;
    while ((year < endYear || (year === endYear && month <= endNumber)) && guard < 240) {
      months.add(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
      guard += 1;
    }
  }

  return [...months].filter((value) => /^\d{4}-\d{2}$/.test(value)).sort().reverse();
};
