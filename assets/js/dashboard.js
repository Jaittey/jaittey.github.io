window.addEventListener('DOMContentLoaded',async()=>{
 try{
  await SBDB.bootstrap({requireBusiness:true});
  const collections=['invoices','expenses','customers','products','employees','payments'];
  const [invoices,expenses,customers,products,employees]=await Promise.all(collections.map(x=>SBDB.list(x)));
  const revenue=invoices.filter(x=>String(x.status).toUpperCase()==='PAID').reduce((s,x)=>s+Number(x.total||x.amount||0),0);
  const expense=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const values={revenue,expense,profit:revenue-expense,customers:customers.length,products:products.length,employees:employees.length};
  Object.entries(values).forEach(([k,v])=>{const e=document.querySelector(`[data-stat="${k}"]`);if(e)e.textContent=['revenue','expense','profit'].includes(k)?SBUI.money(v):v});
  const tbody=document.querySelector('#recentInvoices tbody');if(tbody){const rows=[...invoices].slice(-6).reverse();tbody.innerHTML=rows.length?rows.map(x=>`<tr><td data-label="Invoice">${SBUI.escape(x.invoiceNumber||x.id)}</td><td data-label="Customer">${SBUI.escape(x.customerName||'Walk-in')}</td><td data-label="Total">${SBUI.money(x.total||x.amount)}</td><td data-label="Status"><span class="status ${String(x.status||'draft').toLowerCase()}">${SBUI.escape(x.status||'Draft')}</span></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No invoices yet.</td></tr>'}
 }catch(error){
  SBUI.toast(error.message||'Could not load dashboard data.','error');
  const tbody=document.querySelector('#recentInvoices tbody');if(tbody)tbody.innerHTML=`<tr><td colspan="4"><div class="data-error"><b>Database error</b><br>${SBUI.escape(error.message||String(error))}</div></td></tr>`;
 }
});
