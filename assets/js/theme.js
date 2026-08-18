
(function(){
  const key='sbhtml_theme';
  const customKey='sbhtml_customTheme';
  function apply(name){
    document.documentElement.dataset.theme=name||'royal';
    localStorage.setItem(key,name||'royal');
    if(name==='custom') applyCustom(JSON.parse(localStorage.getItem(customKey)||'{}'));
  }
  function applyCustom(c={}){
    const root=document.documentElement;
    const map={bg:'--bg',surface:'--surface',panel:'--panel',panel2:'--panel2',text:'--text',muted:'--muted',accent:'--accent',accent2:'--accent2'};
    Object.entries(map).forEach(([k,v])=>{if(c[k])root.style.setProperty(v,c[k])});
  }
  function saveCustom(c){localStorage.setItem(customKey,JSON.stringify(c));apply('custom')}
  apply(localStorage.getItem(key)||'royal');
  window.SBTheme={apply,saveCustom,get:()=>localStorage.getItem(key)||'royal',getCustom:()=>JSON.parse(localStorage.getItem(customKey)||'{}')};
})();
