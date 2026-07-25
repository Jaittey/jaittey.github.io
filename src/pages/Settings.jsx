import { useEffect, useState } from 'react';
import { saveBusinessSettings } from '../services/database';
import { OWNER_EMAIL } from '../config/firebase';

export default function Settings({ settings, notify }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  const save = async () => {
    await saveBusinessSettings({
      ...form,
      defaultGstRate: Number(form.defaultGstRate || 0),
      defaultDiscountRate: Number(form.defaultDiscountRate || 0),
      paymentTermsDays: Number(form.paymentTermsDays || 0),
      quotationValidityDays: Number(form.quotationValidityDays || 0),
      gstRegistered: Boolean(form.gstRegistered),
    });
    notify('Business and compliance settings saved.');
  };

  return (
    <section className="settings-layout">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BUSINESS PROFILE</p>
            <h2>Company, tax and document details</h2>
          </div>
        </div>

        <div className="form-grid settings-form">
          <label><span>Business name</span><input value={form.businessName || ''} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></label>
          <label><span>Short name</span><input value={form.shortName || ''} onChange={(e) => setForm({ ...form, shortName: e.target.value })} /></label>
          <label className="wide"><span>Registered address</span><textarea rows="3" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label><span>Phone</span><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label><span>Email</span><input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span>Business registration number</span><input value={form.registrationNumber || ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></label>
          <label><span>Taxpayer Identification Number (TIN)</span><input value={form.tin || ''} onChange={(e) => setForm({ ...form, tin: e.target.value })} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.gstRegistered)} onChange={(e) => setForm({ ...form, gstRegistered: e.target.checked })} /><span>Company is GST registered</span></label>
          <label><span>Default GST %</span><input type="number" min="0" max="100" step="0.01" value={form.defaultGstRate ?? 0} onChange={(e) => setForm({ ...form, defaultGstRate: e.target.value })} /></label>
          <label><span>Default discount %</span><input type="number" min="0" max="100" step="0.01" value={form.defaultDiscountRate ?? 0} onChange={(e) => setForm({ ...form, defaultDiscountRate: e.target.value })} /></label>
          <label><span>Default payment terms (days)</span><input type="number" min="0" value={form.paymentTermsDays ?? 30} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} /></label>
          <label><span>Quotation validity (days)</span><input type="number" min="1" value={form.quotationValidityDays ?? 30} onChange={(e) => setForm({ ...form, quotationValidityDays: e.target.value })} /></label>
          <label><span>Currency</span><input value={form.currency || ''} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
          <label><span>Invoice prefix</span><input value={form.invoicePrefix || ''} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} /></label>
          <label><span>Quotation prefix</span><input value={form.quotePrefix || ''} onChange={(e) => setForm({ ...form, quotePrefix: e.target.value.toUpperCase() })} /></label>
          <label><span>Authorized signatory</span><input value={form.authorizedSignatory || ''} onChange={(e) => setForm({ ...form, authorizedSignatory: e.target.value })} /></label>
          <label><span>Designation</span><input value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
          <label><span>Bank name</span><input value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></label>
          <label><span>Bank account name</span><input value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} /></label>
          <label><span>Bank account number</span><input value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} /></label>
          <label className="wide"><span>Default payment terms</span><textarea rows="3" value={form.defaultTerms || ''} onChange={(e) => setForm({ ...form, defaultTerms: e.target.value })} /></label>
          <label className="wide"><span>Quotation declaration</span><textarea rows="4" value={form.quotationDeclaration || ''} onChange={(e) => setForm({ ...form, quotationDeclaration: e.target.value })} /></label>
          <label className="wide"><span>Google Drive root folder</span><input value={form.driveRootFolder || ''} onChange={(e) => setForm({ ...form, driveRootFolder: e.target.value })} /></label>
        </div>

        {!form.gstRegistered && Number(form.defaultGstRate || 0) > 0 && (
          <div className="alert alert-warning">
            GST should normally remain 0% unless the business is GST registered and permitted to charge GST.
          </div>
        )}

        <button className="button button-primary" onClick={save}>Save settings</button>
      </article>

      <aside className="panel security-panel">
        <p className="eyebrow">DOCUMENT READINESS</p>
        <h2>Compliance checklist</h2>
        <div className="security-check"><span>✓</span><div><strong>Unique document references</strong><p>Invoices and quotations include unique numbers.</p></div></div>
        <div className="security-check"><span>✓</span><div><strong>Seller identification</strong><p>Registration number, TIN, address and contact details can be shown.</p></div></div>
        <div className="security-check"><span>✓</span><div><strong>GST breakdown</strong><p>Subtotal, discount, taxable amount, GST and total are calculated separately.</p></div></div>
        <div className="security-check"><span>✓</span><div><strong>Owner-only access</strong><p>{OWNER_EMAIL}</p></div></div>
        <p className="security-note">Final acceptance of a document depends on the receiving agency, tender instructions and your actual tax-registration status.</p>
      </aside>
    </section>
  );
}
