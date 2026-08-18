
window.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{SBTheme.apply(b.dataset.theme);SBUI.toast(`Theme changed to ${b.dataset.theme}`)});
 const f=document.querySelector('#customThemeForm');if(f){const c=SBTheme.getCustom();Object.keys(c).forEach(k=>{if(f.elements[k])f.elements[k].value=c[k]});f.onsubmit=e=>{e.preventDefault();const fd=new FormData(f),data=Object.fromEntries(fd.entries());SBTheme.saveCustom(data);SBUI.toast('Custom theme saved')}}});
