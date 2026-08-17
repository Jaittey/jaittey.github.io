import { useEffect, useMemo, useRef, useState } from 'react';
import { ERP_NAV, PAGE_TITLES, ROLE_LABELS, normalizeRole } from '../config/erp';

const MOBILE_NAV_CANDIDATES = [
  ['dashboard','⌂','Home'],
  ['pos','●','POS'],
  ['invoices','▤','Invoices'],
  ['quotes','▧','Quotes'],
  ['attendance','◷','Attendance'],
  ['payroll','▣','Payroll'],
  ['customers','◎','Customers'],
  ['products','□','Inventory'],
  ['employees','♙','Employees'],
  ['preferences','⚙','Settings'],
];

export default function AppShell({
  page,setPage,user,role,requestLogout,driveConnected,connectDrive,disconnectDrive,
  businessName,companyLogo,businesses=[],activeBusinessId='',onBusinessChange,onRegisterBusiness,canRegisterBusiness=false,
  subscription,canAccess,isSuperAdmin=false,children,
}){
  const [openGroups,setOpenGroups]=useState(['sales']); const [drawerOpen,setDrawerOpen]=useState(false); const [profileOpen,setProfileOpen]=useState(false); const [search,setSearch]=useState(''); const profileRef=useRef(null);
  useEffect(()=>{document.body.classList.toggle('sb-mobile-drawer-open',drawerOpen);return()=>document.body.classList.remove('sb-mobile-drawer-open');},[drawerOpen]);
  useEffect(()=>{const outside=(event)=>{if(profileRef.current&&!profileRef.current.contains(event.target))setProfileOpen(false);};const esc=(event)=>{if(event.key==='Escape'){setProfileOpen(false);setDrawerOpen(false);}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',esc);};},[]);
  const normalizedRole=normalizeRole(role); const allowed=(id)=>typeof canAccess==='function'?canAccess(id):false;
  const available=ERP_NAV.map((group)=>{if(group.page)return allowed(group.page)?group:null;const kids=(group.children||[]).filter(([id])=>allowed(id));return kids.length?{...group,children:kids}:null;}).filter(Boolean);
  const searchResults=useMemo(()=>{const term=search.trim().toLowerCase();if(!term)return[];return available.flatMap((group)=>group.page?(group.label.toLowerCase().includes(term)?[[group.page,group.label]]:[]):group.children.filter(([,label])=>label.toLowerCase().includes(term))).slice(0,10);},[available,search]);
  const mobileNav=(subscription?.status==='ACTIVE'?MOBILE_NAV_CANDIDATES:[['subscription','★','Subscribe'],['preferences','⚙','Settings']]).filter(([id])=>allowed(id)).slice(0,4); const moreActive=!mobileNav.map(([id])=>id).includes(page);
  const navigate=(id)=>{setPage(id);setDrawerOpen(false);setProfileOpen(false);setSearch('');window.scrollTo({top:0,behavior:'smooth'});};
  const renderNav=()=>available.map((group)=>{if(group.page)return <button key={group.id} className={`nav-root ${page===group.page?'active':''}`} onClick={()=>navigate(group.page)}><span>{group.icon}</span><b>{group.label}</b></button>;const active=group.children.some(([id])=>id===page);const open=openGroups.includes(group.id)||active;return <div className={`nav-group ${active?'active-group':''}`} key={group.id}><button className="nav-group-toggle" onClick={()=>setOpenGroups((current)=>current.includes(group.id)?current.filter((id)=>id!==group.id):[...current,group.id])}><span>{group.icon}</span><b>{group.label}</b><i>{open?'−':'+'}</i></button>{open&&<div className="nav-children">{group.children.map(([id,label])=><button key={id} className={page===id?'active':''} onClick={()=>navigate(id)}>{label}</button>)}</div>}</div>;});
  return <div className="app-layout v21-layout v219-layout v300-layout">
    <aside className={`sidebar enterprise-sidebar mobile-navigation-drawer ${drawerOpen?'mobile-open':''}`}>
      <div className="mobile-drawer-heading"><div><small>SMALL BUSINESS (SB)</small><strong>Navigation</strong></div><button type="button" aria-label="Close navigation" onClick={()=>setDrawerOpen(false)}>×</button></div>
      <div className="sidebar-brand"><div className="sidebar-logo-surface"><img className="sidebar-company-logo" src={companyLogo||`${import.meta.env.BASE_URL}images/SB_Logo.png`} alt="Small Business"/></div><span className="sidebar-business-name">{businessName||'Business Workspace'}</span><small className="version-pill">SUPABASE v3.3.0</small></div>
      <div className="sidebar-module-search"><span>⌕</span><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Find a module"/></div>
      {searchResults.length>0&&<div className="sidebar-search-results">{searchResults.map(([id,label])=><button key={id} onClick={()=>navigate(id)}>{label}</button>)}</div>}
      <nav className="sidebar-nav enterprise-nav">{renderNav()}</nav>
    </aside>

    <div className="main-area">
      <header className="topbar enterprise-topbar compact-mobile-topbar">
        <button className="mobile-menu-button" aria-label="Open navigation" onClick={()=>{setDrawerOpen(true);setProfileOpen(false);}}>☰</button>
        <div className="topbar-title"><p className="eyebrow">SMALL BUSINESS (SB) v3.3.0</p><h1>{PAGE_TITLES[page]||'Workspace'}</h1><div className="workspace-switcher"><select value={activeBusinessId} onChange={(e)=>onBusinessChange?.(e.target.value)}>{businesses.map((item)=><option key={item.businessId} value={item.businessId}>{item.businessName||'Business'}</option>)}</select>{canRegisterBusiness&&<button type="button" onClick={onRegisterBusiness} title="Register your business">＋</button>}</div></div>
        <div className="global-search desktop-module-search"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search modules…"/>{searchResults.length>0&&<div className="search-results">{searchResults.map(([id,label])=><button key={id} onClick={()=>navigate(id)}>{label}</button>)}</div>}</div>
        <div className="topbar-actions">
          <button type="button" className={`subscription-mini ${subscription?.status==='ACTIVE'?'active':''}`} onClick={()=>navigate('subscription')}><span>★</span><b>{subscription?.planName||subscription?.planId||'Subscribe'}</b></button>
          {allowed('cloud')&&<button className={`drive-pill desktop-drive-pill ${driveConnected?'connected':''}`} onClick={driveConnected?disconnectDrive:connectDrive}><i/>{driveConnected?'Drive connected':'Connect Drive'}</button>}
          <div className="profile-menu" ref={profileRef}><button type="button" className={`profile-trigger ${profileOpen?'active':''}`} aria-label="Open profile menu" aria-expanded={profileOpen} onClick={()=>setProfileOpen((current)=>!current)}><img src={user.photoURL||`${import.meta.env.BASE_URL}icon.png`} alt="" referrerPolicy="no-referrer"/></button>
            {profileOpen&&<div className="profile-dropdown"><div className="profile-dropdown-user"><img src={user.photoURL||`${import.meta.env.BASE_URL}icon.png`} alt="" referrerPolicy="no-referrer"/><div><small>{ROLE_LABELS[normalizedRole]}</small><strong>{user.displayName||'SB User'}</strong><span>{user.email}</span></div></div>
              <button type="button" onClick={()=>navigate('preferences')}><span>⚙</span>Settings</button>
              <button type="button" onClick={()=>navigate('subscription')}><span>★</span>Subscription</button>
              {allowed('cloud')&&<button type="button" className="profile-drive-action" onClick={driveConnected?disconnectDrive:connectDrive}><span>☁</span>{driveConnected?'Disconnect Drive':'Connect Drive'}</button>}
              {normalizedRole==='administrator'&&<><button type="button" onClick={()=>navigate('settings')}><span>♜</span>Company Administration</button><button type="button" onClick={()=>navigate('users')}><span>♚</span>Company Users</button></>}
              {isSuperAdmin&&<button type="button" onClick={()=>navigate('super-admin')}><span>♦</span>Super Admin Center</button>}
              <div className="profile-dropdown-divider"/><button type="button" className="profile-signout" onClick={requestLogout}><span>↪</span>Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      <main className="content enterprise-content">{children}</main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">{mobileNav.map(([id,icon,label])=><button key={id} type="button" className={page===id?'active':''} onClick={()=>navigate(id)}><span>{icon}</span><small>{label}</small></button>)}<button type="button" className={moreActive||drawerOpen?'active':''} onClick={()=>{setDrawerOpen(true);setProfileOpen(false);}}><span>☰</span><small>More</small></button></nav>
  </div>;
}
