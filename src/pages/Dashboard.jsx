import { currency, groupMonthly } from '../utils/format';

function MiniChart({ data, currencyCode }) {
  const max = Math.max(1, ...data.flatMap((row) => [row.sales, row.expenses]));
  return <div className="mini-chart">{data.map((row) => <div className="chart-column" key={row.key}><div className="chart-bars"><i title={`Sales: ${currency(row.sales, currencyCode)}`} style={{ height: `${Math.max(3, row.sales / max * 100)}%` }} /><i className="expense" title={`Expenses: ${currency(row.expenses, currencyCode)}`} style={{ height: `${Math.max(3, row.expenses / max * 100)}%` }} /></div><small>{row.label}</small></div>)}</div>;
}

export default function Dashboard({ invoices, expenses, products, customers, settings }) {
  const totalSales = invoices.filter((row) => row.status !== 'CANCELLED').reduce((sum, row) => sum + Number(row.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const lowStock = products.filter((row) => Number(row.quantity) <= Number(row.threshold));
  const monthly = groupMonthly(invoices, expenses);
  const stats = [
    ['Revenue', currency(totalSales, settings.currency), `${invoices.length} invoices`, '↗'],
    ['Expenses', currency(totalExpenses, settings.currency), `${expenses.length} records`, '↘'],
    ['Net profit', currency(totalSales - totalExpenses, settings.currency), 'Revenue − expenses', '◆'],
    ['Customers', String(customers.length), `${lowStock.length} low-stock alerts`, '◎'],
  ];
  return <>
    <section className="stats-grid">{stats.map(([label, value, sub, icon]) => <article className="stat-card" key={label}><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{sub}</small></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">LAST SIX MONTHS</p><h2>Revenue overview</h2></div><div className="chart-legend"><span><i />Sales</span><span><i className="expense" />Expenses</span></div></div><MiniChart data={monthly} currencyCode={settings.currency} /></article>
      <article className="panel"><div className="panel-heading"><div><p className="eyebrow">INVENTORY</p><h2>Low-stock alerts</h2></div><span className="count-badge">{lowStock.length}</span></div><div className="alert-list">{lowStock.slice(0, 6).map((row) => <div key={row.id}><div><strong>{row.name}</strong><small>Threshold: {row.threshold}</small></div><span>{row.quantity} left</span></div>)}{!lowStock.length && <div className="healthy-state">✓ Stock levels look healthy.</div>}</div></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest invoices</h2></div></div><div className="responsive-table"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>{invoices.slice(0, 5).map((row) => <tr key={row.id}><td>{row.invoiceNumber}</td><td>{row.customerName}</td><td><span className={`status status-${row.status?.toLowerCase()}`}>{row.status}</span></td><td>{currency(row.total, settings.currency)}</td></tr>)}</tbody></table></div>{!invoices.length && <p className="table-empty">No invoices created yet.</p>}</section>
  </>;
}
