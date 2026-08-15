import { useState } from 'react';
import { registerBusiness } from '../services/database';

const blank = { name: '', legalName: '', registrationNumber: '', address: '', phone: '', email: '', currency: 'MVR', industry: '' };

export default function BusinessOnboarding({ user, memberships, canRegisterBusiness = true, onSelectBusiness, onOpenSuperAdmin, notify, isSuperAdmin }) {
  const [form, setForm] = useState({ ...blank, email: user?.email || '' });
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const businessId = await registerBusiness(user, form);
      localStorage.setItem('sb-active-business', businessId);
      notify(isSuperAdmin ? 'Business created with complimentary VIP Platinum access.' : 'Business registered. Choose a subscription package to activate business modules.');
      setTimeout(() => window.location.reload(), 500);
    } catch (reason) { notify(reason?.message || 'Could not register the business.', 'error'); }
    finally { setBusy(false); }
  };
  return <main className="saas-onboarding"><section className="saas-onboarding-card panel">
    <div className="saas-brand-lockup"><img src={`${import.meta.env.BASE_URL}images/SB_Logo.png`} alt="Small Business"/><div><p className="eyebrow">SMALL BUSINESS (SB) v3.2</p><h1>Register your business</h1><p>Each account can use one business with one subscription. Your company data stays separate from every other business.</p></div></div>
    {onOpenSuperAdmin&&<button type="button" className="button button-secondary super-admin-onboarding-button" onClick={onOpenSuperAdmin}>♦ Open Super Admin Center</button>}
    {memberships.length > 0 && <section className="existing-workspaces"><h2>Your existing businesses</h2><div className="workspace-choice-grid">{memberships.map((m)=><button type="button" key={m.businessId} onClick={()=>onSelectBusiness(m.businessId)}><span>◆</span><div><strong>{m.businessName || 'Business workspace'}</strong><small>{m.role || 'member'}</small></div><b>Open</b></button>)}</div></section>}
    {canRegisterBusiness&&<form className="business-registration-form" onSubmit={submit}><div className="section-heading"><p className="eyebrow">REGISTER NEW BUSINESS</p><h2>Company information</h2></div><div className="form-grid">
      <label><span>Business name *</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label>
      <label><span>Legal name</span><input value={form.legalName} onChange={(e)=>setForm({...form,legalName:e.target.value})}/></label>
      <label><span>Registration number</span><input value={form.registrationNumber} onChange={(e)=>setForm({...form,registrationNumber:e.target.value})}/></label>
      <label><span>Industry</span><input value={form.industry} onChange={(e)=>setForm({...form,industry:e.target.value})} placeholder="Security, retail, services…"/></label>
      <label className="form-span-2"><span>Address</span><textarea rows="3" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></label>
      <label><span>Phone</span><input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label>
      <label><span>Company email</span><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>
      <label><span>Currency</span><input value={form.currency} onChange={(e)=>setForm({...form,currency:e.target.value.toUpperCase()})}/></label>
    </div><div className="onboarding-role-note"><span>♚</span><div><strong>You become the Company Administrator.</strong><p>You can configure the company, choose a subscription and add users after registration.</p></div></div><button className="button button-primary onboarding-submit" disabled={busy}>{busy?'Creating secure workspace…':'Register Business'}</button></form>}
    {!canRegisterBusiness&&<div className="alert alert-info">This account already owns a registered business. Each account can own one business with one subscription; invited company memberships can still appear above.</div>}
  </section></main>;
}
