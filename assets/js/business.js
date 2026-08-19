window.addEventListener('DOMContentLoaded',async()=>{
  const list=document.querySelector('#workspaceList'),form=document.querySelector('#businessForm');
  async function render(){
    try{
      const state=await SBDB.bootstrap({requireBusiness:false});
      if(!state.user){ location.replace('index.html'); return; }
      const rows=state.memberships||[];
      if(list){
        list.innerHTML=rows.map(r=>`<button class="card" data-id="${r.business_id}" data-name="${SBUI.escape(r.business_name||'Business')}"><div class="card-icon">🏢</div><h3>${SBUI.escape(r.business_name||'Business')}</h3><p>${SBUI.escape(r.role||'user')}</p></button>`).join('')||'<div class="empty">No company workspace yet. Register a business to continue.</div>';
        list.querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{try{await SBDB.selectBusiness(b.dataset.id);location.href='dashboard.html'}catch(e){SBUI.toast(e.message,'error')}});
      }
    }catch(e){
      if(list) list.innerHTML=`<div class="empty"><b>Database connection problem</b><br><span class="muted">${SBUI.escape(e.message)}</span></div>`;
      SBUI.toast(e.message,'error');
    }
  }
  if(form) form.onsubmit=async e=>{
    e.preventDefault();
    try{
      const fd=new FormData(form);
      const payload={
        name:String(fd.get('name')||'').trim(),
        registrationNumber:String(fd.get('registration')||'').trim(),
        address:String(fd.get('address')||'').trim(),
        phone:String(fd.get('phone')||'').trim(),
        email:String(fd.get('email')||'').trim(),
        currency:'MVR'
      };
      const bid=await SBDB.registerBusiness(payload);
      await SBDB.selectBusiness(bid);
      location.href='dashboard.html';
    }catch(error){ SBUI.toast(error.message||'Could not register business.','error'); }
  };
  render();
});
