import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { deleteRecord, saveRecord } from '../services/database';
import { budgetPeriodLabel, currency, safeNumber } from '../utils/format';

const categories = [
  'Employee salaries', 'Overtime', 'Security equipment', 'Uniforms', 'Transport',
  'Office expenses', 'Utilities', 'Stock purchases', 'Maintenance', 'Marketing',
  'Government fees', 'GST / tax', 'Emergency fund', 'Other',
];
const currentYear = String(new Date().getFullYear());
const blank = { year: currentYear, month: '', category: 'Employee salaries', plannedAmount: 0, actualAmount: 0, notes: '' };

export default function Budget({ budgets, settings, notify }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [monthFilter, setMonthFilter] = useState('ALL');

  const filtered = useMemo(() => budgets.filter((record) => (
    record.year === yearFilter && (monthFilter === 'ALL' || (record.month || '') === monthFilter)
  )), [budgets, yearFilter, monthFilter]);

  const summary = filtered.reduce((result, record) => {
    result.planned += safeNumber(record.plannedAmount);
    result.actual += safeNumber(record.actualAmount);
    return result;
  }, { planned: 0, actual: 0 });
  summary.remaining = summary.planned - summary.actual;
  summary.usage = summary.planned > 0 ? (summary.actual / summary.planned) * 100 : 0;

  const open = (record = null) => {
    setEditing(record || {});
    setForm(record ? { ...blank, ...record } : { ...blank, year: yearFilter, month: monthFilter === 'ALL' ? '' : monthFilter });
  };

  const save = async () => {
    if (!form.year || !form.category || safeNumber(form.plannedAmount) < 0 || safeNumber(form.actualAmount) < 0) {
      notify('Enter a valid year, category and amounts.', 'error');
      return;
    }
    await saveRecord('budgets', {
      ...form,
      plannedAmount: safeNumber(form.plannedAmount),
      actualAmount: safeNumber(form.actualAmount),
    }, editing?.id || null);
    setEditing(null);
    notify(editing?.id ? 'Budget updated.' : 'Budget added.');
  };

  return <>
    <section className="stats-grid enterprise-summary-grid">
      <article className="stat-card"><span>◫</span><p>Planned budget</p><strong>{currency(summary.planned, settings.currency)}</strong><small>{yearFilter}</small></article>
      <article className="stat-card"><span>↘</span><p>Actual spending</p><strong>{currency(summary.actual, settings.currency)}</strong><small>{summary.usage.toFixed(1)}% used</small></article>
      <article className={`stat-card ${summary.remaining < 0 ? 'budget-negative' : ''}`}><span>◆</span><p>Remaining budget</p><strong>{currency(summary.remaining, settings.currency)}</strong><small>{summary.remaining < 0 ? 'Over budget' : 'Available'}</small></article>
    </section>

    <div className="page-actions">
      <div className="employee-filters">
        <input type="number" min="2020" max="2100" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} aria-label="Budget year" />
        <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="ALL">All periods</option><option value="">Annual only</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{new Date(2026, index, 1).toLocaleString('en-GB', { month: 'long' })}</option>)}</select>
      </div>
      <button className="button button-primary" onClick={() => open()}>＋ Add budget</button>
    </div>

    <section className="budget-grid">
      {filtered.map((record) => {
        const planned = safeNumber(record.plannedAmount);
        const actual = safeNumber(record.actualAmount);
        const remaining = planned - actual;
        const usage = planned > 0 ? actual / planned * 100 : 0;
        return <article className={`panel budget-card ${remaining < 0 ? 'over-budget' : ''}`} key={record.id}>
          <div className="budget-card-head"><div><span>{budgetPeriodLabel(record.year, record.month)}</span><h3>{record.category}</h3></div><strong>{usage.toFixed(1)}%</strong></div>
          <div className="budget-progress"><i style={{ width: `${Math.min(100, Math.max(0, usage))}%` }} /></div>
          <dl><div><dt>Planned</dt><dd>{currency(planned, settings.currency)}</dd></div><div><dt>Actual</dt><dd>{currency(actual, settings.currency)}</dd></div><div><dt>Remaining</dt><dd>{currency(remaining, settings.currency)}</dd></div></dl>
          {record.notes && <p className="budget-notes">{record.notes}</p>}
          <div className="row-actions"><button onClick={() => open(record)}>Edit</button><button className="danger" onClick={async () => { if (confirm(`Delete the ${record.category} budget?`)) { await deleteRecord('budgets', record.id); notify('Budget deleted.'); } }}>Delete</button></div>
        </article>;
      })}
    </section>
    {!filtered.length && <section className="panel"><EmptyState icon="◫" title="No budget records found" text="Add an annual or monthly budget category." /></section>}

    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit budget' : 'Add company budget'} onClose={() => setEditing(null)}>
      <div className="form-grid">
        <label><span>Year</span><input type="number" min="2020" max="2100" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} /></label>
        <label><span>Period</span><select value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })}><option value="">Annual</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{new Date(2026, index, 1).toLocaleString('en-GB', { month: 'long' })}</option>)}</select></label>
        <label className="form-span-2"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span>Planned amount</span><input type="number" min="0" step="0.01" value={form.plannedAmount} onChange={(event) => setForm({ ...form, plannedAmount: event.target.value })} /></label>
        <label><span>Actual spending</span><input type="number" min="0" step="0.01" value={form.actualAmount} onChange={(event) => setForm({ ...form, actualAmount: event.target.value })} /></label>
        <label className="form-span-2"><span>Notes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save budget</button></footer>
    </Modal>
  </>;
}
