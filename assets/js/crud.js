
(function(){
 const page=document.body.dataset.page;
 const collection=document.body.dataset.collection;
 if(!collection)return;
 const table=document.querySelector('[data-crud-table]');
 const add=document.querySelector('[data-add]');
 const search=document.querySelector('[data-search]');
 const fields=()=>JSON.parse(document.body.dataset.fields||'[]');
 let items=[];
 async function load(){try{items=await SBDB.list(collection);render()}catch(e){SBUI.toast(e.message||'Could not load records.','error');if(table?.querySelector('tbody'))table.querySelector('tbody').innerHTML='<tr><td colspan="99" class="empty">Unable to load records.</td></tr>'}}
 function render(){
  if(!table)return;const q=(search?.value||'').toLowerCase();const rows=items.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
  const tbody=table.querySelector('tbody');if(!rows.length){tbody.innerHTML=`<tr><td colspan="99" class="empty">No records yet.</td></tr>`;return}
  tbody.innerHTML=rows.map(r=>`<tr>${fields().map(f=>`<td data-label="${SBUI.escape(f.label)}">${format(r[f.key],f)}</td>`).join('')}<td data-label="Actions"><div class="actions"><button data-edit="${r.id}">Edit</button><button data-delete="${r.id}">Delete</button></div></td></tr>`).join('');
  tbody.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>open(items.find(x=>x.id===b.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this record?')){await SBDB.remove(collection,b.dataset.delete);SBUI.toast('Deleted');load()}});
 }
 function format(v,f){if(f.type==='money')return SBUI.money(v);if(f.type==='date')return SBUI.date(v);if(f.type==='status')return `<span class="status ${String(v||'').toLowerCase()}">${SBUI.escape(v||'Draft')}</span>`;return SBUI.escape(v??'')}
 function open(record={}){
  const html=`<form id="crudForm" class="form-grid">${fields().filter(f=>f.edit!==false).map(f=>fieldHTML(f,record[f.key])).join('')}</form>`;
  const m=SBUI.modal(record.id?'Edit record':'Add record',html,`<button class="btn" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save</button>`);
  m.querySelector('[data-close2]').onclick=()=>m.remove();
  m.querySelector('[data-save]').onclick=async()=>{const fd=new FormData(m.querySelector('#crudForm')),data={};fields().filter(f=>f.edit!==false).forEach(f=>{let v=fd.get(f.key);if(f.type==='number'||f.type==='money')v=Number(v||0);data[f.key]=v});try{await SBDB.save(collection,data,record.id);m.remove();SBUI.toast('Saved');load()}catch(e){SBUI.toast(e.message||'Could not save record.','error')}};
 }
 function fieldHTML(f,v=''){const wide=f.wide?'wide':'';if(f.type==='textarea')return `<label class="${wide}"><span>${f.label}</span><textarea name="${f.key}">${SBUI.escape(v)}</textarea></label>`;if(f.options)return `<label class="${wide}"><span>${f.label}</span><select name="${f.key}">${f.options.map(o=>`<option ${String(v)===String(o)?'selected':''}>${o}</option>`).join('')}</select></label>`;const type=f.type==='date'?'date':(f.type==='number'||f.type==='money')?'number':'text';return `<label class="${wide}"><span>${f.label}</span><input type="${type}" step="${f.type==='money'?'0.01':'any'}" name="${f.key}" value="${SBUI.escape(v)}"></label>`}
 if(add)add.onclick=()=>open();if(search)search.oninput=render;
 window.addEventListener('DOMContentLoaded',load);
})();
