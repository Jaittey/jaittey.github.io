(function(){
  const D=window.SBDB;
  const lower=(v='')=>String(v||'').trim().toLowerCase();
  async function requireClient(){
    const c=D.supa();
    if(!c) throw new Error(D.configurationError()||'Supabase client is not available.');
    return c;
  }
  async function loginGoogle(){
    const c=await requireClient();
    const redirectTo=new URL('workspace.html',window.location.href).href;
    const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
    if(error) throw error;
  }
  async function loginEmail(email,password){
    const c=await requireClient();
    const {error}=await c.auth.signInWithPassword({email:lower(email),password});
    if(error) throw error;
    D.resetBootstrap();
    const state=await D.bootstrap({requireBusiness:false});
    location.href=state.businessId?'dashboard.html':'workspace.html';
  }
  async function registerEmail(email,password,displayName=''){
    const c=await requireClient();
    const {error}=await c.auth.signUp({email:lower(email),password,options:{data:{full_name:String(displayName||'').trim()}}});
    if(error) throw error;
    alert('Account created. Check your email if email verification is enabled.');
  }
  async function logout(){
    const c=await requireClient();
    await c.auth.signOut();
    D.clearActiveBusiness();
    D.resetBootstrap();
    location.href='index.html';
  }
  window.SBAuth={loginGoogle,loginEmail,registerEmail,logout};
})();
