
(function(){
  const D=window.SBDB;
  async function loginGoogle(){
    const c=D.supa();
    if(!c){D.write('demoUser',{id:'demo-user',email:'demo@example.com',user_metadata:{full_name:'Demo User'}});location.href='dashboard.html';return}
    const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('workspace.html',location.href).href}});if(error)throw error;
  }
  async function loginEmail(email,password){
    const c=D.supa();
    if(!c){D.write('demoUser',{id:'demo-user',email,user_metadata:{full_name:email.split('@')[0]}});location.href='dashboard.html';return}
    const {error}=await c.auth.signInWithPassword({email,password});if(error)throw error;location.href='workspace.html';
  }
  async function registerEmail(email,password){
    const c=D.supa();
    if(!c){D.write('demoUser',{id:'demo-user',email,user_metadata:{full_name:email.split('@')[0]}});location.href='register-business.html';return}
    const {error}=await c.auth.signUp({email,password});if(error)throw error;alert('Account created. Check your email if verification is enabled.');
  }
  async function logout(){const c=D.supa();if(c)await c.auth.signOut();localStorage.removeItem('sbhtml_demoUser');location.href='index.html'}
  window.SBAuth={loginGoogle,loginEmail,registerEmail,logout};
})();
