window.addEventListener('DOMContentLoaded',async()=>{
  const list=document.querySelector('#workspaceList'),form=document.querySelector('#businessForm');
  const errorBox=(message)=>{if(window.SBUI)SBUI.toast(message,'error');else alert(message)};

  async function render(){
    if(!list)return;
    try{
      const u=await SBAuth.requireUser();if(!u)return;
      const rows=await SBDB.memberships();
      let ownsBusiness=false;
      if(SBDB.supa()){
        const {data:owned,error:ownedError}=await SBDB.supa().from('businesses').select('id').eq('owner_id',u.id).limit(1);
        if(ownedError)throw ownedError;
        ownsBusiness=Boolean(owned?.length);
      }else ownsBusiness=rows.some(x=>x.owner_id===u.id||x.role==='administrator');
      list.innerHTML=rows.map(r=>`<button class="card workspace-card" data-id="${r.business_id}" data-name="${SBUI.escape(r.business_name||'Business')}"><div class="card-icon">🏢</div><h3>${SBUI.escape(r.business_name||'Business')}</h3><p>${SBUI.escape(r.role||'user')}</p><span class="workspace-open">Open workspace →</span></button>`).join('')||'<div class="empty">No company workspace yet. Register your business to continue.</div>';
      list.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{SBDB.setActiveBusiness(b.dataset.id,b.dataset.name);location.href='dashboard.html'});
      const registerLink=document.querySelector('[data-register-business-link]');
      if(registerLink&&ownsBusiness)registerLink.classList.add('hidden');
    }catch(e){list.innerHTML=`<div class="alert error">${SBUI.escape(e.message)}</div>`}
  }

  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Creating workspace…';
    try{
      const u=await SBAuth.requireUser();if(!u)return;
      const fd=new FormData(form);
      const payload={
        name:String(fd.get('name')||'').trim(),
        legalName:String(fd.get('name')||'').trim(),
        registrationNumber:String(fd.get('registration')||'').trim(),
        address:String(fd.get('address')||'').trim(),
        email:u.email||'',currency:'MVR'
      };
      if(!payload.name)throw new Error('Business name is required.');
      let businessId;
      if(SBDB.supa())businessId=await SBDB.rpc('sb_register_business',{p_form:payload});
      else{
        const rows=SBDB.read('demoBusinesses',[]);businessId=SBDB.id();rows.push({business_id:businessId,business_name:payload.name,role:'administrator',active:true});SBDB.write('demoBusinesses',rows);
      }
      SBDB.setActiveBusiness(businessId,payload.name);location.href='dashboard.html';
    }catch(e){errorBox(e.message||'Could not create the business workspace.');button.disabled=false;button.textContent='Create Workspace'}
  };
  render();
});
