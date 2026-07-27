import { safeNumber } from './format.js';

export const PAYROLL_TYPES = {
  MONTHLY: 'MONTHLY',
  DAILY: 'DAILY',
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
  const scheduledHours = Math.max(0, safeNumber(draft.scheduledHours ?? employee.standardDailyHours));
  const actualHours = Math.max(0, safeNumber(draft.actualHours));
  const leaveDeductible = Boolean(draft.leaveDeductible);

  let overtimeHours = 0;
  let missedHours = 0;

  if (status === 'OFF_DAY') {
    overtimeHours = payrollType === PAYROLL_TYPES.MONTHLY ? actualHours : Math.max(0, actualHours - scheduledHours);
  } else if (status === 'LEAVE' && !leaveDeductible) {
    overtimeHours = Math.max(0, actualHours - scheduledHours);
  } else {
    overtimeHours = Math.max(0, actualHours - scheduledHours);
    missedHours = Math.max(0, scheduledHours - actualHours);
  }

  return {
    ...draft,
    payrollType,
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
