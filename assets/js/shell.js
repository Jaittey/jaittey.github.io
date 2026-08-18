
(function(){
const NAV=[
 {id:'dashboard',label:'Main Dashboard',icon:'▦',href:'dashboard.html',children:[['Notifications','notifications.html']]},
 {id:'sales',label:'Sales & POS Dashboard',icon:'▤',href:'sales-dashboard.html',children:[['POS System','pos.html'],['Invoices','invoices.html'],['Quotations','quotations.html'],['Recurring Billing','recurring-billing.html'],['Payments','payments.html'],['Customers','customers.html'],['Inventory & Assets','inventory-assets.html'],['Contracts','contracts.html'],['Customer Statements','customer-statements.html']]},
 {id:'employees',label:'Employee Management Dashboard',icon:'♙',href:'employee-dashboard.html',children:[['Employees','employees.html'],['HR Records','hr-records.html'],['Attendance','attendance.html'],['Attendance Settings','attendance-settings.html'],['Payroll','payroll.html'],['Final Settlements','final-settlements.html']]},
 {id:'finance',label:'Financial Management Dashboard',icon:'◈',href:'financial-dashboard.html',children:[['Finance Overview','finance-overview.html'],['Income & Payments','income-payments.html'],['Expenses','expenses.html'],['Budget','budget.html'],['GST & Tax','gst-tax.html']]},
 {id:'manager',label:'Application Manager',icon:'⚙',href:'application-manager.html',children:[['Company Administration','company-administration.html'],['Users & Permissions','users-permissions.html'],['Reports & Analytics','reports.html'],['Cloud & Documents','cloud-documents.html'],['Activity Logs','activity-logs.html'],['User Preferences / Themes','preferences.html'],['Subscription & Trial','subscription.html']]},
 {id:'super',label:'Super Admin',icon:'♦',href:'super-admin.html',super:true,children:[['Businesses','super-businesses.html'],['Platform Users','super-users.html'],['Subscription Requests','super-requests.html'],['Subscription Payments','super-payments.html'],['Plans','super-plans.html'],['Custom Offers','super-offers.html'],['Bank Accounts','super-banks.html'],['Payment Verification','super-verification.html']]}
];
const page=()=>document.body.dataset.page||'';
const currentFile=()=>location.pathname.split('/').pop()||'dashboard.html';
const rootPrefix=()=>document.body.dataset.depth==='1'?'../':'';
function itemHref(href){return rootPrefix()+href}
async function userInfo(){return await SBDB.currentUser()}
async function isSuper(){const u=await userInfo();return String(u?.email||'').toLowerCase()===String(SB_CONFIG.superAdminEmail||'').toLowerCase()}
function navHTML(superAdmin){
 const cur=currentFile();
 return NAV.filter(n=>!n.super||superAdmin).map(n=>{
  const active=cur===n.href||n.children.some(x=>cur===x[1]);
  return `<div class="nav-section">
    <a class="nav-head ${active?'active':''}" href="${itemHref(n.href)}"><span>${n.icon}</span><span>${n.label}</span></a>
    <div class="nav-children">${n.children.map(([label,href])=>`<a class="nav-link ${cur===href?'active':''}" href="${itemHref(href)}">${label}</a>`).join('')}</div>
  </div>`
 }).join('')
}
async function init(){
 if(document.body.classList.contains('no-shell'))return;
 const u=await userInfo();
 const superAdmin=await isSuper();
 const app=document.querySelector('.app');
 if(!app)return;
 const sidebar=document.createElement('aside');sidebar.className='sidebar';sidebar.id='sidebar';
 sidebar.innerHTML=`<div class="brand"><img src="${rootPrefix()}assets/images/SB_Logo.png" alt="Logo"><div><strong>Small Business</strong><small>HTML v4.0</small></div></div>
 <nav class="nav">${navHTML(superAdmin)}</nav>
 <div class="sidebar-foot"><strong>${u?.user_metadata?.full_name||u?.email||'User'}</strong><small>${u?.email||'Demo mode'}</small><button class="btn btn-danger" style="width:100%;margin-top:10px" onclick="SBAuth.logout()">Sign out</button></div>`;
 app.prepend(sidebar);
 const main=document.querySelector('.main');
 const top=document.createElement('header');top.className='topbar';
 top.innerHTML=`<button class="icon-btn mobile-menu" aria-label="Menu">☰</button><div class="topbar-title"><strong>${document.title.replace(' | Small Business','')}</strong><small>${document.body.dataset.section||'Small Business'}</small></div><div class="top-actions"><a class="pill desktop-only" href="${itemHref('preferences.html')}">Theme</a><button class="icon-btn" onclick="location.reload()">↻</button></div>`;
 main.prepend(top);
 top.querySelector('.mobile-menu').onclick=()=>sidebar.classList.toggle('open');
 document.addEventListener('click',e=>{if(innerWidth<=820&&!sidebar.contains(e.target)&&!e.target.closest('.mobile-menu'))sidebar.classList.remove('open')});
 const mobile=document.createElement('nav');mobile.className='mobile-nav';mobile.innerHTML=[
  ['⌂','Home','dashboard.html'],['▤','Sales','sales-dashboard.html'],['♙','Team','employee-dashboard.html'],['◈','Finance','financial-dashboard.html'],['⚙','More','application-manager.html']
 ].map(([i,l,h])=>`<a class="${cur=currentFile(),cur===h?'active':''}" href="${itemHref(h)}"><b>${i}</b><span>${l}</span></a>`).join('');
 document.body.appendChild(mobile);
}
window.SBShell={init};
document.addEventListener('DOMContentLoaded',init);
})();
