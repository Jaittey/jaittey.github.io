import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';

const blank = { name: '', contactName: '', phone: '', email: '', address: '', taxId: '', paymentTerms: 'Cash / immediate', notes: '', active: true };

export default function Suppliers({ suppliers = [], purchaseOrders = [], notify = () => {} }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => suppliers.filter((row) => !search || `${row.name} ${row.contactName || ''} ${row.phone || ''} ${row.email || ''}`.toLowerCase().includes(search.toLowerCase())), [suppliers, search]);
  const open = (record = null) => { setEditing(record || {}); setForm({ ...blank, ...(record || {}) }); };
  const save = async () => {
    if (!form.name.trim()) return notify('Supplier name is required.', 'error');
    await saveRecord('suppliers', { ...form, name: form.name.trim(), contactName: form.contactName.trim(), phone: form.phone.trim(), email: form.email.trim().toLowerCase(), address: form.address.trim(), notes: form.notes.trim() }, editing?.id || null);
    setEditing(null); notify('Supplier saved.');
  };
  return <div className="v5-page">
    <section className="v5-hero panel"><div><p className="eyebrow">PROCUREMENT</p><h2>Supplier directory</h2><p>Keep vendor contacts, payment terms and purchase history ready for reordering.</p></div><button className="button button-primary" onClick={() => open()}>＋ Add supplier</button></section>
    <section className="panel v5-toolbar"><div className="search-box">⌕<input placeholder="Search suppliers" value={search} onChange={(e) => setSearch(e.target.value)} /></div></section>
    <section className="v5-card-grid">{filtered.map((row) => { const orders = purchaseOrders.filter((po) => po.supplierId === row.id); return <article className="panel v5-data-card" key={row.id}><header><div className="v5-avatar">{row.name.slice(0,2).toUpperCase()}</div><div><h3>{row.name}</h3><p>{row.contactName || 'No contact person'}</p></div><span className={`v5-pill ${row.active === false ? 'muted' : ''}`}>{row.active === false ? 'Inactive' : 'Active'}</span></header><div className="v5-detail-list"><span>Phone <b>{row.phone || '—'}</b></span><span>Email <b>{row.email || '—'}</b></span><span>Terms <b>{row.paymentTerms || '—'}</b></span><span>Purchase orders <b>{orders.length}</b></span></div><footer className="row-actions"><button onClick={() => open(row)}>Edit</button><button className="danger" onClick={async () => { if (confirm(`Delete ${row.name}?`)) { await deleteRecord('suppliers', row.id); notify('Supplier deleted.'); } }}>Delete</button></footer></article>; })}</section>
    {!filtered.length && <section className="panel"><EmptyState icon="◎" title="No suppliers yet" text="Add vendors before creating purchase orders." /></section>}
    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit supplier' : 'Add supplier'} onClose={() => setEditing(null)}><div className="form-grid"><label className="wide"><span>Supplier / company name</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label><span>Contact person</span><input value={form.contactName} onChange={(e)=>setForm({...form,contactName:e.target.value})}/></label><label><span>Phone</span><input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label><label><span>Email</span><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label><span>Tax / registration ID</span><input value={form.taxId} onChange={(e)=>setForm({...form,taxId:e.target.value})}/></label><label><span>Payment terms</span><input value={form.paymentTerms} onChange={(e)=>setForm({...form,paymentTerms:e.target.value})}/></label><label className="wide"><span>Address</span><textarea rows="2" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></label><label className="wide"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label><label className="checkbox-label"><input type="checkbox" checked={Boolean(form.active)} onChange={(e)=>setForm({...form,active:e.target.checked})}/><span>Supplier active</span></label></div><footer className="modal-actions"><button className="button button-ghost" onClick={()=>setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save supplier</button></footer></Modal>
  </div>;
}
