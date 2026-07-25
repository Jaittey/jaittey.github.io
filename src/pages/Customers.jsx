import { useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';
import { currency } from '../utils/format';

export default function Customers({ customers, invoices, settings, notify }) {
  const blank = { name: '', phone: '', email: '', address: '', organisation: '', designation: '' };
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const open = (record = null) => { setEditing(record || {}); setForm(record || blank); };
  const filtered = customers.filter((row) => `${row.name} ${row.phone} ${row.email}`.toLowerCase().includes(search.toLowerCase()));
  const spent = (customer) => invoices.filter((row) => row.customerId === customer.id && row.status !== 'CANCELLED').reduce((sum, row) => sum + Number(row.total || 0), 0);
  const save = async () => { if (!form.name.trim()) return; await saveRecord('customers', form, editing?.id || null); setEditing(null); notify('Customer saved.'); };
  return <>
    <div className="page-actions"><div className="search-box">⌕<input placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="button button-primary" onClick={() => open()}>＋ Add customer</button></div>
    <section className="customer-grid">{filtered.map((row) => <article className="customer-card" key={row.id}><div className="customer-avatar">{row.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()}</div><div className="customer-main"><strong>{row.name}</strong><span>{row.phone || row.email || 'No contact added'}</span><small>{row.address || 'No address added'}</small></div><div className="customer-spent"><small>Total spent</small><strong>{currency(spent(row), settings.currency)}</strong></div><div className="row-actions"><button onClick={() => open(row)}>Edit</button><button className="danger" onClick={async () => { if (confirm(`Delete ${row.name}?`)) { await deleteRecord('customers', row.id); notify('Customer deleted.'); } }}>Delete</button></div></article>)}</section>
    {!filtered.length && <section className="panel"><EmptyState icon="◎" title="No customers found" /></section>}
    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit customer' : 'Add customer'} onClose={() => setEditing(null)}><div className="form-grid"><label><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label><span>Address</span><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><label><span>Organisation / institution</span><input value={form.organisation || ''} onChange={(e) => setForm({ ...form, organisation: e.target.value })} /></label><label><span>Official designation</span><input value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label></div><footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save customer</button></footer></Modal>
  </>;
}
