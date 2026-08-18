
window.addEventListener('DOMContentLoaded',async()=>{
 const list=document.querySelector('#workspaceList'),form=document.querySelector('#businessForm');
 async function render(){
  const c=SBDB.supa(),u=await SBDB.currentUser();let rows=[];
  if(c&&u){const {data,error}=await c.from('business_memberships').select('*').eq('email',String(u.email).toLowerCase()).eq('active',true);if(error)throw error;rows=data||[]}
  else rows=SBDB.read('demoBusinesses',[{business_id:'demo-business',business_name:'Demo Company',role:'administrator'}]);
  list.innerHTML=rows.map(r=>`<button class="card" data-id="${r.business_id}" data-name="${SBUI.escape(r.business_name||'Business')}"><div class="card-icon">🏢</div><h3>${SBUI.escape(r.business_name||'Business')}</h3><p>${SBUI.escape(r.role||'user')}</p></button>`).join('')||'<div class="empty">No company workspace yet.</div>';
  list.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{localStorage.setItem('sbhtml_activeBusinessId',b.dataset.id);localStorage.setItem('sbhtml_activeBusinessName',b.dataset.name);location.href='dashboard.html'})
 }
 if(form)form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),name=fd.get('name'),reg=fd.get('registration');const c=SBDB.supa(),u=await SBDB.currentUser();
  if(c&&u){const id=crypto.randomUUID();let {error}=await c.from('businesses').insert({id,name,legal_name:name,registration_number:reg,owner_id:u.id,owner_email:u.email});if(error)throw error;({error}=await c.from('business_memberships').insert({business_id:id,email:String(u.email).toLowerCase(),display_name:u.user_metadata?.full_name||'',role:'administrator',active:true,business_name:name,permissions:['*']}));if(error)throw error;localStorage.setItem('sbhtml_activeBusinessId',id)}
  else{const rows=SBDB.read('demoBusinesses',[]),id=SBDB.id();rows.push({business_id:id,business_name:name,role:'administrator'});SBDB.write('demoBusinesses',rows);localStorage.setItem('sbhtml_activeBusinessId',id)}
  localStorage.setItem('sbhtml_activeBusinessName',name);location.href='dashboard.html'};
 render();
});
