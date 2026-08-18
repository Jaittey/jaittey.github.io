
window.addEventListener('DOMContentLoaded',async()=>{
 const table=document.querySelector('[data-platform-table]');if(!table)return;try{const rows=await SBDB.platformList(table.dataset.platformTable);const tbody=table.querySelector('tbody');const keys=JSON.parse(table.dataset.keys||'[]');tbody.innerHTML=rows.length?rows.map(r=>`<tr>${keys.map(k=>`<td data-label="${SBUI.escape(k.label)}">${SBUI.escape(r[k.key]??'')}</td>`).join('')}</tr>`).join('):'<tr><td class="empty">No records.</td></tr>'}catch(e){SBUI.toast(e.message,'error')}})
