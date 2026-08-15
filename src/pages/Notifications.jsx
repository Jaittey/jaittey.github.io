import { dateText, safeNumber } from '../utils/format';

export default function Notifications({ invoices, products, payroll, budgets, billingContracts }) {
  const now = new Date();
  const items = [
    ...invoices.filter((row) => row.status === 'BILLED' && safeNumber(row.balanceDue ?? row.total) > 0).map((row) => ({ type: 'Outstanding invoice', title: `${row.invoiceNumber} · ${row.customerName}`, detail: `Balance requires payment follow-up.`, tone: 'warning' })),
    ...products.filter((row) => safeNumber(row.quantity) <= safeNumber(row.threshold)).map((row) => ({ type: 'Low stock', title: row.name, detail: `${row.quantity} remaining; threshold ${row.threshold}.`, tone: 'danger' })),
    ...payroll.filter((row) => !['PAID', 'CANCELLED'].includes(row.status)).map((row) => ({ type: 'Payroll due', title: row.employeeName, detail: `${row.salaryMonth} salary is ${row.status}.`, tone: 'warning' })),
    ...budgets.filter((row) => safeNumber(row.actualAmount) > safeNumber(row.plannedAmount)).map((row) => ({ type: 'Budget limit', title: row.category, detail: `Actual spending exceeds the planned budget.`, tone: 'danger' })),
    ...billingContracts.filter((row) => row.endDate && new Date(`${row.endDate}T00:00:00`) >= now && new Date(`${row.endDate}T00:00:00`) - now < 45 * 86400000).map((row) => ({ type: 'Contract expiry', title: row.name, detail: `Expires ${dateText(row.endDate)}.`, tone: 'warning' })),
  ];

  return (
    <>
      <div className="page-actions"><div><p className="eyebrow">NOTIFICATIONS</p><h2>{items.length} item{items.length === 1 ? '' : 's'} need attention</h2></div></div>
      <section className="notification-list panel">
        {items.map((item, index) => <article className={`notification-item ${item.tone}`} key={`${item.type}-${index}`}><span>!</span><div><small>{item.type}</small><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}
        {!items.length && <div className="healthy-state">✓ No urgent notifications.</div>}
      </section>
    </>
  );
}
