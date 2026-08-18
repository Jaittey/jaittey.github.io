window.addEventListener('DOMContentLoaded',async()=>{
  const table=document.querySelector('[data-platform-table]');if(!table)return;
  try{
    const u=await SBDB.currentUser();
    if(!u||String(u.email||'').toLowerCase()!==String(SB_CONFIG.superAdminEmail||'').toLowerCase()){
      location.replace('dashboard.html');return;
    }
    const rows=await SBDB.platformList(table.dataset.platformTable),tbody=table.querySelector('tbody'),keys=JSON.parse(table.dataset.keys||'[]');
    tbody.innerHTML=rows.length
      ? rows.map(r=>`<tr>${keys.map(k=>`<td data-label="${SBUI.escape(k.label)}">${SBUI.escape(r[k.key]??'')}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${Math.max(keys.length,1)}" class="empty">No records.</td></tr>`;
  }catch(e){SBUI.toast(e.message||'Could not load Super Admin data.','error')}
});
