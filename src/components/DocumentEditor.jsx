import { useMemo, useState } from 'react';
import Modal from './Modal';
import { safeNumber } from '../utils/format';

export default function DocumentEditor({ open, type, initial, customers, products, settings, onClose, onSave }) {
  const isInvoice = type === 'invoice';
  const empty = {
    customerId: '', customerName: '', contact: '', status: isInvoice ? 'BILLED' : 'DRAFT',
    paymentMethod: 'Cash', validUntil: '', items: [],
  };
  const [form, setForm] = useState(() => ({ ...empty, ...initial }));
  const [item, setItem] = useState({ productId: '', description: '', quantity: 1, price: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const total = useMemo(() => form.items.reduce((sum, row) => sum + safeNumber(row.quantity) * safeNumber(row.price), 0), [form.items]);

  const selectCustomer = (id) => {
    const customer = customers.find((row) => row.id === id);
    setForm((current) => ({ ...current, customerId: id, customerName: customer?.name || '', contact: customer?.phone || customer?.email || '' }));
  };
  const selectProduct = (id) => {
    const product = products.find((row) => row.id === id);
    setItem((current) => ({ ...current, productId: id, description: product?.name || '', price: product?.price ?? '' }));
  };
  const addItem = () => {
    if (!item.description.trim() || safeNumber(item.quantity) <= 0) return;
    setForm((current) => ({ ...current, items: [...current.items, { ...item, quantity: safeNumber(item.quantity), price: safeNumber(item.price) }] }));
    setItem({ productId: '', description: '', quantity: 1, price: '' });
  };
  const submit = async () => {
    setFormError('');
    if (!form.customerName.trim()) { setFormError('Customer name is required.'); return; }
    if (!form.items.length) { setFormError('Add at least one item.'); return; }
    const payload = {
      customerId: form.customerId || '',
      customerName: form.customerName.trim(),
      contact: form.contact?.trim() || '',
      status: form.status,
      items: form.items.map(({ productId = '', description, quantity, price }) => ({ productId, description, quantity: safeNumber(quantity), price: safeNumber(price) })),
      total,
      ...(isInvoice ? { paymentMethod: form.paymentMethod || 'Cash' } : { validUntil: form.validUntil || '' }),
    };
    setSaving(true);
    try { await onSave(payload); onClose(); }
    catch (reason) { setFormError(reason?.message || 'Could not save this document.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={initial?.id ? `Edit ${isInvoice ? 'invoice' : 'quotation'}` : `New ${isInvoice ? 'invoice' : 'quotation'}`} onClose={onClose}>
      <div className="form-grid">
        <label><span>Customer</span><select value={form.customerId} onChange={(e) => selectCustomer(e.target.value)}><option value="">Select or type below</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label><span>Customer name</span><input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
        <label><span>Contact</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
        <label><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{(isInvoice ? ['BILLED', 'PAID', 'CANCELLED'] : ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED']).map((value) => <option key={value}>{value}</option>)}</select></label>
        {isInvoice ? <label><span>Payment method</span><select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{['Cash', 'Bank Transfer', 'Card'].map((value) => <option key={value}>{value}</option>)}</select></label> : <label><span>Valid until</span><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></label>}
      </div>

      <div className="item-builder">
        <select value={item.productId} onChange={(e) => selectProduct(e.target.value)}><option value="">Stock item (optional)</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.quantity} available</option>)}</select>
        <input placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
        <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
        <input type="number" min="0" step="0.01" placeholder="Price" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} />
        <button className="button button-secondary" onClick={addItem}>Add item</button>
      </div>

      <div className="editor-items">
        {form.items.map((row, index) => <div key={`${row.description}-${index}`}><span>{row.description}</span><small>{row.quantity} × {settings.currency} {safeNumber(row.price).toFixed(2)}</small><strong>{settings.currency} {(safeNumber(row.quantity) * safeNumber(row.price)).toFixed(2)}</strong><button className="icon-button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>×</button></div>)}
        {!form.items.length && <p className="inline-empty">No items added.</p>}
      </div>
      {formError && <div className="alert alert-error">{formError}</div>}
      <div className="modal-total"><span>Total</span><strong>{settings.currency} {total.toFixed(2)}</strong></div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></footer>
    </Modal>
  );
}
