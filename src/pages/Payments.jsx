import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { receivePayment } from '../services/database';
import { currency, dateText, inputDate, safeNumber } from '../utils/format';

export default function Payments({ payments, invoices, settings, notify }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId: '', amount: '', date: inputDate(), method: 'Bank Transfer', reference: '', notes: '' });

  const outstanding = useMemo(() => invoices.filter((row) => row.status !== 'CANCELLED' && safeNumber(row.balanceDue ?? row.total) > 0), [invoices]);
  const selected = invoices.find((row) => row.id === form.invoiceId);
  const totalReceived = payments.reduce((sum, row) => sum + safeNumber(row.amount), 0);

  const save = async () => {
    if (!selected || safeNumber(form.amount) <= 0) return notify('Select an invoice and enter a payment amount.', 'error');
    try {
      await receivePayment(selected, { ...form, amount: safeNumber(form.amount) });
      notify('Payment received and customer balance updated.');
      setOpen(false);
    } catch (reason) {
      notify(reason?.message || 'Could not save payment.', 'error');
    }
  };

  return (
    <>
      <section className="stats-grid compact-stats">
        <article className="stat-card"><span>↘</span><p>Total received</p><strong>{currency(totalReceived, settings.currency)}</strong><small>{payments.length} payment records</small></article>
        <article className="stat-card"><span>!</span><p>Outstanding invoices</p><strong>{outstanding.length}</strong><small>Awaiting full payment</small></article>
      </section>
      <div className="page-actions"><div><p className="eyebrow">PAYMENTS</p><h2>Payment history and balances</h2></div><button className="button button-primary" onClick={() => setOpen(true)}>＋ Receive payment</button></div>
      <section className="panel"><div className="responsive-table"><table><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{payments.map((row) => <tr key={row.id}><td data-label="Date">{dateText(row.date)}</td><td data-label="Invoice">{row.invoiceNumber}</td><td data-label="Customer">{row.customerName}</td><td data-label="Method">{row.method}</td><td data-label="Reference">{row.reference || '—'}</td><td data-label="Amount">{currency(row.amount, settings.currency)}</td></tr>)}</tbody></table></div>{!payments.length && <EmptyState icon="↘" title="No payments recorded" text="Receive a payment against an outstanding invoice." />}</section>

      {open && <Modal open title="Receive payment" onClose={() => setOpen(false)}>
        <div className="form-grid">
          <label className="form-span-2"><span>Outstanding invoice</span><select value={form.invoiceId} onChange={(e) => { const invoice = invoices.find((row) => row.id === e.target.value); setForm({ ...form, invoiceId: e.target.value, amount: invoice ? String(invoice.balanceDue ?? invoice.total) : '' }); }}><option value="">Select invoice</option>{outstanding.map((row) => <option key={row.id} value={row.id}>{row.invoiceNumber} · {row.customerName} · {currency(row.balanceDue ?? row.total, settings.currency)}</option>)}</select></label>
          <label><span>Amount received</span><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label><span>Payment date</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label><span>Payment method</span><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{['Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Reference</span><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
          <label className="form-span-2"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        {selected && <div className="document-totals"><div><span>Invoice total</span><strong>{currency(selected.total, settings.currency)}</strong></div><div><span>Current balance</span><strong>{currency(selected.balanceDue ?? selected.total, settings.currency)}</strong></div></div>}
        <footer className="modal-actions"><button className="button button-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary" onClick={save}>Save payment</button></footer>
      </Modal>}
    </>
  );
}
