import { currency, safeNumber } from '../utils/format';

const downloadCsv = (name, rows) => {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

export default function Reports({ invoices, quotes, expenses, customers, employees, payroll, attendance = [], finalSettlements = [], products, settings }) {
  const revenue = invoices.filter((row) => row.status !== 'CANCELLED').reduce((sum, row) => sum + safeNumber(row.total), 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + safeNumber(row.amount), 0);
  const payrollTotal = payroll.filter((row) => row.status !== 'CANCELLED').reduce((sum, row) => sum + safeNumber(row.grossSalary), 0);
  const reports = [
    ['Revenue report', `${invoices.length} invoices · ${currency(revenue, settings.currency)}`, () => downloadCsv('df7-invoices', [['Invoice', 'Customer', 'Status', 'Total'], ...invoices.map((row) => [row.invoiceNumber, row.customerName, row.status, row.total])])],
    ['Expense report', `${expenses.length} expenses · ${currency(expenseTotal, settings.currency)}`, () => downloadCsv('df7-expenses', [['Date', 'Description', 'Category', 'Amount'], ...expenses.map((row) => [row.date, row.description, row.category, row.amount])])],
    ['Profit & loss', `Net: ${currency(revenue - expenseTotal - payrollTotal, settings.currency)}`, () => downloadCsv('df7-profit-loss', [['Revenue', 'Expenses', 'Payroll', 'Net'], [revenue, expenseTotal, payrollTotal, revenue - expenseTotal - payrollTotal]])],
    ['Quotation report', `${quotes.length} quotations`, () => downloadCsv('df7-quotations', [['Quotation', 'Customer', 'Status', 'Total'], ...quotes.map((row) => [row.quoteNumber, row.customerName, row.status, row.total])])],
    ['Customer report', `${customers.length} customers`, () => downloadCsv('df7-customers', [['Name', 'Organisation', 'Phone', 'Email'], ...customers.map((row) => [row.name, row.organisation, row.phone, row.email])])],
    ['Employee report', `${employees.length} employees`, () => downloadCsv('df7-employees', [['Employee ID', 'Name', 'Department', 'Designation', 'Status'], ...employees.map((row) => [row.employeeNumber, row.name, row.department, row.designation, row.status])])],
    ['Payroll report', `${payroll.length} salary records · ${currency(payrollTotal, settings.currency)}`, () => downloadCsv('df7-payroll', [['Salary Slip', 'Employee', 'Month', 'Payroll Type', 'Hours', 'Overtime', 'Missed', 'Status', 'Net Salary'], ...payroll.map((row) => [row.salarySlipNumber, row.employeeName, row.salaryMonth, row.payrollType, row.totalHoursWorked, row.totalOvertimeHours, row.totalMissedHours, row.status, row.netSalary])])],
    ['Attendance report', `${attendance.length} daily records`, () => downloadCsv('df7-attendance', [['Date', 'Employee ID', 'Employee', 'Payroll Type', 'Status', 'Scheduled Hours', 'Actual Hours', 'Overtime Hours', 'Missed Hours', 'Notes'], ...attendance.map((row) => [row.date, row.employeeNumber, row.employeeName, row.payrollType, row.status, row.scheduledHours, row.actualHours, row.overtimeHours, row.missedHours, row.notes])])],
    ['Final settlement report', `${finalSettlements.length} completed settlements`, () => downloadCsv('df7-final-settlements', [['Salary Slip', 'Employee', 'Last Working Date', 'Reason', 'Prorated Basic', 'Overtime Pay', 'Deductions', 'Final Net', 'Status'], ...finalSettlements.map((row) => [row.salarySlipNumber, row.employeeName, row.lastWorkingDate, row.reasonForLeaving, row.proratedBasicSalary, row.overtimePay, row.totalDeductions, row.finalNetAmount, row.status || row.settlementStatus])])],
    ['Stock report', `${products.length} products`, () => downloadCsv('df7-stock', [['Product', 'Quantity', 'Threshold', 'Price'], ...products.map((row) => [row.name, row.quantity, row.threshold, row.price])])],
  ];

  return (
    <>
      <div className="page-actions"><div><p className="eyebrow">REPORTS & ANALYTICS</p><h2>Exportable business reports</h2><p className="page-subtitle">CSV files open directly in Excel. Existing PDF documents remain available inside their modules.</p></div></div>
      <section className="report-card-grid">{reports.map(([title, subtitle, action]) => <article className="panel report-card" key={title}><span>⌁</span><div><h3>{title}</h3><p>{subtitle}</p></div><button className="button button-secondary" onClick={action}>Export CSV</button></article>)}</section>
    </>
  );
}
