import { useMemo, useState } from 'react';
import { DEFAULT_PLAN_SETTINGS, PLAN_DEFINITIONS, isSubscriptionActive } from '../config/plans';
import { DEFAULT_BANK_ACCOUNTS } from '../config/subscriptionBanks';
import { analyzeReceiptImage } from '../services/receiptAnalysis';
import { uploadSubscriptionReceipt } from '../services/receiptStorage';
import { submitBankTransferSubscriptionRequest } from '../services/database';

const money = (amount, currency = 'MVR') => Number(amount || 0) > 0
  ? `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : 'Price not configured';
const dateText = (value) => { if (!value) return '—'; const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB'); };

export default function Subscription({ business, subscription, requests, plans, bankAccounts, user, role, notify }) {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('MONTHLY');
  const [selectedBank, setSelectedBank] = useState('BML');
  const [receiptFile, setReceiptFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ payerName: user?.displayName || '', payerContact: business?.phone || '', businessRegistrationNumber: business?.registrationNumber || '', identityReference: '', verificationNotes: '' });

  const planSettings = useMemo(() => { const byId = Object.fromEntries(plans.map((item) => [item.id, item])); return DEFAULT_PLAN_SETTINGS.map((base) => ({ ...base, ...(byId[base.id] || {}), ...PLAN_DEFINITIONS[base.id] })); }, [plans]);
  const configuredBanks = useMemo(() => ({
    BML: { ...DEFAULT_BANK_ACCOUNTS.BML, ...(bankAccounts.find((item) => item.id === 'BML') || {}) },
    MIB: { ...DEFAULT_BANK_ACCOUNTS.MIB, ...(bankAccounts.find((item) => item.id === 'MIB') || {}) },
  }), [bankAccounts]);
  const pending = requests.find((item) => item.businessId === business?.id && ['PENDING_VERIFICATION', 'MORE_INFO_REQUIRED'].includes(item.status));
  const active = isSubscriptionActive(subscription);
  const canSubscribe = role === 'administrator';
  const chosenPlan = planSettings.find((item) => item.id === selectedPlan);
  const selectedPrice = billingPeriod === 'YEARLY' ? Number(chosenPlan?.yearlyPrice || 0) : Number(chosenPlan?.monthlyPrice || 0);
  const bank = configuredBanks[selectedBank];

  const analyze = async (file) => {
    if (!file || !chosenPlan) return notify('Choose a subscription package before uploading the slip.', 'error');
    setReceiptFile(file); setAnalysis(null); setOcrProgress(0); setBusy(true);
    try {
      const result = await analyzeReceiptImage(file, { expectedBank: selectedBank, expectedAmount: selectedPrice, bankAccounts: configuredBanks, onProgress: setOcrProgress });
      setAnalysis(result);
      notify(result.automaticallyRejected ? 'Slip has validation problems. Review the detected details.' : 'Slip analyzed. Review the detected amount and reference.', result.automaticallyRejected ? 'error' : 'success');
    } catch (reason) { notify(reason?.message || 'Could not analyze the slip.', 'error'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!canSubscribe) return notify('Only a Company Administrator can subscribe.', 'error');
    if (!chosenPlan) return notify('Select a subscription package.', 'error');
    if (selectedPrice <= 0) return notify('This package price is not configured.', 'error');
    if (!receiptFile || !analysis) return notify('Upload and analyze the bank-transfer slip.', 'error');
    setBusy(true);
    try {
      const upload = await uploadSubscriptionReceipt(receiptFile, business.id);
      const result = await submitBankTransferSubscriptionRequest({ business, plan: PLAN_DEFINITIONS[chosenPlan.id], planSettings: chosenPlan, billingPeriod, bankAccount: bank, receipt: analysis, receiptFile, receiptUpload: upload, form, user });
      notify(result.status === 'AUTO_REJECTED' ? `Slip automatically rejected: ${result.reasons.join(' ')}` : 'Payment slip submitted. Super Admin verification is pending.', result.status === 'AUTO_REJECTED' ? 'error' : 'success');
      setSelectedPlan(''); setReceiptFile(null); setAnalysis(null);
    } catch (reason) { notify(reason?.message || 'Could not submit subscription payment.', 'error'); }
    finally { setBusy(false); }
  };

  return <div className="subscription-page">
    <section className="subscription-hero panel"><div><p className="eyebrow">SUBSCRIPTION</p><h2>{business?.name || 'Business'} access</h2><p>Choose monthly or yearly access, transfer to BML or MIB, and upload the bank slip for automatic checks plus Super Admin verification.</p></div><div className={`subscription-status-card ${active ? 'active' : ''}`}><small>Current status</small><strong>{subscription?.status || 'NOT SUBSCRIBED'}</strong><span>{subscription?.planName || subscription?.planId || 'No active package'}</span>{subscription?.billingPeriod && <b>{subscription.billingPeriod}</b>}{active && <b>Valid until {dateText(subscription.endsAt)}</b>}</div></section>
    {pending && <section className="verification-banner panel"><span>◷</span><div><strong>Verification in progress</strong><p>Your payment slip is waiting for Super Admin review.</p></div></section>}
    <section className="billing-period-picker panel"><div><p className="eyebrow">BILLING PERIOD</p><h3>Monthly or yearly</h3></div><div className="segmented-control"><button className={billingPeriod === 'MONTHLY' ? 'active' : ''} onClick={() => { setBillingPeriod('MONTHLY'); setAnalysis(null); }}>Monthly</button><button className={billingPeriod === 'YEARLY' ? 'active' : ''} onClick={() => { setBillingPeriod('YEARLY'); setAnalysis(null); }}>Yearly</button></div></section>
    <section className="subscription-plan-grid">{planSettings.map((plan) => { const price = billingPeriod === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice; return <article className={`subscription-plan panel tier-${plan.id.toLowerCase()}`} key={plan.id}><div className="subscription-plan-head"><div><span>VIP</span><h3>{plan.name.replace('VIP ', '')}</h3><p>{plan.tagline}</p></div><strong>{money(price, plan.currency)}</strong></div><ul>{plan.highlights.map((item) => <li key={item}>✓ {item}</li>)}</ul><button className={`button ${selectedPlan === plan.id ? 'button-primary' : 'button-secondary'}`} disabled={!canSubscribe || Boolean(pending)} onClick={() => { setSelectedPlan(plan.id); setAnalysis(null); }}>{subscription.planId === plan.id && active ? 'Current package' : `Choose ${plan.name}`}</button></article>; })}</section>
    {selectedPlan && <section className="subscription-checkout panel"><div className="panel-heading"><div><p className="eyebrow">BANK TRANSFER</p><h2>{chosenPlan?.name} · {billingPeriod}</h2><p className="page-subtitle">Transfer exactly the subscription amount, then upload the bank slip.</p></div><strong className="checkout-total">{money(selectedPrice, chosenPlan?.currency)}</strong></div>
      <div className="subscription-bank-grid">{['BML', 'MIB'].map((bankId) => { const account = configuredBanks[bankId]; return <button type="button" key={bankId} className={selectedBank === bankId ? 'active' : ''} onClick={() => { setSelectedBank(bankId); setAnalysis(null); }}><span className={`bank-logo bank-${bankId.toLowerCase()}`}>{bankId}</span><div><strong>{account.name}</strong><small>{account.accountName}</small><b>{account.accountNumber}</b></div></button>; })}</div>
      <div className="receipt-upload-zone"><label className="receipt-upload-button"><span>⇧</span><strong>{receiptFile ? receiptFile.name : 'Upload bank-transfer slip'}</strong><small>PNG, JPG or WebP · maximum 8 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => analyze(e.target.files?.[0])} /></label>{busy && ocrProgress > 0 && <div className="ocr-progress"><div style={{ width: `${ocrProgress}%` }} /><span>Reading slip… {ocrProgress}%</span></div>}</div>
      {analysis && <div className={`receipt-analysis-card risk-${analysis.riskLevel.toLowerCase()}`}><div className="receipt-analysis-head"><div><p className="eyebrow">AUTOMATIC SLIP CHECK</p><h3>{analysis.automaticallyRejected ? 'Validation failed' : analysis.riskLevel === 'REVIEW' ? 'Manual review required' : 'Pre-check passed'}</h3></div><span>{analysis.riskLevel}</span></div><div className="receipt-detected-grid"><div><small>Detected bank</small><strong>{analysis.bankId || 'Unknown'}</strong></div><div><small>Detected amount</small><strong>MVR {Number(analysis.amount || 0).toFixed(2)}</strong></div><div><small>Reference</small><strong>{analysis.reference || 'Not found'}</strong></div><div><small>OCR confidence</small><strong>{Number(analysis.ocrConfidence || 0).toFixed(0)}%</strong></div></div>{analysis.reasons?.length > 0 && <ul className="receipt-errors">{analysis.reasons.map((reason) => <li key={reason}>× {reason}</li>)}</ul>}{analysis.warnings?.length > 0 && <ul className="receipt-warnings">{analysis.warnings.map((warning) => <li key={warning}>! {warning}</li>)}</ul>}<p className="receipt-security-note">Automatic checks detect duplicates and visible inconsistencies. Final authenticity is confirmed manually by the Super Admin against the bank transaction.</p></div>}
      <div className="form-grid subscription-form"><label><span>Payer / account name</span><input value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} /></label><label><span>Contact number</span><input value={form.payerContact} onChange={(e) => setForm({ ...form, payerContact: e.target.value })} /></label><label><span>Business registration number</span><input value={form.businessRegistrationNumber} onChange={(e) => setForm({ ...form, businessRegistrationNumber: e.target.value })} /></label><label><span>Identity / verification reference</span><input value={form.identityReference} onChange={(e) => setForm({ ...form, identityReference: e.target.value })} /></label><label className="form-span-2"><span>Notes</span><textarea rows="3" value={form.verificationNotes} onChange={(e) => setForm({ ...form, verificationNotes: e.target.value })} /></label></div>
      <div className="subscription-submit-row"><button className="button button-ghost" onClick={() => { setSelectedPlan(''); setAnalysis(null); }}>Cancel</button><button className="button button-primary" onClick={submit} disabled={busy || !analysis}>{busy ? 'Processing…' : analysis?.automaticallyRejected ? 'Submit Rejected Slip for Record' : 'Submit for Verification'}</button></div>
    </section>}
  </div>;
}
