
window.addEventListener('DOMContentLoaded',async()=>{
 const form=document.querySelector('#companyForm');if(!form)return;const s=(await SBDB.get('settings','business'))||{};
 Object.keys(s).forEach(k=>{if(form.elements[k]&&typeof s[k]!=='object')form.elements[k].value=s[k]??''});
 form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),data=Object.fromEntries(fd.entries());await SBDB.save('settings',data,'business');SBUI.toast('Company settings saved')};
 document.querySelectorAll('[data-image-field]').forEach(inp=>inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{await SBDB.save('settings',{[inp.dataset.imageField]:r.result},'business');document.querySelector(`[data-preview="${inp.dataset.imageField}"]`).src=r.result;SBUI.toast('Image saved')};r.readAsDataURL(f)});
 ['companyLogoDataUrl','companyStampDataUrl','managerSignatureDataUrl'].forEach(async k=>{const x=(await SBDB.get('settings','business'))?.[k];const p=document.querySelector(`[data-preview="${k}"]`);if(x&&p)p.src=x})
});
