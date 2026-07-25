import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import {
  deleteRecord,
  generateContractInvoice,
  saveRecord,
} from '../services/database';
import {
  calculateDocumentTotals,
  currency,
  dateText,
  inputDate,
  makeNumber,
  monthKey,
  monthLabel,
  safeNumber,
} from '../utils/format';

const addMonths = (value, amount) => {
  const date = new Date(`${value}T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return inputDate(date);
};

const addDays = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return inputDate(date);
};

export default function Billing({
  contracts,
  customers,
  settings,
  notify,
  openInvoices,
}) {
  const [editor, setEditor] = useState(null);
  const [generateFor, setGenerateFor] = useState(null);
  const [billingDate, setBillingDate] = useState(inputDate());
  const [generating, setGenerating] = useState(false);

  const defaultContract = {
    name: 'Mulak School Security Contract',
    customerId: '',
    customerName: 'Mulak School',
    customerOrganisation: 'Mulak School',
    customerDesignation: 'Principal',
    contact: '',
    customerAddress: "M. Mulah, Maldives",
    contractNumber: '',
    referenceNumber: '',
    description: 'Monthly school security service',
    monthlyAmount: '',
    startDate: inputDate(),
    endDate: addMonths(inputDate(), 12),
    billingDay: 1,
    paymentTermsDays: settings.paymentTermsDays || 30,
    gstRate: settings.gstRegistered ? safeNumber(settings.defaultGstRate) : 0,
    discountRate: 0,
    active: true,
    terms: settings.defaultTerms || '',
  };

  const [form, setForm] = useState(defaultContract);

  const resetForm = (record = null) => {
    setForm(record ? { ...defaultContract, ...record } : defaultContract);
    setEditor(record || {});
  };

  const selectCustomer = (id) => {
    const customer = customers.find((row) => row.id === id);
    setForm((current) => ({
      ...current,
      customerId: id,
      customerName: customer?.name || '',
      customerOrganisation: customer?.organisation || '',
      customerDesignation: customer?.designation || '',
      contact: customer?.phone || '',
      customerAddress: customer?.address || '',
    }));
  };

  const saveContract = async () => {
    if (!form.name.trim() || !form.customerName.trim() || safeNumber(form.monthlyAmount) <= 0) {
      return notify('Contract name, customer and monthly amount are required.', 'error');
    }
    if (safeNumber(form.gstRate) > 0 && !settings.gstRegistered) {
      return notify('Enable GST registration in Settings before charging GST.', 'error');
    }

    await saveRecord('billingContracts', {
      ...form,
      monthlyAmount: safeNumber(form.monthlyAmount),
      billingDay: safeNumber(form.billingDay),
      paymentTermsDays: safeNumber(form.paymentTermsDays),
      gstRate: safeNumber(form.gstRate),
      discountRate: safeNumber(form.discountRate),
      active: Boolean(form.active),
    }, form.id || null);
    notify(form.id ? 'Billing contract updated.' : 'Billing contract created.');
    setEditor(null);
  };

  const createInvoice = async () => {
    if (!generateFor) return;
    setGenerating(true);
    try {
      const periodKey = monthKey(`${billingDate}T00:00:00`);
      const servicePeriod = monthLabel(`${billingDate}T00:00:00`);
      const totals = calculateDocumentTotals(
        [{ quantity: 1, price: generateFor.monthlyAmount }],
        generateFor.discountRate,
        generateFor.gstRate,
      );

      const documentDate = billingDate;
      const dueDate = addDays(documentDate, generateFor.paymentTermsDays || 30);
      await generateContractInvoice(generateFor, {
        invoiceNumber: makeNumber(settings.invoicePrefix || 'INV'),
        customerId: generateFor.customerId || '',
        customerName: generateFor.customerName,
        customerOrganisation: generateFor.customerOrganisation || '',
        customerDesignation: generateFor.customerDesignation || '',
        contact: generateFor.contact || '',
        customerAddress: generateFor.customerAddress || '',
        contractNumber: generateFor.contractNumber || '',
        referenceNumber: generateFor.referenceNumber || '',
        servicePeriod,
        billingPeriodKey: periodKey,
        documentDate,
        dueDate,
        paymentMethod: 'Bank Transfer',
        status: 'BILLED',
        terms: generateFor.terms || settings.defaultTerms || '',
        items: [{
          productId: '',
          description: generateFor.description || `Monthly service charge — ${servicePeriod}`,
          quantity: 1,
          price: safeNumber(generateFor.monthlyAmount),
        }],
        ...totals,
      });

      notify(`Monthly invoice created for ${servicePeriod}.`);
      setGenerateFor(null);
      openInvoices();
    } catch (reason) {
      notify(reason?.message || 'Could not generate the monthly invoice.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (record) => {
    if (!confirm(`Delete billing contract "${record.name}"?`)) return;
    await deleteRecord('billingContracts', record.id);
    notify('Billing contract deleted.');
  };

  const activeCount = useMemo(
    () => contracts.filter((row) => row.active !== false).length,
    [contracts],
  );

  return (
    <>
      <div className="page-actions">
        <div>
          <p className="eyebrow">RECURRING BILLING</p>
          <h2>{activeCount} active contract{activeCount === 1 ? '' : 's'}</h2>
        </div>
        <button className="button button-primary" onClick={() => resetForm()}>＋ New billing contract</button>
      </div>

      <section className="billing-grid">
        {contracts.map((contract) => (
          <article className="panel billing-card" key={contract.id}>
            <div className="billing-card-head">
              <div>
                <span className={`status ${contract.active === false ? 'status-cancelled' : 'status-paid'}`}>
                  {contract.active === false ? 'INACTIVE' : 'ACTIVE'}
                </span>
                <h3>{contract.name}</h3>
                <p>{contract.customerOrganisation || contract.customerName}</p>
              </div>
              <strong>{currency(contract.monthlyAmount, settings.currency)}<small>/month</small></strong>
            </div>
            <dl>
              <div><dt>Contract</dt><dd>{contract.contractNumber || '—'}</dd></div>
              <div><dt>Period</dt><dd>{dateText(contract.startDate)} – {dateText(contract.endDate)}</dd></div>
              <div><dt>GST</dt><dd>{safeNumber(contract.gstRate).toFixed(2)}%</dd></div>
              <div><dt>Last billed</dt><dd>{contract.lastGeneratedPeriod || 'Not generated'}</dd></div>
            </dl>
            <div className="row-actions">
              <button onClick={() => resetForm(contract)}>Edit</button>
              <button onClick={() => { setGenerateFor(contract); setBillingDate(inputDate()); }}>Create monthly invoice</button>
              <button className="danger" onClick={() => remove(contract)}>Delete</button>
            </div>
          </article>
        ))}
      </section>

      {!contracts.length && (
        <section className="panel">
          <EmptyState
            icon="↻"
            title="No recurring billing contracts"
            text="Create the Mulak School security contract and generate one invoice each month."
          />
        </section>
      )}

      {editor && (
        <Modal open title={form.id ? 'Edit billing contract' : 'New billing contract'} onClose={() => setEditor(null)}>
          <div className="form-grid">
            <label className="form-span-2"><span>Contract title</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label><span>Saved customer</span><select value={form.customerId} onChange={(e) => selectCustomer(e.target.value)}><option value="">Select or enter manually</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label><span>Client name</span><input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
            <label><span>Institution</span><input value={form.customerOrganisation} onChange={(e) => setForm({ ...form, customerOrganisation: e.target.value })} /></label>
            <label><span>Designation</span><input value={form.customerDesignation} onChange={(e) => setForm({ ...form, customerDesignation: e.target.value })} /></label>
            <label><span>Contact</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
            <label className="form-span-2"><span>Address</span><textarea rows="3" value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} /></label>
            <label><span>Contract number</span><input value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} /></label>
            <label><span>PO / reference number</span><input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} /></label>
            <label className="form-span-2"><span>Monthly service description</span><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label><span>Monthly amount</span><input type="number" min="0" step="0.01" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} /></label>
            <label><span>Billing day</span><input type="number" min="1" max="28" value={form.billingDay} onChange={(e) => setForm({ ...form, billingDay: e.target.value })} /></label>
            <label><span>Start date</span><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label><span>End date</span><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <label><span>Payment terms (days)</span><input type="number" min="0" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} /></label>
            <label><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={form.discountRate} onChange={(e) => setForm({ ...form, discountRate: e.target.value })} /></label>
            <label><span>GST %</span><input type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>Contract is active</span></label>
            <label className="form-span-2"><span>Terms</span><textarea rows="4" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></label>
          </div>
          <footer className="modal-actions">
            <button className="button button-ghost" onClick={() => setEditor(null)}>Cancel</button>
            <button className="button button-primary" onClick={saveContract}>Save contract</button>
          </footer>
        </Modal>
      )}

      {generateFor && (
        <Modal open title="Create monthly invoice" onClose={() => setGenerateFor(null)}>
          <div className="invoice-generation-summary">
            <p>Generate an invoice from:</p>
            <h3>{generateFor.name}</h3>
            <strong>{currency(generateFor.monthlyAmount, settings.currency)} per month</strong>
          </div>
          <div className="form-grid">
            <label><span>Invoice date</span><input type="date" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} /></label>
            <label><span>Billing month</span><input value={monthLabel(`${billingDate}T00:00:00`)} readOnly /></label>
          </div>
          <div className="alert alert-info">The system blocks duplicate invoices for the same contract and billing month.</div>
          <footer className="modal-actions">
            <button className="button button-ghost" onClick={() => setGenerateFor(null)}>Cancel</button>
            <button className="button button-primary" disabled={generating} onClick={createInvoice}>{generating ? 'Generating…' : 'Create invoice'}</button>
          </footer>
        </Modal>
      )}
    </>
  );
}
