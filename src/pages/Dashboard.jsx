import { currency, currentSalaryMonth, groupMonthly, salaryMonthLabel, safeNumber } from '../utils/format';

function MiniChart({ data, currencyCode }) {
  const max = Math.max(1, ...data.flatMap((row) => [row.sales, row.expenses]));
  return <div className="mini-chart">{data.map((row) => <div className="chart-column" key={row.key}><div className="chart-bars"><i title={`Sales: ${currency(row.sales, currencyCode)}`} style={{ height: `${Math.max(3, row.sales / max * 100)}%` }} /><i className="expense" title={`Expenses: ${currency(row.expenses, currencyCode)}`} style={{ height: `${Math.max(3, row.expenses / max * 100)}%` }} /></div><small>{row.label}</small></div>)}</div>;
}

export default function Dashboard({ invoices, expenses, products, customers, employees, payroll, budgets, settings }) {
  const totalSales = invoices.filter((row) => row.status !== 'CANCELLED').reduce((sum, row) => sum + safeNumber(row.total), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + safeNumber(row.amount), 0);
  const activeEmployees = employees.filter((row) => row.status === 'ACTIVE');
  const salaryMonth = currentSalaryMonth();
  const monthPayrollRecords = payroll.filter((row) => row.salaryMonth === salaryMonth && row.status !== 'CANCELLED');
  const payrollCost = monthPayrollRecords.reduce((sum, row) => sum + safeNumber(row.grossSalary), 0);
  const unpaidPayroll = monthPayrollRecords.filter((row) => !['PAID', 'CANCELLED'].includes(row.status)).length;
  const lowStock = products.filter((row) => Number(row.quantity) <= Number(row.threshold));
  const currentYear = String(new Date().getFullYear());
  const yearBudget = budgets.filter((row) => row.year === currentYear);
  const plannedBudget = yearBudget.reduce((sum, row) => sum + safeNumber(row.plannedAmount), 0);
  const actualBudget = yearBudget.reduce((sum, row) => sum + safeNumber(row.actualAmount), 0);
  const budgetRemaining = plannedBudget - actualBudget;
  const monthly = groupMonthly(invoices, expenses);
  const netProfit = totalSales - totalExpenses - payrollCost;

  const stats = [
    ['Revenue', currency(totalSales, settings.currency), `${invoices.length} invoices`, '↗'],
    ['Operating expenses', currency(totalExpenses, settings.currency), `${expenses.length} records`, '↘'],
    ['Current payroll', currency(payrollCost, settings.currency), salaryMonthLabel(salaryMonth), '▣'],
    ['Net after payroll', currency(netProfit, settings.currency), 'Revenue − expenses − payroll', '◆'],
    ['Active employees', String(activeEmployees.length), `${unpaidPayroll} unpaid salary records`, '♙'],
    ['Budget remaining', currency(budgetRemaining, settings.currency), `${currentYear} company budget`, '◫'],
  ];

  return <>
    <section className="stats-grid enterprise-dashboard-stats">{stats.map(([label, value, sub, icon]) => <article className="stat-card" key={label}><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{sub}</small></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">LAST SIX MONTHS</p><h2>Revenue overview</h2></div><div className="chart-legend"><span><i />Sales</span><span><i className="expense" />Expenses</span></div></div><MiniChart data={monthly} currencyCode={settings.currency} /></article>
      <article className="panel"><div className="panel-heading"><div><p className="eyebrow">ENTERPRISE ALERTS</p><h2>Needs attention</h2></div><span className="count-badge">{lowStock.length + unpaidPayroll}</span></div><div className="alert-list">{lowStock.slice(0, 3).map((row) => <div key={row.id}><div><strong>{row.name}</strong><small>Low-stock threshold: {row.threshold}</small></div><span>{row.quantity} left</span></div>)}{monthPayrollRecords.filter((row) => !['PAID', 'CANCELLED'].includes(row.status)).slice(0, 3).map((row) => <div key={row.id}><div><strong>{row.employeeName}</strong><small>{salaryMonthLabel(row.salaryMonth)} salary</small></div><span>{row.status}</span></div>)}{!lowStock.length && !unpaidPayroll && <div className="healthy-state">✓ No urgent alerts.</div>}</div></article>
    </section>
    <section className="dashboard-grid enterprise-dashboard-bottom">
      <article className="panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest invoices</h2></div></div><div className="responsive-table"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>{invoices.slice(0, 5).map((row) => <tr key={row.id}><td data-label="Invoice">{row.invoiceNumber}</td><td data-label="Customer">{row.customerOrganisation || row.customerName}</td><td data-label="Status"><span className={`status status-${row.status?.toLowerCase()}`}>{row.status}</span></td><td data-label="Total">{currency(row.total, settings.currency)}</td></tr>)}</tbody></table></div>{!invoices.length && <p className="table-empty">No invoices created yet.</p>}</article>
      <article className="panel"><div className="panel-heading"><div><p className="eyebrow">BUDGET CONTROL</p><h2>{currentYear} usage</h2></div><span className="count-badge">{plannedBudget > 0 ? `${Math.min(999, actualBudget / plannedBudget * 100).toFixed(0)}%` : '0%'}</span></div><div className="budget-progress dashboard-budget-progress"><i style={{ width: `${plannedBudget > 0 ? Math.min(100, actualBudget / plannedBudget * 100) : 0}%` }} /></div><div className="dashboard-budget-values"><div><small>Planned</small><strong>{currency(plannedBudget, settings.currency)}</strong></div><div><small>Actual</small><strong>{currency(actualBudget, settings.currency)}</strong></div><div><small>Remaining</small><strong>{currency(budgetRemaining, settings.currency)}</strong></div></div></article>
    </section>
  </>;
}
