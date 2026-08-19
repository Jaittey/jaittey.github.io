window.addEventListener('DOMContentLoaded',async()=>{
  const email=document.querySelector('#email'),pass=document.querySelector('#password'),msg=document.querySelector('#loginMsg');
  const show=(m,type='error')=>{msg.textContent=m||'';msg.style.color=type==='error'?'var(--danger)':'var(--success)'};
  if(!SBDB.isConfigured()) show(SBDB.configurationError());
  else {
    try{
      const state=await SBDB.bootstrap({requireBusiness:false});
      if(state.user){ location.replace(state.businessId?'dashboard.html':'workspace.html'); return; }
      show('Database connected. Sign in to continue.','success');
    }catch(e){ show(e.message); }
  }
  document.querySelector('#googleLogin').onclick=async()=>{try{show('Opening Google sign-in...','success');await SBAuth.loginGoogle()}catch(e){show(e.message)}};
  document.querySelector('#emailLogin').onclick=async()=>{try{show('Signing in...','success');await SBAuth.loginEmail(email.value,pass.value)}catch(e){show(e.message)}};
  document.querySelector('#emailRegister').onclick=async()=>{try{await SBAuth.registerEmail(email.value,pass.value);show('Account created.','success')}catch(e){show(e.message)}};
});
