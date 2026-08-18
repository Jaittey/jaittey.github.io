(function(){
const NAV=[
 {id:'dashboard',label:'Main Dashboard',icon:'▦',href:'dashboard.html',children:[['Notifications','notifications.html','notifications']]},
 {id:'sales',label:'Sales & POS Dashboard',icon:'▤',href:'sales-dashboard.html',children:[['POS System','pos.html','products'],['Invoices','invoices.html','invoices'],['Quotations','quotations.html','quotes'],['Recurring Billing','recurring-billing.html','billing'],['Payments','payments.html','payments'],['Customers','customers.html','customers'],['Inventory & Assets','inventory-assets.html','products'],['Contracts','contracts.html','contracts'],['Customer Statements','customer-statements.html','statements']]},
 {id:'employees',label:'Employee Management Dashboard',icon:'♙',href:'employee-dashboard.html',children:[['Employees','employees.html','employees'],['HR Records','hr-records.html','employees'],['Attendance','attendance.html','attendance'],['Attendance Settings','attendance-settings.html','attendance-settings'],['Payroll','payroll.html','payroll'],['Final Settlements','final-settlements.html','payroll']]},
 {id:'finance',label:'Financial Management Dashboard',icon:'◈',href:'financial-dashboard.html',children:[['Finance Overview','finance-overview.html','finance'],['Income & Payments','income-payments.html','payments'],['Expenses','expenses.html','expenses'],['Budget','budget.html','budget'],['GST & Tax','gst-tax.html','tax']]},
 {id:'manager',label:'Application Manager',icon:'⚙',href:'application-manager.html',children:[['Company Administration','company-administration.html','settings'],['Users & Permissions','users-permissions.html','users'],['Reports & Analytics','reports.html','reports'],['Cloud & Documents','cloud-documents.html','cloud'],['Activity Logs','activity-logs.html','activity'],['User Preferences / Themes','preferences.html','preferences'],['Subscription & Trial','subscription.html','subscription']]},
 {id:'super',label:'Super Admin',icon:'♦',href:'super-admin.html',super:true,children:[['Businesses','super-businesses.html','super-admin'],['Platform Users','super-users.html','super-admin'],['Subscription Requests','super-requests.html','super-admin'],['Subscription Payments','super-payments.html','super-admin'],['Plans','super-plans.html','super-admin'],['Custom Offers','super-offers.html','super-admin'],['Bank Accounts','super-banks.html','super-admin'],['Payment Verification','super-verification.html','super-admin']]}
];
const cur=()=>location.pathname.split('/').pop()||'dashboard.html';
const publicPages=new Set(['index.html','workspace.html','register-business.html','offline.html','404.html']);
const defaultUser=new Set(['dashboard','quotes','invoices','customers','products','employees','attendance','payroll','preferences','subscription']);
const planFeatures={
 SILVER:new Set(['dashboard','quotes','invoices','customers','products','preferences','subscription']),
 GOLD:new Set(['dashboard','quotes','invoices','billing','payments','customers','contracts','statements','products','employees','attendance','attendance-settings','payroll','preferences','subscription']),
 PLATINUM:new Set(['dashboard','quotes','invoices','billing','payments','customers','contracts','statements','products','employees','attendance','attendance-settings','payroll','finance','expenses','budget','tax','reports','cloud','notifications','preferences','subscription'])
};
function subscriptionActive(s){if(!s||String(s.status||'').toUpperCase()!=='ACTIVE')return false;if(!s.ends_at)return true;return new Date(s.ends_at).getTime()>Date.now()}
function roleCan(m,feature){
 if(feature==='preferences'||feature==='subscription')return true;
 if(!m)return false;
 const role=String(m.role||'user').toLowerCase();
 if(role==='administrator')return true;
 if(m.custom_permissions===true)return Array.isArray(m.permissions)&&m.permissions.includes(feature);
 if(role==='manager')return !['settings','users','activity','super-admin'].includes(feature);
 return defaultUser.has(feature);
}
function planCan(s,feature){if(['preferences','subscription','settings','users','activity'].includes(feature))return true;if(!subscriptionActive(s))return false;return (planFeatures[String(s.plan_id||'').toUpperCase()]||new Set()).has(feature)}
function fileFeature(file){
 for(const n of NAV){if(n.href===file)return n.id==='manager'?'settings':n.id;if(n.children){const found=n.children.find(x=>x[1]===file);if(found)return found[2]}}
 return 'dashboard';
}
async function init(){
 if(document.body.classList.contains('no-shell'))return;
 const file=cur(),user=await SBDB.currentUser();
 if(!user){location.replace('index.html');return}
 await SBDB.claimMembership();
 const superAdmin=String(user.email||'').toLowerCase()===String(SB_CONFIG.superAdminEmail||'').toLowerCase();
 const memberships=await SBDB.memberships();
 let businessId=SBDB.activeBusiness();
 if(businessId&&!memberships.some(x=>x.business_id===businessId)){SBDB.setActiveBusiness('');businessId=''}
 if(!businessId&&memberships.length===1){SBDB.setActiveBusiness(memberships[0].business_id,memberships[0].business_name||'');businessId=memberships[0].business_id}
 if(!publicPages.has(file)&&!businessId&&!(superAdmin&&file.startsWith('super-'))){location.replace('workspace.html');return}
 const membership=memberships.find(x=>x.business_id===businessId)||null;
 const subscription=businessId?await SBDB.subscription():null;
 const feature=fileFeature(file);
 if(!publicPages.has(file)&&!superAdmin&&(!roleCan(membership,feature)||!planCan(subscription,feature))){
   location.replace(subscriptionActive(subscription)?'dashboard.html':'subscription.html');return;
 }
 const app=document.querySelector('.app');if(!app)return;
 const allowed=(f)=>superAdmin||((roleCan(membership,f))&&planCan(subscription,f));
 function navHTML(){return NAV.filter(n=>!n.super||superAdmin).map(n=>{
   const children=(n.children||[]).filter(x=>allowed(x[2]));
   const headAllowed=n.super?superAdmin:(n.id==='dashboard'?allowed('dashboard'):children.length>0);
   if(!headAllowed)return'';
   const active=cur()===n.href||children.some(x=>cur()===x[1]);
   const target=n.id==='dashboard'?n.href:(children[0]?.[1]||n.href);
   return `<div class="nav-section"><a class="nav-head ${active?'active':''}" href="${target}"><span>${n.icon}</span><span>${n.label}</span></a><div class="nav-children">${children.map(([label,href])=>`<a class="nav-link ${cur()===href?'active':''}" href="${href}">${label}</a>`).join('')}</div></div>`
 }).join('')}
 const overlay=document.createElement('div');overlay.className='sidebar-overlay';document.body.appendChild(overlay);
 const sidebar=document.createElement('aside');sidebar.className='sidebar';sidebar.id='sidebar';
 sidebar.innerHTML=`<div class="brand"><img src="assets/images/SB_Logo.png" alt="Small Business"><div><strong>Small Business</strong><small>HTML v4.0.1</small></div></div><nav class="nav">${navHTML()}</nav>`;
 app.prepend(sidebar);
 const main=document.querySelector('.main'),top=document.createElement('header');top.className='topbar';
 const businessName=localStorage.getItem('sbhtml_activeBusinessName')||membership?.business_name||'Company Workspace';
 top.innerHTML=`<button class="icon-btn mobile-menu" aria-label="Open menu">☰</button><div class="topbar-title"><strong>${document.title.replace(' | Small Business','')}</strong><small>${SBUI.escape(businessName)}</small></div><div class="top-actions"><a class="pill desktop-only" href="preferences.html">Theme</a><div class="profile-menu-wrap"><button class="profile-button" aria-label="Profile">${SBUI.escape((user.user_metadata?.full_name||user.email||'U').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</button><div class="profile-dropdown"><strong>${SBUI.escape(user.user_metadata?.full_name||user.email||'User')}</strong><small>${SBUI.escape(user.email||'')}</small><a href="workspace.html">Switch business</a><a href="preferences.html">Themes</a>${superAdmin?'<a href="super-admin.html">Super Admin</a>':''}<button data-signout>Sign out</button></div></div></div>`;
 main.prepend(top);
 const openMenu=()=>{sidebar.classList.add('open');overlay.classList.add('show');document.body.classList.add('menu-open')};
 const closeMenu=()=>{sidebar.classList.remove('open');overlay.classList.remove('show');document.body.classList.remove('menu-open')};
 top.querySelector('.mobile-menu').onclick=openMenu;overlay.onclick=closeMenu;
 sidebar.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
 const profileButton=top.querySelector('.profile-button'),dropdown=top.querySelector('.profile-dropdown');profileButton.onclick=e=>{e.stopPropagation();dropdown.classList.toggle('open')};
 dropdown.querySelector('[data-signout]').onclick=()=>{if(confirm('Sign out of Small Business?'))SBAuth.logout()};
 document.addEventListener('click',e=>{if(!e.target.closest('.profile-menu-wrap'))dropdown.classList.remove('open')});
 const mobile=document.createElement('nav');mobile.className='mobile-nav';
 const moreHref=membership&&String(membership.role||'').toLowerCase()==='administrator'?'application-manager.html':'preferences.html';
 const mobileItems=[['⌂','Home','dashboard.html','dashboard'],['▤','Sales','sales-dashboard.html','invoices'],['♙','Team','employee-dashboard.html','employees'],['◈','Finance','financial-dashboard.html','finance'],['⚙','More',moreHref,'preferences']].filter(x=>allowed(x[3]));
 mobile.innerHTML=mobileItems.map(([i,l,h])=>`<a class="${cur()===h?'active':''}" href="${h}"><b>${i}</b><span>${l}</span></a>`).join('');document.body.appendChild(mobile);
}
window.SBShell={init};
document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);SBUI?.toast(e.message||'Application initialization failed.','error')}));
})();
