import { useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';
import { currency, dateText, inputDate, safeNumber } from '../utils/format';

export default function Expenses({ expenses, settings, notify }) {
  const blank = { description: '', amount: '', category: '', date: inputDate() };
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const open = (record = null) => { setEditing(record || {}); setForm(record || blank); };
  const filtered = expenses.filter((row) => `${row.description} ${row.category}`.toLowerCase().includes(search.toLowerCase()));
  const save = async () => { if (!form.description.trim() || safeNumber(form.amount) <= 0) return; await saveRecord('expenses', { ...form, amount: safeNumber(form.amount) }, editing?.id || null); setEditing(null); notify('Expense saved.'); };
  return <>
    <div className="page-actions"><div className="search-box">⌕<input placeholder="Search expenses" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="button button-primary" onClick={() => open()}>＋ Add expense</button></div>
    <section className="panel"><div className="responsive-table"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td>{dateText(row.date)}</td><td><strong>{row.description}</strong></td><td>{row.category || '—'}</td><td className="expense-value">{currency(row.amount, settings.currency)}</td><td><div className="row-actions"><button onClick={() => open(row)}>Edit</button><button className="danger" onClick={async () => { if (confirm('Delete this expense?')) { await deleteRecord('expenses', row.id); notify('Expense deleted.'); } }}>Delete</button></div></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState icon="↘" title="No expenses found" />}</section>
    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit expense' : 'Add expense'} onClose={() => setEditing(null)}><div className="form-grid"><label className="wide"><span>Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label><span>Amount</span><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label><span>Date</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label><span>Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label></div><footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save expense</button></footer></Modal>
  </>;
}
