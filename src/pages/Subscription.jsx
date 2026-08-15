import { useMemo, useState } from 'react';
import { DEFAULT_PLAN_SETTINGS, PLAN_DEFINITIONS, formatOfferDuration, isSubscriptionActive } from '../config/plans';
import { DEFAULT_BANK_ACCOUNTS } from '../config/subscriptionBanks';
import { analyzeReceiptImage } from '../services/receiptAnalysis';
import { uploadSubscriptionReceipt } from '../services/receiptStorage';
import { submitBankTransferSubscriptionRequest } from '../services/database';

const money = (amount, currency = 'MVR') => Number(amount || 0) > 0
  ? `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : 'Price not configured';

const dateText = (value) => {
  if (!value) return 'No expiry';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
};

export default function Subscription({
  business,
  subscription,
  requests,
  plans,
  bankAccounts,
  customOffers = [],
  user,
  role,
  notify,
}) {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedOffer, setSelectedOffer] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('MONTHLY');
  const [selectedBank, setSelectedBank] = useState('BML');
  const [receiptFile, setReceiptFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const planSettings = useMemo(() => {
    const byId = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
    return DEFAULT_PLAN_SETTINGS.map((base) => ({ ...base, ...(byId[base.id] || {}), ...PLAN_DEFINITIONS[base.id] }));
  }, [plans]);

  const configuredBanks = useMemo(() => ({
    BML: { ...DEFAULT_BANK_ACCOUNTS.BML, ...(bankAccounts.find((item) => item.id === 'BML') || {}) },
    MIB: { ...DEFAULT_BANK_ACCOUNTS.MIB, ...(bankAccounts.find((item) => item.id === 'MIB') || {}) },
  }), [bankAccounts]);

  const activeOffers = useMemo(() => customOffers.filter((offer) => offer.active !== false), [customOffers]);
  const pending = requests.find((request) => request.businessId === business?.id && ['PENDING_VERIFICATION', 'MORE_INFO_REQUIRED'].includes(request.status));
  const active = isSubscriptionActive(subscription);
  const canSubscribe = role === 'administrator';
  const chosenPlan = planSettings.find((plan) => plan.id === selectedPlan);
  const chosenOffer = activeOffers.find((offer) => offer.id === selectedOffer);
  const isOffer = Boolean(chosenOffer);
  const selectedPrice = isOffer
    ? Number(chosenOffer.price || 0)
    : billingPeriod === 'YEARLY'
      ? Number(chosenPlan?.yearlyPrice || 0)
      : Number(chosenPlan?.monthlyPrice || 0);
  const selectedCurrency = isOffer ? (chosenOffer.currency || 'MVR') : (chosenPlan?.currency || 'MVR');
  const bank = configuredBanks[selectedBank];

  const resetSlip = () => { setReceiptFile(null); setAnalysis(null); setOcrProgress(0); };
  const choosePlan = (planId) => { setSelectedOffer(''); setSelectedPlan(planId); resetSlip(); };
  const chooseOffer = (offerId) => { setSelectedPlan(''); setSelectedOffer(offerId); resetSlip(); };

  const analyze = async (file) => {
    if (!file) return;
    if (!chosenPlan && !chosenOffer) {
      notify('Choose a package or special offer before uploading the slip.', 'error');
      return;
    }
    setReceiptFile(file);
    setAnalysis(null);
    setOcrProgress(0);
    setBusy(true);
    try {
      const result = await analyzeReceiptImage(file, {
        expectedAmount: selectedPrice,
        onProgress: setOcrProgress,
      });
      setAnalysis(result);
      notify('Slip uploaded and amount check completed.');
    } catch (reason) {
      notify(reason?.message || 'Could not process the transfer slip.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubscribe) return notify('Only a Company Administrator can subscribe.', 'error');
    if (!chosenPlan && !chosenOffer) return notify('Choose a package or special offer.', 'error');
    if (selectedPrice <= 0) return notify('The selected price is not configured.', 'error');
    if (!receiptFile || !analysis) return notify('Upload the bank transfer slip first.', 'error');

    setBusy(true);
    try {
      const upload = await uploadSubscriptionReceipt(receiptFile, business.id);
      await submitBankTransferSubscriptionRequest({
        business,
        plan: chosenPlan ? PLAN_DEFINITIONS[chosenPlan.id] : null,
        planSettings: chosenPlan,
        customOffer: chosenOffer || null,
        billingPeriod,
        bankAccount: bank,
        receipt: analysis,
        receiptFile,
        receiptUpload: upload,
        user,
      });
      notify('Transfer slip submitted for Super Admin verification.');
      setSelectedPlan('');
      setSelectedOffer('');
      resetSlip();
    } catch (reason) {
      notify(reason?.message || 'Could not submit the subscription payment.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectionReady = Boolean(chosenPlan || chosenOffer);

  return (
    <div className="subscription-page">
      <section className="subscription-hero panel">
        <div>
          <p className="eyebrow">SUBSCRIPTION</p>
          <h2>{business?.name || 'Business'} access</h2>
          <p>Choose a package or special offer, transfer the exact amount to BML or MIB, then upload the transfer slip. Every submission goes to the Super Admin for manual approval.</p>
        </div>
        <div className={`subscription-status-card ${active ? 'active' : ''}`}>
          <small>Current status</small>
          <strong>{subscription?.status || 'NOT SUBSCRIBED'}</strong>
          <span>{subscription?.planName || subscription?.planId || 'No active package'}</span>
          {subscription?.billingPeriod && <b>{subscription.billingPeriod}</b>}
          {active && <b>Valid until {dateText(subscription.endsAt)}</b>}
        </div>
      </section>

      {active && String(subscription?.planName || '').includes('7-Day Free Trial') && (
        <section className="trial-banner panel"><span>★</span><div><strong>7-Day Free Trial is active</strong><p>You have VIP Platinum access until {dateText(subscription.endsAt)}. You can subscribe at any time before the trial ends.</p></div></section>
      )}

      {pending && <section className="verification-banner panel"><span>◷</span><div><strong>Verification in progress</strong><p>Your transfer slip has been submitted. The Super Admin will review and approve or reject it manually.</p></div></section>}

      <section className="billing-period-picker panel">
        <div><p className="eyebrow">STANDARD PACKAGES</p><h3>Monthly or yearly</h3></div>
        <div className="segmented-control"><button className={billingPeriod === 'MONTHLY' ? 'active' : ''} onClick={() => { setBillingPeriod('MONTHLY'); resetSlip(); }}>Monthly</button><button className={billingPeriod === 'YEARLY' ? 'active' : ''} onClick={() => { setBillingPeriod('YEARLY'); resetSlip(); }}>Yearly</button></div>
      </section>

      <section className="subscription-plan-grid">
        {planSettings.map((plan) => {
          const price = billingPeriod === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
          return <article className={`subscription-plan panel tier-${plan.id.toLowerCase()}`} key={plan.id}>
            <div className="subscription-plan-head"><div><span>VIP</span><h3>{plan.name.replace('VIP ', '')}</h3><p>{plan.tagline}</p></div><strong>{money(price, plan.currency)}</strong></div>
            <ul>{plan.highlights.map((item) => <li key={item}>✓ {item}</li>)}</ul>
            <button className={`button ${selectedPlan === plan.id ? 'button-primary' : 'button-secondary'}`} disabled={!canSubscribe || Boolean(pending)} onClick={() => choosePlan(plan.id)}>{selectedPlan === plan.id ? 'Selected' : `Choose ${plan.name}`}</button>
          </article>;
        })}
      </section>

      {activeOffers.length > 0 && (
        <section className="special-offers-section">
          <div className="special-offers-heading"><p className="eyebrow">SPECIAL OFFERS</p><h2>Limited & custom subscriptions</h2><p>Offers created by the Small Business Super Admin.</p></div>
          <div className="special-offer-grid">{activeOffers.map((offer) => <article className={`panel special-offer-card ${selectedOffer === offer.id ? 'selected' : ''}`} key={offer.id}>
            <div><span className="offer-star">★</span><p className="eyebrow">CUSTOM OFFER</p></div>
            <h3>{offer.name}</h3>
            <p>{offer.description || `${offer.planId} access`}</p>
            <div className="offer-meta"><span>{PLAN_DEFINITIONS[offer.planId]?.name || offer.planId}</span><span>{formatOfferDuration(offer)}</span></div>
            <strong>{money(offer.price, offer.currency)}</strong>
            <button className={`button ${selectedOffer === offer.id ? 'button-primary' : 'button-secondary'}`} disabled={!canSubscribe || Boolean(pending)} onClick={() => chooseOffer(offer.id)}>{selectedOffer === offer.id ? 'Selected' : 'Choose Offer'}</button>
          </article>)}</div>
        </section>
      )}

      {selectionReady && <section className="subscription-checkout panel">
        <div className="panel-heading"><div><p className="eyebrow">BANK TRANSFER</p><h2>{chosenOffer ? chosenOffer.name : `${chosenPlan?.name} · ${billingPeriod}`}</h2><p className="page-subtitle">Transfer exactly the amount shown, then upload any BML or MIB transfer/deposit slip format.</p></div><strong className="checkout-total">{money(selectedPrice, selectedCurrency)}</strong></div>

        <div className="subscription-bank-grid">{['BML', 'MIB'].map((bankId) => { const account = configuredBanks[bankId]; return <button type="button" key={bankId} className={selectedBank === bankId ? 'active' : ''} onClick={() => { setSelectedBank(bankId); resetSlip(); }}><span className={`bank-logo bank-${bankId.toLowerCase()}`}>{bankId}</span><div><strong>{account.name}</strong><small>{account.accountName}</small><b>{account.accountNumber}</b></div></button>; })}</div>

        <div className="receipt-upload-zone"><label className="receipt-upload-button"><span>⇧</span><strong>{receiptFile ? receiptFile.name : 'Upload transfer / deposit slip'}</strong><small>PNG, JPG or WebP · maximum 8 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => analyze(event.target.files?.[0])} /></label>{busy && ocrProgress > 0 && <div className="ocr-progress"><div style={{ width: `${ocrProgress}%` }} /><span>Reading amount… {ocrProgress}%</span></div>}</div>

        {analysis && <div className="receipt-analysis-card risk-low"><div className="receipt-analysis-head"><div><p className="eyebrow">SLIP CHECK</p><h3>Ready for Super Admin review</h3></div><span>MANUAL</span></div><div className="receipt-detected-grid simple"><div><small>Expected amount</small><strong>{money(selectedPrice, selectedCurrency)}</strong></div><div><small>Detected amount</small><strong>{analysis.amount ? money(analysis.amount, selectedCurrency) : 'Not detected'}</strong></div></div><p className="receipt-security-note">The system checks the uploaded image for an identical duplicate and tries to read the payment amount. These checks never block submission. The Super Admin makes the final decision and can approve any uploaded slip.</p></div>}

        <div className="subscription-submit-row"><button className="button button-ghost" onClick={() => { setSelectedPlan(''); setSelectedOffer(''); resetSlip(); }}>Cancel</button><button className="button button-primary" onClick={submit} disabled={busy || !analysis}>{busy ? 'Submitting…' : 'Submit for Verification'}</button></div>
      </section>}

      {!canSubscribe && <div className="alert alert-info">Only the Company Administrator can choose or change the subscription.</div>}
    </div>
  );
}
