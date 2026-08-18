
(function(){
 function toast(message,type='success'){const e=document.createElement('div');e.className=`toast ${type}`;e.textContent=message;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)}
 function money(v){return `${SB_CONFIG.currency||'MVR'} ${Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}
 function date(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString()}
 function escape(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
 function modal(title,body,actions=''){const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close>×</button></div>${body}<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:17px">${actions}</div></div>`;document.body.appendChild(wrap);wrap.querySelector('[data-close]').onclick=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});return wrap}
 function csv(filename,rows){if(!rows.length)return toast('Nothing to export','error');const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const text=[keys.join(','),...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=filename;a.click();URL.revokeObjectURL(a.href)}
 window.SBUI={toast,money,date,escape,modal,csv};
})();
