import { useMemo, useState } from 'react';
import Modal from './Modal';
import {
  calculateDocumentTotals,
  inputDate,
  safeNumber,
} from '../utils/format';

const addDays = (dateValue, days) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return inputDate(date);
};

export default function DocumentEditor({
  open,
  type,
  initial,
  customers,
  products,
  settings,
  onClose,
  onSave,
}) {
  const isInvoice = type === 'invoice';
  const today = inputDate();
  const defaultDocumentDate = initial?.documentDate || today;
  const empty = {
    customerId: '',
    customerName: '',
    contact: '',
    customerAddress: '',
    customerOrganisation: '',
    customerDesignation: '',
    status: isInvoice ? 'BILLED' : 'DRAFT',
    paymentMethod: 'Bank Transfer',
    documentDate: defaultDocumentDate,
    validUntil: !isInvoice
      ? addDays(defaultDocumentDate, settings.quotationValidityDays || 30)
      : '',
    referenceNumber: '',
    contractNumber: '',
    servicePeriod: '',
    introduction: '',
    scopeOfWork: '',
    terms: settings.defaultTerms || '',
    declaration: !isInvoice ? settings.quotationDeclaration || '' : '',
    gstRate: settings.gstRegistered ? safeNumber(settings.defaultGstRate) : 0,
    discountRate: safeNumber(settings.defaultDiscountRate),
    items: [],
  };

  const [form, setForm] = useState(() => ({ ...empty, ...initial }));
  const [item, setItem] = useState({
    productId: '',
    description: '',
    quantity: 1,
    price: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const totals = useMemo(
    () => calculateDocumentTotals(form.items, form.discountRate, form.gstRate),
    [form.items, form.discountRate, form.gstRate],
  );

  const selectCustomer = (id) => {
    const customer = customers.find((row) => row.id === id);
    setForm((current) => ({
      ...current,
      customerId: id,
      customerName: customer?.name || '',
      contact: customer?.phone || '',
      customerAddress: customer?.address || '',
      customerOrganisation: customer?.organisation || '',
      customerDesignation: customer?.designation || '',
    }));
  };

  const selectProduct = (id) => {
    const product = products.find((row) => row.id === id);
    setItem((current) => ({
      ...current,
      productId: id,
      description: product?.name || '',
      price: product?.price ?? '',
    }));
  };

  const addItem = () => {
    if (!item.description.trim() || safeNumber(item.quantity) <= 0) return;
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...item,
          quantity: safeNumber(item.quantity),
          price: safeNumber(item.price),
        },
      ],
    }));
    setItem({ productId: '', description: '', quantity: 1, price: '' });
  };

  const updateDocumentDate = (value) => {
    setForm((current) => ({
      ...current,
      documentDate: value,
      ...(!isInvoice ? { validUntil: addDays(value, settings.quotationValidityDays || 30) } : {}),
    }));
  };

  const submit = async () => {
    setFormError('');
    if (!form.customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (!form.items.length) {
      setFormError('Add at least one item.');
      return;
    }
    if (safeNumber(form.gstRate) > 0 && !settings.gstRegistered) {
      setFormError('Enable GST registration in Settings before charging GST.');
      return;
    }

    const payload = {
      customerId: form.customerId || '',
      customerName: form.customerName.trim(),
      contact: form.contact?.trim() || '',
      customerAddress: form.customerAddress?.trim() || '',
      customerOrganisation: form.customerOrganisation?.trim() || '',
      customerDesignation: form.customerDesignation?.trim() || '',
      status: form.status,
      documentDate: form.documentDate || today,
      referenceNumber: form.referenceNumber?.trim() || '',
      contractNumber: form.contractNumber?.trim() || '',
      servicePeriod: form.servicePeriod?.trim() || '',
      introduction: form.introduction?.trim() || '',
      scopeOfWork: form.scopeOfWork?.trim() || '',
      terms: form.terms?.trim() || '',
      declaration: form.declaration?.trim() || '',
      items: form.items.map(({
        productId = '',
        description,
        quantity,
        price,
      }) => ({
        productId,
        description,
        quantity: safeNumber(quantity),
        price: safeNumber(price),
      })),
      ...totals,
      ...(isInvoice
        ? {
            paymentMethod: form.paymentMethod || 'Bank Transfer',
          }
        : {
            validUntil: form.validUntil || '',
          }),
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (reason) {
      setFormError(reason?.message || 'Could not save this document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial?.id
        ? `Edit ${isInvoice ? 'invoice' : 'quotation'}`
        : `New ${isInvoice ? 'invoice' : 'quotation'}`}
      onClose={onClose}
    >
      <div className="document-section-title">Client and reference details</div>
      <div className="form-grid">
        <label><span>Customer</span><select value={form.customerId} onChange={(e) => selectCustomer(e.target.value)}><option value="">Select or type below</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label><span>Client name</span><input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
        <label><span>Official designation</span><input value={form.customerDesignation || ''} onChange={(e) => setForm({ ...form, customerDesignation: e.target.value })} placeholder="e.g. Principal" /></label>
        <label><span>Company / institution</span><input value={form.customerOrganisation || ''} onChange={(e) => setForm({ ...form, customerOrganisation: e.target.value })} placeholder="e.g. Mulak School" /></label>
        <label><span>Contact number</span><input inputMode="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
        <label className="form-span-2"><span>Client address</span><textarea rows="3" value={form.customerAddress || ''} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} /></label>
        <label><span>Reference / PO / tender number</span><input value={form.referenceNumber || ''} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} /></label>
        <label><span>Contract number</span><input value={form.contractNumber || ''} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} /></label>
        <label><span>Document date</span><input type="date" value={form.documentDate} onChange={(e) => updateDocumentDate(e.target.value)} /></label>
        {!isInvoice && <label><span>Expiry / validity date</span><input type="date" value={form.validUntil || ''} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></label>}
        <label><span>Service / billing period</span><input value={form.servicePeriod || ''} onChange={(e) => setForm({ ...form, servicePeriod: e.target.value })} placeholder="e.g. July 2026" /></label>
        <label><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{(isInvoice ? ['BILLED', 'PAID', 'CANCELLED'] : ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED']).map((value) => <option key={value}>{value}</option>)}</select></label>
        {isInvoice && <label><span>Payment method</span><select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{['Cash', 'Bank Transfer', 'Card', 'Cheque'].map((value) => <option key={value}>{value}</option>)}</select></label>}
      </div>

      <div className="document-section-title">Scope and pricing</div>
      {!isInvoice && (
        <div className="form-grid">
          <label className="form-span-2"><span>Introduction / inquiry reference</span><textarea rows="3" value={form.introduction || ''} onChange={(e) => setForm({ ...form, introduction: e.target.value })} /></label>
          <label className="form-span-2"><span>Scope of work / deliverables</span><textarea rows="4" value={form.scopeOfWork || ''} onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })} /></label>
        </div>
      )}

      <div className="item-builder">
        <select value={item.productId} onChange={(e) => selectProduct(e.target.value)}><option value="">Stock item (optional)</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.quantity} available</option>)}</select>
        <input placeholder="Description / deliverable" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
        <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
        <input type="number" min="0" step="0.01" placeholder="Unit price" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} />
        <button type="button" className="button button-secondary" onClick={addItem}>Add item</button>
      </div>

      <div className="editor-items">
        {form.items.map((row, index) => (
          <div key={`${row.description}-${index}`}>
            <span>{row.description}</span>
            <small>{row.quantity} × {settings.currency} {safeNumber(row.price).toFixed(2)}</small>
            <strong>{settings.currency} {(safeNumber(row.quantity) * safeNumber(row.price)).toFixed(2)}</strong>
            <button type="button" className="icon-button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>×</button>
          </div>
        ))}
        {!form.items.length && <p className="inline-empty">No items added.</p>}
      </div>

      <div className="form-grid tax-grid">
        <label><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={form.discountRate ?? 0} onChange={(e) => setForm({ ...form, discountRate: e.target.value })} /></label>
        <label><span>GST %</span><input type="number" min="0" max="100" step="0.01" value={form.gstRate ?? 0} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} /></label>
      </div>

      <div className="document-totals">
        <div><span>Subtotal</span><strong>{settings.currency} {totals.subtotal.toFixed(2)}</strong></div>
        <div><span>Discount ({totals.discountRate.toFixed(2)}%)</span><strong>− {settings.currency} {totals.discountAmount.toFixed(2)}</strong></div>
        <div><span>Taxable amount</span><strong>{settings.currency} {totals.taxableAmount.toFixed(2)}</strong></div>
        <div><span>GST ({totals.gstRate.toFixed(2)}%)</span><strong>{settings.currency} {totals.gstAmount.toFixed(2)}</strong></div>
        <div className="grand-total"><span>Total</span><strong>{settings.currency} {totals.total.toFixed(2)}</strong></div>
      </div>

      <div className="form-grid">
        <label className="form-span-2"><span>Terms and conditions</span><textarea rows="4" value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></label>
        {!isInvoice && <label className="form-span-2"><span>Declaration / compliance statement</span><textarea rows="4" value={form.declaration || ''} onChange={(e) => setForm({ ...form, declaration: e.target.value })} /></label>}
      </div>

      {formError && <div className="alert alert-error">{formError}</div>}
      <footer className="modal-actions">
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="button button-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </footer>
    </Modal>
  );
}
