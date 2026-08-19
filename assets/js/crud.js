(function(){
 const collection=document.body.dataset.collection;if(!collection)return;
 const table=document.querySelector('[data-crud-table]'),add=document.querySelector('[data-add]'),search=document.querySelector('[data-search]');
 const fields=()=>JSON.parse(document.body.dataset.fields||'[]');let items=[];
 function showError(error){
   const tbody=table?.querySelector('tbody');
   if(tbody) tbody.innerHTML=`<tr><td colspan="99"><div class="data-error"><b>Could not load data from Supabase.</b><br><span>${SBUI.escape(error.message||String(error))}</span><br><small>Check your session, company workspace, Supabase secrets and RLS schema.</small></div></td></tr>`;
   SBUI.toast(error.message||'Database error','error');
 }
 async function load(){
   try{await SBDB.bootstrap({requireBusiness:true});items=await SBDB.list(collection);render();}
   catch(error){showError(error)}
 }
 function render(){
  if(!table)return;const q=(search?.value||'').toLowerCase();const rows=items.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
  const tbody=table.querySelector('tbody');if(!rows.length){tbody.innerHTML=`<tr><td colspan="99" class="empty">No records yet.</td></tr>`;return}
  tbody.innerHTML=rows.map(r=>`<tr>${fields().map(f=>`<td data-label="${SBUI.escape(f.label)}">${format(r[f.key],f)}</td>`).join('')}<td data-label="Actions"><div class="actions"><button data-edit="${SBUI.escape(r.id)}">Edit</button><button data-delete="${SBUI.escape(r.id)}">Delete</button></div></td></tr>`).join('');
  tbody.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(items.find(x=>String(x.id)===String(b.dataset.edit))));
  tbody.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this record?')){try{await SBDB.remove(collection,b.dataset.delete);SBUI.toast('Deleted');await load()}catch(e){showError(e)}}});
 }
 function format(v,f){if(f.type==='money')return SBUI.money(v);if(f.type==='date')return SBUI.date(v);if(f.type==='status')return `<span class="status ${String(v||'').toLowerCase()}">${SBUI.escape(v||'Draft')}</span>`;return SBUI.escape(v??'')}
 function open(record={}){
  const html=`<form id="crudForm" class="form-grid">${fields().filter(f=>f.edit!==false).map(f=>fieldHTML(f,record[f.key])).join('')}</form>`;
  const m=SBUI.modal(record.id?'Edit record':'Add record',html,`<button class="btn" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save</button>`);
  m.querySelector('[data-close2]').onclick=()=>m.remove();
  m.querySelector('[data-save]').onclick=async()=>{try{const fd=new FormData(m.querySelector('#crudForm')),data={};fields().filter(f=>f.edit!==false).forEach(f=>{let v=fd.get(f.key);if(f.type==='number'||f.type==='money')v=Number(v||0);if(f.key==='customPermissions')v=['true','on','1'].includes(String(v).toLowerCase());data[f.key]=v});await SBDB.save(collection,data,record.id);m.remove();SBUI.toast('Saved');await load()}catch(e){SBUI.toast(e.message,'error')}};
 }
 function fieldHTML(f,v=''){
   const wide=f.wide?'wide':'';
   if(f.type==='textarea')return `<label class="${wide}"><span>${f.label}</span><textarea name="${f.key}">${SBUI.escape(v)}</textarea></label>`;
   if(f.options)return `<label class="${wide}"><span>${f.label}</span><select name="${f.key}">${f.options.map(o=>`<option ${String(v)===String(o)?'selected':''}>${o}</option>`).join('')}</select></label>`;
   const type=f.type==='date'?'date':(f.type==='number'||f.type==='money')?'number':'text';return `<label class="${wide}"><span>${f.label}</span><input type="${type}" step="${f.type==='money'?'0.01':'any'}" name="${f.key}" value="${SBUI.escape(v)}"></label>`;
 }
 if(add)add.onclick=()=>open();if(search)search.oninput=render;window.addEventListener('DOMContentLoaded',load);
})();
