export const currency = (value, code = 'MVR') =>
  `${code} ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const dateText = (value) => {
  if (!value) return '—';
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = value?.toDate ? value.toDate() : new Date(normalized);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
};

export const inputDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

export const makeNumber = (prefix) => {
  const now = new Date();
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
};

export const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const groupMonthly = (invoices, expenses) => {
  const months = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: date.toLocaleString('en', { month: 'short' }), sales: 0, expenses: 0 });
  }
  const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
  invoices.forEach((item) => {
    const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || 0);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (byKey[key]) byKey[key].sales += Number(item.total || 0);
  });
  expenses.forEach((item) => {
    const date = new Date(item.date || 0);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (byKey[key]) byKey[key].expenses += Number(item.amount || 0);
  });
  return months;
};


export const calculateDocumentTotals = (items = [], discountRate = 0, gstRate = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + safeNumber(item.quantity) * safeNumber(item.price),
    0,
  );
  const safeDiscountRate = Math.min(100, Math.max(0, safeNumber(discountRate)));
  const safeGstRate = Math.min(100, Math.max(0, safeNumber(gstRate)));
  const discountAmount = subtotal * (safeDiscountRate / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = taxableAmount * (safeGstRate / 100);
  const total = taxableAmount + gstAmount;

  return {
    subtotal,
    discountRate: safeDiscountRate,
    discountAmount,
    taxableAmount,
    gstRate: safeGstRate,
    gstAmount,
    total,
  };
};

export const monthKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(date);
};


export const calculatePayrollTotals = (data = {}) => {
  const basicSalary = safeNumber(data.basicSalary);
  const overtimeHours = Math.max(0, safeNumber(data.overtimeHours));
  const overtimeRate = Math.max(0, safeNumber(data.overtimeRate));
  const overtimeAmount = overtimeHours * overtimeRate;
  const allowances = Math.max(0, safeNumber(data.allowances));
  const bonus = Math.max(0, safeNumber(data.bonus));
  const otherEarnings = Math.max(0, safeNumber(data.otherEarnings));
  const grossSalary = basicSalary + overtimeAmount + allowances + bonus + otherEarnings;

  const lateDeduction = Math.max(0, safeNumber(data.lateDeduction));
  const absentDeduction = Math.max(0, safeNumber(data.absentDeduction));
  const loanDeduction = Math.max(0, safeNumber(data.loanDeduction));
  const advanceDeduction = Math.max(0, safeNumber(data.advanceDeduction));
  const otherDeductions = Math.max(0, safeNumber(data.otherDeductions));
  const totalDeductions = lateDeduction + absentDeduction + loanDeduction + advanceDeduction + otherDeductions;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    basicSalary,
    overtimeHours,
    overtimeRate,
    overtimeAmount,
    allowances,
    bonus,
    otherEarnings,
    grossSalary,
    lateDeduction,
    absentDeduction,
    loanDeduction,
    advanceDeduction,
    otherDeductions,
    totalDeductions,
    netSalary,
  };
};

export const salaryMonthLabel = (value) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return '—';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
};

export const currentSalaryMonth = () => new Date().toISOString().slice(0, 7);

export const budgetPeriodLabel = (year, month = '') => {
  if (!month) return `Annual ${year}`;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
    .format(new Date(Number(year), Number(month) - 1, 1));
};
