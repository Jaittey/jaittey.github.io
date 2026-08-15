import { useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';
import { currency, safeNumber } from '../utils/format';

export default function Products({ products, settings, notify }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const blank = { name: '', quantity: 0, price: 0, threshold: 5 };
  const [form, setForm] = useState(blank);
  const open = (record = null) => { setEditing(record || {}); setForm(record || blank); };
  const filtered = products.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  const save = async () => {
    if (!form.name.trim()) return;
    await saveRecord('products', { name: form.name.trim(), quantity: safeNumber(form.quantity), price: safeNumber(form.price), threshold: safeNumber(form.threshold) }, editing?.id || null);
    setEditing(null); notify('Stock item saved.');
  };
  return <>
    <div className="page-actions"><div className="search-box">⌕<input placeholder="Search stock" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="button button-primary" onClick={() => open()}>＋ Add product</button></div>
    <section className="inventory-grid">{filtered.map((row) => { const low = Number(row.quantity) <= Number(row.threshold); return <article className={`inventory-card ${low ? 'low' : ''}`} key={row.id}><div className="inventory-top"><span>{row.name.slice(0, 2).toUpperCase()}</span><div><strong>{row.name}</strong><small>{currency(row.price, settings.currency)}</small></div></div><div className="stock-meter"><i style={{ width: `${Math.min(100, Math.max(4, Number(row.quantity) / Math.max(1, Number(row.threshold) * 3) * 100))}%` }} /></div><div className="inventory-bottom"><div><small>Available</small><strong>{row.quantity}</strong></div><div><small>Low at</small><strong>{row.threshold}</strong></div><div className="row-actions"><button onClick={() => open(row)}>Edit</button><button className="danger" onClick={async () => { if (confirm(`Delete ${row.name}?`)) { await deleteRecord('products', row.id); notify('Product deleted.'); } }}>Delete</button></div></div></article>; })}</section>
    {!filtered.length && <section className="panel"><EmptyState icon="□" title="No stock items found" /></section>}
    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit product' : 'Add product'} onClose={() => setEditing(null)}><div className="form-grid"><label className="wide"><span>Product name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span>Quantity</span><input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><label><span>Price</span><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label><span>Low-stock threshold</span><input type="number" min="0" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></label></div><footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save product</button></footer></Modal>
  </>;
}
