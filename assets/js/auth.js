(function(){
  const D=window.SBDB;
  const absolute=(file)=>new URL(file,document.baseURI).href;

  async function loginGoogle(){
    const c=D.supa();
    if(!c){D.write('demoUser',{id:'demo-user',email:'demo@example.com',user_metadata:{full_name:'Demo User'}});location.href='workspace.html';return}
    const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:absolute('workspace.html')}});
    if(error)throw error;
  }
  async function loginEmail(email,password){
    const c=D.supa();
    if(!c){D.write('demoUser',{id:'demo-user',email,user_metadata:{full_name:(email||'Demo').split('@')[0]}});location.href='workspace.html';return}
    const {error}=await c.auth.signInWithPassword({email:String(email||'').trim(),password});
    if(error)throw error;
    await D.claimMembership();
    location.href='workspace.html';
  }
  async function registerEmail(email,password){
    const c=D.supa();
    if(!c){D.write('demoUser',{id:'demo-user',email,user_metadata:{full_name:(email||'Demo').split('@')[0]}});location.href='register-business.html';return}
    const {data,error}=await c.auth.signUp({email:String(email||'').trim(),password,options:{emailRedirectTo:absolute('workspace.html')}});
    if(error)throw error;
    if(data.session){await D.claimMembership();location.href='workspace.html';return}
    alert('Account created. Check your email to confirm the account, then sign in.');
  }
  async function logout(){
    const c=D.supa();if(c)await c.auth.signOut();
    localStorage.removeItem('sbhtml_demoUser');
    D.setActiveBusiness('');
    location.href='index.html';
  }
  async function requireUser(){
    const u=await D.currentUser();
    if(!u){location.replace('index.html');return null}
    return u;
  }
  window.SBAuth={loginGoogle,loginEmail,registerEmail,logout,requireUser};
})();
