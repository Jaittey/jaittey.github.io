window.addEventListener('DOMContentLoaded',async()=>{
 try{await SBDB.bootstrap({requireBusiness:true});const names=['invoices','quotes','payments','expenses','customers','products','employees','attendance','payroll'];const data={};for(const n of names)data[n]=await SBDB.list(n);document.querySelectorAll('[data-count]').forEach(e=>e.textContent=data[e.dataset.count]?.length||0);document.querySelector('#exportAll')?.addEventListener('click',()=>SBUI.csv('small-business-export.csv',names.flatMap(n=>data[n].map(x=>({module:n,...x})))))}catch(error){SBUI.toast(error.message,'error')}
});
