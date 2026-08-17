import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { DEFAULT_PLAN_SETTINGS, PLAN_DEFINITIONS, formatOfferDuration } from '../config/plans';
import { DEFAULT_BANK_ACCOUNTS } from '../config/subscriptionBanks';
import {
  approveSubscriptionRequest,
  deletePaymentMethod,
  rejectSubscriptionRequest,
  requestSubscriptionInformation,
  savePaymentMethod,
  savePlatformPlan,
  saveSubscriptionBankAccount,
  saveCustomOffer,
  deleteCustomOffer,
  setBusinessSubscriptionStatus,
  setPlatformUserStatus,
} from '../services/database';
import { getSubscriptionReceiptSignedUrl } from '../services/receiptStorage';

const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB');
};

const money = (amount, currency = 'MVR') => `${currency} ${Number(amount || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function ReceiptPreview({ storagePath }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!storagePath) return undefined;

    getSubscriptionReceiptSignedUrl(storagePath, 900)
      .then((signedUrl) => !cancelled && setUrl(signedUrl))
      .catch((reason) => !cancelled && setError(reason?.message || 'Receipt unavailable.'));

    return () => { cancelled = true; };
  }, [storagePath]);

  if (!storagePath) return null;
  if (error) return <div className="alert alert-warning">{error}</div>;
  if (!url) return <div className="super-slip-preview receipt-loading">Loading receipt…</div>;

  return (
    <a className="super-slip-preview" href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Uploaded bank transfer slip" />
      <span>Open full slip</span>
    </a>
  );
}

export default function SuperAdmin({
  businesses,
  subscriptions,
  requests,
  payments,
  platformUsers,
  plans,
  paymentMethods,
  bankAccounts,
  customOffers = [],
  notify,
  initialTab = 'verification',
}) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [review, setReview] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewForm, setReviewForm] = useState({ notes: '', startsAt: '', endsAt: '' });
  const [methodEditor, setMethodEditor] = useState(null);
  const [methodForm, setMethodForm] = useState({
    name: '', type: 'BANK_TRANSFER', instructions: '', accountLabel: '', icon: '▣', active: true,
  });
  const [bankDrafts, setBankDrafts] = useState({});
  const [offerEditor, setOfferEditor] = useState(null);
  const [offerForm, setOfferForm] = useState({ name: '', description: '', planId: 'PLATINUM', price: 0, currency: 'MVR', durationType: 'MONTHS', durationValue: 6, active: true });

  const subscriptionByBusiness = useMemo(
    () => Object.fromEntries(subscriptions.map((item) => [item.businessId || item.id, item])),
    [subscriptions],
  );

  const mergedPlans = useMemo(() => {
    const custom = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
    return DEFAULT_PLAN_SETTINGS.map((base) => ({
      ...base,
      ...(custom[base.id] || {}),
      ...PLAN_DEFINITIONS[base.id],
    }));
  }, [plans]);

  const pending = requests.filter((request) => (
    ['PENDING_VERIFICATION', 'MORE_INFO_REQUIRED', 'AUTO_REJECTED'].includes(request.status)
  ));

  const bankById = Object.fromEntries(bankAccounts.map((item) => [item.id, item]));

  const savePlanField = async (plan, field, value) => {
    try {
      await savePlatformPlan(plan.id, {
        [field]: Number(value || 0),
      });
      notify(`${plan.name} ${field === 'yearlyPrice' ? 'yearly' : 'monthly'} price saved.`);
    } catch (reason) {
      notify(reason?.message || 'Could not save plan settings.', 'error');
    }
  };

  const openReview = (request, action = 'approve') => {
    setReview(request);
    setReviewAction(action);
    setReviewForm({ notes: request.reviewMessage || '', startsAt: '', endsAt: '' });
  };

  const completeReview = async () => {
    try {
      if (reviewAction === 'approve') {
        await approveSubscriptionRequest(review, reviewForm);
        notify('Subscription verified and activated.');
      } else if (reviewAction === 'reject') {
        await rejectSubscriptionRequest(review, reviewForm.notes);
        notify('Subscription request rejected.');
      } else {
        await requestSubscriptionInformation(review, reviewForm.notes);
        notify('Information request saved.');
      }
      setReview(null);
    } catch (reason) {
      notify(reason?.message || 'Could not complete the verification.', 'error');
    }
  };

  const saveMethod = async () => {
    try {
      await savePaymentMethod(methodForm, methodEditor?.id || null);
      notify('Payment method saved.');
      setMethodEditor(null);
    } catch (reason) {
      notify(reason?.message || 'Could not save payment method.', 'error');
    }
  };

  const removeMethod = async (method) => {
    if (!window.confirm(`Delete ${method.name}?`)) return;
    try {
      await deletePaymentMethod(method.id);
      notify('Payment method removed.');
    } catch (reason) {
      notify(reason?.message || 'Could not remove payment method.', 'error');
    }
  };

  const openOffer = (offer = null) => {
    setOfferForm(offer ? {
      ...offer,
      durationValue: Number(offer.durationValue || 0),
      price: Number(offer.price || 0),
    } : { name: '', description: '', planId: 'PLATINUM', price: 0, currency: 'MVR', durationType: 'MONTHS', durationValue: 6, active: true });
    setOfferEditor(offer || {});
  };

  const saveOffer = async () => {
    try {
      await saveCustomOffer(offerForm, offerEditor?.id || null);
      notify('Custom offer saved.');
      setOfferEditor(null);
    } catch (reason) {
      notify(reason?.message || 'Could not save custom offer.', 'error');
    }
  };

  const removeOffer = async (offer) => {
    if (!window.confirm(`Delete custom offer ${offer.name}?`)) return;
    try {
      await deleteCustomOffer(offer.id);
      notify('Custom offer deleted.');
    } catch (reason) {
      notify(reason?.message || 'Could not delete custom offer.', 'error');
    }
  };


  return (
    <div className="super-admin-page">
      <section className="super-admin-hero panel">
        <div>
          <p className="eyebrow">FOUNDER / SUPER ADMIN</p>
          <h2>Small Business (SB) Control Center</h2>
          <p>Manage subscribers, payment slips, packages, banks and platform accounts. Operational business data remains tenant-isolated by Supabase Row Level Security.</p>
        </div>
        <div className="platform-kpis">
          <span><strong>{businesses.length}</strong><small>Businesses</small></span>
          <span><strong>{pending.length}</strong><small>Waiting verification</small></span>
          <span><strong>{payments.filter((item) => item.paymentStatus === 'VERIFIED').length}</strong><small>Verified payments</small></span>
        </div>
      </section>

      <nav className="settings-tabs super-admin-tabs">
        {[
          ['verification', 'Payment Verification'],
          ['subscribers', 'Businesses'],
          ['payments', 'Payments'],
          ['plans', 'Packages'],
          ['offers', 'Custom Offers'],
          ['methods', 'Payment Methods'],
          ['banks', 'Bank Accounts'],
          ['users', 'Platform Users'],
          ['migration', 'Firebase Migration'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'verification' && (
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">VERIFICATION QUEUE</p><h2>{pending.length} pending request{pending.length === 1 ? '' : 's'}</h2></div></div>
          <div className="verification-request-grid">
            {pending.map((request) => (
              <article className="verification-card" key={request.id}>
                <div><span className="status status-draft">{request.status}</span><small>{fmtDate(request.submittedAt)}</small></div>
                <h3>{request.businessName}</h3>
                <strong>{request.offerName || request.planName} · {money(request.amount, request.currency)}</strong>
                <ReceiptPreview storagePath={request.receiptStoragePath} />
                <dl>
                  <div><dt>Requester</dt><dd>{request.requesterEmail}</dd></div>
                  <div><dt>Billing</dt><dd>{request.billingPeriod || 'MONTHLY'}</dd></div>
                  <div><dt>Selected bank</dt><dd>{request.bankName || request.bankId || '—'}</dd></div>
                  <div><dt>Expected amount</dt><dd>{money(request.amount, request.currency)}</dd></div><div><dt>Detected amount</dt><dd>{request.detectedAmount ? money(request.detectedAmount, request.currency) : 'Not detected'}</dd></div>
                  <div><dt>OCR</dt><dd>{Number(request.ocrConfidence || 0).toFixed(0)}%</dd></div>
                  {request.offerName && <div><dt>Offer</dt><dd>{request.offerName} · {formatOfferDuration(request)}</dd></div>}
                </dl>
                {request.autoRejectReasons?.length > 0 && (
                  <div className="auto-reject-box"><strong>Legacy automatic issue</strong>{request.autoRejectReasons.map((item) => <small key={item}>{item}</small>)}</div>
                )}
                {request.receiptWarnings?.length > 0 && (
                  <div className="receipt-review-warnings"><strong>System review notes</strong>{request.receiptWarnings.map((item) => <small key={item}>{item}</small>)}</div>
                )}
                <div className="verification-actions">
                  <button className="button button-primary" onClick={() => openReview(request, 'approve')}>Approve & Activate</button>
                  <button className="button button-secondary" onClick={() => openReview(request, 'info')}>Request Info</button>
                  <button className="button button-ghost danger" onClick={() => openReview(request, 'reject')}>Reject</button>
                </div>
              </article>
            ))}
            {!pending.length && <div className="empty-backup-state"><span>✓</span><strong>Verification queue is clear</strong><p>New subscription requests appear here automatically.</p></div>}
          </div>
        </section>
      )}

      {tab === 'subscribers' && (
        <section className="panel"><div className="responsive-table"><table><thead><tr><th>Business</th><th>Owner</th><th>Package</th><th>Status</th><th>Ends</th><th>Action</th></tr></thead><tbody>
          {businesses.map((business) => {
            const subscription = subscriptionByBusiness[business.id] || {};
            return <tr key={business.id}>
              <td data-label="Business"><strong>{business.name}</strong><small>{business.registrationNumber || ''}</small></td>
              <td data-label="Owner">{business.ownerEmail}</td>
              <td data-label="Package">{subscription.planName || subscription.planId || 'None'}</td>
              <td data-label="Status"><span className={`status ${subscription.status === 'ACTIVE' ? 'status-paid' : 'status-draft'}`}>{subscription.status || 'NONE'}</span></td>
              <td data-label="Ends">{fmtDate(subscription.endsAt)}</td>
              <td data-label="Action">{subscription.status === 'ACTIVE'
                ? <button onClick={() => setBusinessSubscriptionStatus(business.id, 'SUSPENDED')}>Suspend</button>
                : subscription.planId ? <button onClick={() => setBusinessSubscriptionStatus(business.id, 'ACTIVE')}>Activate</button> : <span className="muted-text">No package</span>}</td>
            </tr>;
          })}
        </tbody></table></div></section>
      )}

      {tab === 'payments' && (
        <section className="panel"><div className="responsive-table"><table><thead><tr><th>Date</th><th>Business</th><th>Package</th><th>Billing</th><th>Bank</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          {payments.map((payment) => <tr key={payment.id}>
            <td data-label="Date">{fmtDate(payment.createdAt)}</td><td data-label="Business">{payment.businessName}</td><td data-label="Package">{payment.planName}</td><td data-label="Billing">{payment.billingPeriod || 'MONTHLY'}</td><td data-label="Bank">{payment.bankName || payment.bankId || '—'}</td><td data-label="Reference">{payment.detectedReference || payment.paymentReference || '—'}</td><td data-label="Amount">{money(payment.amount, payment.currency)}</td><td data-label="Status">{payment.paymentStatus}</td>
          </tr>)}
        </tbody></table></div></section>
      )}

      {tab === 'plans' && (
        <section className="plan-admin-grid">
          {mergedPlans.map((plan) => <article className="panel plan-admin-card" key={plan.id}>
            <p className="eyebrow">VIP PACKAGE</p><h3>{plan.name}</h3><p>{plan.tagline}</p>
            <label><span>Monthly price (MVR)</span><input type="number" min="0" step="0.01" defaultValue={plan.monthlyPrice || 0} onBlur={(event) => savePlanField(plan, 'monthlyPrice', event.target.value)} /></label>
            <label><span>Yearly price (MVR)</span><input type="number" min="0" step="0.01" defaultValue={plan.yearlyPrice || 0} onBlur={(event) => savePlanField(plan, 'yearlyPrice', event.target.value)} /></label>
            <ul>{plan.highlights.map((item) => <li key={item}>✓ {item}</li>)}</ul>
          </article>)}
        </section>
      )}


      {tab === 'offers' && <>
        <div className="page-actions"><div><p className="eyebrow">CUSTOM OFFERS</p><h2>Lifetime, 6-month and special subscriptions</h2><p className="page-subtitle">Create an offer, choose the access level, price and duration, then make it available to subscribers.</p></div><button className="button button-primary" onClick={() => openOffer()}>＋ Create Offer</button></div>
        <section className="special-offer-admin-grid">
          {customOffers.map((offer) => <article className="panel special-offer-admin-card" key={offer.id}>
            <div className="offer-admin-head"><span>★</span><div><small>{PLAN_DEFINITIONS[offer.planId]?.name || offer.planId}</small><h3>{offer.name}</h3></div></div>
            <p>{offer.description || 'No description'}</p>
            <div className="offer-admin-stats"><span><small>Price</small><strong>{money(offer.price, offer.currency)}</strong></span><span><small>Duration</small><strong>{formatOfferDuration(offer)}</strong></span></div>
            <div className="access-card-badges"><span className={`status ${offer.active === false ? 'status-cancelled' : 'status-paid'}`}>{offer.active === false ? 'DISABLED' : 'ACTIVE'}</span></div>
            <div className="row-actions"><button onClick={() => openOffer(offer)}>Edit</button><button className="danger" onClick={() => removeOffer(offer)}>Delete</button></div>
          </article>)}
          {!customOffers.length && <div className="panel empty-backup-state"><span>★</span><strong>No custom offers yet</strong><p>Create an offer such as “6 Months Platinum” or “Lifetime Silver”.</p></div>}
        </section>
      </>}

      {tab === 'methods' && <>
        <div className="page-actions"><div><p className="eyebrow">PAYMENT METHODS</p><h2>Subscription payment options</h2></div><button className="button button-primary" onClick={() => { setMethodForm({ name: '', type: 'BANK_TRANSFER', instructions: '', accountLabel: '', icon: '▣', active: true }); setMethodEditor({}); }}>＋ Add payment method</button></div>
        <section className="module-card-grid">{paymentMethods.map((method) => <article className="panel module-card" key={method.id}><span className="module-card-icon">{method.icon || '▣'}</span><div><h3>{method.name}</h3><p>{method.instructions || method.accountLabel || 'No instructions'}</p><small>{method.active === false ? 'Disabled' : 'Active'}</small></div><div className="row-actions"><button onClick={() => { setMethodForm({ ...method }); setMethodEditor(method); }}>Edit</button><button className="danger" onClick={() => removeMethod(method)}>Delete</button></div></article>)}</section>
      </>}

      {tab === 'banks' && (
        <section className="bank-admin-grid">
          {['BML', 'MIB'].map((bankId) => {
            const defaults = DEFAULT_BANK_ACCOUNTS[bankId] || {};
            const existing = bankById[bankId] || defaults;
            const draft = bankDrafts[bankId] || existing;
            return <article className="panel bank-admin-card" key={bankId}>
              <div className="bank-admin-head"><span className={`bank-logo bank-${bankId.toLowerCase()}`}>{bankId}</span><div><p className="eyebrow">SUBSCRIPTION BANK</p><h3>{draft.name || defaults.name}</h3></div></div>
              <label><span>Bank name</span><input value={draft.name || ''} onChange={(event) => setBankDrafts({ ...bankDrafts, [bankId]: { ...draft, bankId, name: event.target.value } })} /></label>
              <label><span>Account holder</span><input value={draft.accountName || ''} onChange={(event) => setBankDrafts({ ...bankDrafts, [bankId]: { ...draft, bankId, accountName: event.target.value } })} /></label>
              <label><span>Account number</span><input inputMode="numeric" value={draft.accountNumber || ''} onChange={(event) => setBankDrafts({ ...bankDrafts, [bankId]: { ...draft, bankId, accountNumber: event.target.value.replace(/\D/g, '') } })} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={draft.active !== false} onChange={(event) => setBankDrafts({ ...bankDrafts, [bankId]: { ...draft, bankId, active: event.target.checked } })} /><span>Accept subscription transfers</span></label>
              <button className="button button-primary" onClick={() => saveSubscriptionBankAccount(bankId, { ...draft, bankId }).then(() => notify(`${bankId} account details saved.`)).catch((reason) => notify(reason?.message || 'Could not save bank account.', 'error'))}>Save {bankId} Details</button>
            </article>;
          })}
        </section>
      )}

      {tab === 'users' && (
        <section className="panel"><div className="responsive-table"><table><thead><tr><th>Name</th><th>Email</th><th>Last Login</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {platformUsers.map((person) => <tr key={person.id}><td data-label="Name">{person.displayName || '—'}</td><td data-label="Email">{person.email}</td><td data-label="Last Login">{fmtDate(person.lastLoginAt)}</td><td data-label="Status"><span className={`status ${person.status === 'SUSPENDED' ? 'status-cancelled' : 'status-paid'}`}>{person.status || 'ACTIVE'}</span></td><td data-label="Action">{person.isSuperAdmin ? <span className="role-badge">SUPER ADMIN</span> : <button onClick={async () => { try { await setPlatformUserStatus(person.id, person.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'); notify(person.status === 'SUSPENDED' ? 'Platform user enabled.' : 'Platform user suspended.'); } catch (reason) { notify(reason?.message || 'Could not update the platform user.', 'error'); } }}>{person.status === 'SUSPENDED' ? 'Enable' : 'Suspend'}</button>}</td></tr>)}
        </tbody></table></div></section>
      )}

      {tab === 'migration' && (
        <section className="panel migration-card">
          <p className="eyebrow">FIREBASE → SUPABASE</p>
          <h2>Import the current Small Business data safely</h2>
          <p>The Supabase version does not connect to Firebase directly. Before replacing v3.1, create a Google Drive backup in the current Firebase app. After v3.2 is deployed, register your company in Supabase and restore that old backup from Company Administration → Backup & Restore.</p>
          <div className="alert alert-info">The restore service accepts the previous <strong>DF7_BUSINESS_TENANT_BACKUP_V2</strong> format and converts its Firestore timestamps into Supabase-compatible ISO dates.</div>
          <strong>Recommended order: Firebase backup → deploy Supabase → register company → restore backup → verify data.</strong>
        </section>
      )}

      {review && (
        <Modal open title={reviewAction === 'approve' ? 'Verify subscription' : reviewAction === 'reject' ? 'Reject subscription' : 'Request more information'} onClose={() => setReview(null)}>
          <div className="subscription-review-summary"><strong>{review.businessName}</strong><span>{review.planName} · {money(review.amount, review.currency)}</span><small>{review.bankName || review.bankId || 'Bank transfer'} · {review.detectedReference || 'No reference'}</small></div>
          <ReceiptPreview storagePath={review.receiptStoragePath} />
          {reviewAction === 'approve' && <div className="form-grid"><label><span>Start date (optional)</span><input type="date" value={reviewForm.startsAt} onChange={(event) => setReviewForm({ ...reviewForm, startsAt: event.target.value })} /></label><label><span>End date (optional)</span><input type="date" value={reviewForm.endsAt} onChange={(event) => setReviewForm({ ...reviewForm, endsAt: event.target.value })} /></label></div>}
          <label><span>{reviewAction === 'reject' ? 'Reason' : 'Verification notes / message'}</span><textarea rows="4" value={reviewForm.notes} onChange={(event) => setReviewForm({ ...reviewForm, notes: event.target.value })} /></label>
          <footer className="modal-actions"><button className="button button-ghost" onClick={() => setReview(null)}>Cancel</button><button className="button button-primary" onClick={completeReview}>{reviewAction === 'approve' ? 'Verify & Activate' : reviewAction === 'reject' ? 'Reject Request' : 'Save Information Request'}</button></footer>
        </Modal>
      )}


      {offerEditor && (
        <Modal open title={offerEditor.id ? 'Edit custom offer' : 'Create custom offer'} onClose={() => setOfferEditor(null)}>
          <div className="form-grid">
            <label><span>Offer name</span><input value={offerForm.name || ''} onChange={(event) => setOfferForm({ ...offerForm, name: event.target.value })} placeholder="6 Months Platinum" /></label>
            <label><span>Access level</span><select value={offerForm.planId || 'PLATINUM'} onChange={(event) => setOfferForm({ ...offerForm, planId: event.target.value })}><option value="SILVER">VIP Silver</option><option value="GOLD">VIP Gold</option><option value="PLATINUM">VIP Platinum</option></select></label>
            <label><span>Price (MVR)</span><input type="number" min="0" step="0.01" value={offerForm.price ?? 0} onChange={(event) => setOfferForm({ ...offerForm, price: event.target.value })} /></label>
            <label><span>Duration type</span><select value={offerForm.durationType || 'MONTHS'} onChange={(event) => setOfferForm({ ...offerForm, durationType: event.target.value })}><option value="DAYS">Days</option><option value="MONTHS">Months</option><option value="YEARS">Years</option><option value="LIFETIME">Lifetime</option></select></label>
            {offerForm.durationType !== 'LIFETIME' && <label><span>Duration</span><input type="number" min="1" value={offerForm.durationValue ?? 1} onChange={(event) => setOfferForm({ ...offerForm, durationValue: event.target.value })} /></label>}
            <label className="checkbox-label"><input type="checkbox" checked={offerForm.active !== false} onChange={(event) => setOfferForm({ ...offerForm, active: event.target.checked })} /><span>Offer is available to subscribers</span></label>
            <label className="form-span-2"><span>Description</span><textarea rows="4" value={offerForm.description || ''} onChange={(event) => setOfferForm({ ...offerForm, description: event.target.value })} placeholder="Special limited-time offer…" /></label>
          </div>
          <footer className="modal-actions"><button className="button button-ghost" onClick={() => setOfferEditor(null)}>Cancel</button><button className="button button-primary" onClick={saveOffer}>Save Offer</button></footer>
        </Modal>
      )}

      {methodEditor && (
        <Modal open title={methodEditor.id ? 'Edit payment method' : 'Add payment method'} onClose={() => setMethodEditor(null)}>
          <div className="form-grid">
            <label><span>Name</span><input value={methodForm.name || ''} onChange={(event) => setMethodForm({ ...methodForm, name: event.target.value })} /></label>
            <label><span>Type</span><select value={methodForm.type || 'BANK_TRANSFER'} onChange={(event) => setMethodForm({ ...methodForm, type: event.target.value })}><option value="BANK_TRANSFER">Bank Transfer</option><option value="CASH_DEPOSIT">Cash Deposit</option><option value="PAYMENT_LINK">Payment Link</option><option value="OTHER">Other</option></select></label>
            <label className="form-span-2"><span>Account / destination</span><input value={methodForm.accountLabel || ''} onChange={(event) => setMethodForm({ ...methodForm, accountLabel: event.target.value })} /></label>
            <label className="form-span-2"><span>Instructions</span><textarea rows="4" value={methodForm.instructions || ''} onChange={(event) => setMethodForm({ ...methodForm, instructions: event.target.value })} /></label>
            <label><span>Icon</span><input value={methodForm.icon || '▣'} onChange={(event) => setMethodForm({ ...methodForm, icon: event.target.value })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={methodForm.active !== false} onChange={(event) => setMethodForm({ ...methodForm, active: event.target.checked })} /><span>Active</span></label>
          </div>
          <footer className="modal-actions"><button className="button button-ghost" onClick={() => setMethodEditor(null)}>Cancel</button><button className="button button-primary" onClick={saveMethod}>Save Payment Method</button></footer>
        </Modal>
      )}
    </div>
  );
}
