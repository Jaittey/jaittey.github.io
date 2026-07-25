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
