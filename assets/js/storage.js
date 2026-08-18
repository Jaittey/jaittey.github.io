(function(){
  const cfg=()=>window.SB_CONFIG||{};
  const key=(name)=>`sbhtml_${name}`;
  const read=(name,fallback=[])=>{try{const raw=localStorage.getItem(key(name));if(raw===null)return fallback;const v=JSON.parse(raw);return v??fallback}catch{return fallback}};
  const write=(name,value)=>localStorage.setItem(key(name),JSON.stringify(value));
  const id=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const now=()=>new Date().toISOString();

  function validConfig(){
    const c=cfg();
    return Boolean(
      window.supabase &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(c.supabaseUrl||'')) &&
      String(c.supabasePublishableKey||'').trim()
    );
  }
  const isConfigured=()=>validConfig()&&!cfg().demoMode;
  const isDemo=()=>!isConfigured();
  const activeBusiness=()=>{
    const stored=localStorage.getItem(key('activeBusinessId'))||'';
    if(stored)return stored;
    return isDemo()?'demo-business':'';
  };
  function setActiveBusiness(businessId,name=''){
    if(businessId)localStorage.setItem(key('activeBusinessId'),businessId);else localStorage.removeItem(key('activeBusinessId'));
    if(name)localStorage.setItem(key('activeBusinessName'),name);else if(!businessId)localStorage.removeItem(key('activeBusinessName'));
  }

  let client=null;
  function supa(){
    if(!isConfigured())return null;
    if(!client){
      client=window.supabase.createClient(cfg().supabaseUrl,cfg().supabasePublishableKey,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
      });
    }
    return client;
  }

  async function currentSession(){
    const c=supa();
    if(!c)return read('demoUser',null)?{user:read('demoUser',null)}:null;
    const {data,error}=await c.auth.getSession();
    if(error)throw error;
    return data.session||null;
  }
  async function currentUser(){
    const session=await currentSession();
    return session?.user||null;
  }
  async function claimMembership(){
    const c=supa();
    if(!c)return;
    const {error}=await c.rpc('sb_claim_membership');
    if(error && !/could not find/i.test(error.message||'')) throw error;
  }
  async function memberships(){
    const c=supa(),u=await currentUser();
    if(!c)return read('demoBusinesses',[{business_id:'demo-business',business_name:'Demo Company',role:'administrator',active:true,permissions:['*']}]);
    if(!u)return [];
    await claimMembership();
    const {data,error}=await c.from('business_memberships')
      .select('*')
      .or(`user_id.eq.${u.id},email.eq.${String(u.email||'').toLowerCase()}`)
      .eq('active',true)
      .order('created_at',{ascending:true});
    if(error)throw error;
    return data||[];
  }
  async function activeMembership(){
    const bid=activeBusiness();
    if(!bid)return null;
    const rows=await memberships();
    return rows.find(r=>r.business_id===bid)||null;
  }
  async function subscription(){
    const c=supa(),bid=activeBusiness();
    if(!c)return {status:'ACTIVE',plan_id:'PLATINUM',plan_name:'Demo Platinum'};
    if(!bid)return null;
    const {data,error}=await c.from('business_subscriptions').select('*').eq('business_id',bid).maybeSingle();
    if(error)throw error;
    return data||null;
  }
  function requireBusiness(){
    const bid=activeBusiness();
    if(!bid)throw new Error('Select a company workspace first.');
    return bid;
  }

  async function list(collection){
    const c=supa(), businessId=activeBusiness();
    if(!c)return read(`records_${businessId||'demo-business'}_${collection}`,[]);
    if(!businessId)throw new Error('Select a company workspace first.');
    if(collection==='userAccess'){
      const {data,error}=await c.from('business_memberships').select('*').eq('business_id',businessId).order('created_at',{ascending:true});
      if(error)throw error;
      return (data||[]).map(r=>({
        id:r.email,email:r.email,displayName:r.display_name||'',role:r.role,
        active:r.active?'ACTIVE':'INACTIVE',permissions:Array.isArray(r.permissions)?r.permissions.join(', '):'',
        customPermissions:Boolean(r.custom_permissions)
      }));
    }
    const {data,error}=await c.from('business_records').select('id,data,created_at,updated_at')
      .eq('business_id',businessId).eq('collection_name',collection).order('created_at',{ascending:true});
    if(error)throw error;
    return (data||[]).map(r=>({id:r.id,...(r.data||{})}));
  }
  async function get(collection,idv){const items=await list(collection);return items.find(x=>x.id===idv)||null}
  async function save(collection,data,idv){
    const recordId=idv||id(), businessId=activeBusiness()||(isDemo()?'demo-business':''), stamp=now(), next={...data,updatedAt:stamp};
    if(!businessId)throw new Error('Select a company workspace first.');
    if(!next.createdAt)next.createdAt=stamp;
    const c=supa();
    if(!c){
      const items=read(`records_${businessId}_${collection}`,[]),i=items.findIndex(x=>x.id===recordId),row={id:recordId,...next};
      if(i>=0)items[i]={...items[i],...row};else items.push(row);write(`records_${businessId}_${collection}`,items);return recordId;
    }
    if(collection==='userAccess'){
      const email=String(next.email||recordId||'').trim().toLowerCase();
      if(!email)throw new Error('User email is required.');
      const permissions=String(next.permissions||'').split(',').map(x=>x.trim()).filter(Boolean);
      const {error}=await c.from('business_memberships').upsert({
        business_id:businessId,email,display_name:next.displayName||'',role:next.role||'user',
        active:String(next.active||'ACTIVE').toUpperCase()!=='INACTIVE',permissions,
        custom_permissions:Boolean(next.customPermissions),business_name:localStorage.getItem(key('activeBusinessName'))||''
      },{onConflict:'business_id,email'});
      if(error)throw error;return email;
    }
    const {error}=await c.from('business_records').upsert({business_id:businessId,collection_name:collection,id:recordId,data:next,updated_at:stamp},{onConflict:'business_id,collection_name,id'});
    if(error)throw error;return recordId;
  }
  async function remove(collection,idv){
    const businessId=activeBusiness(),c=supa();if(!businessId)throw new Error('Select a company workspace first.');
    if(!c){write(`records_${businessId}_${collection}`,read(`records_${businessId}_${collection}`,[]).filter(x=>x.id!==idv));return}
    if(collection==='userAccess'){
      const {error}=await c.from('business_memberships').delete().eq('business_id',businessId).eq('email',String(idv).toLowerCase());if(error)throw error;return;
    }
    const {error}=await c.from('business_records').delete().eq('business_id',businessId).eq('collection_name',collection).eq('id',idv);if(error)throw error;
  }
  async function platformList(table){const c=supa();if(!c)return read(`platform_${table}`,[]);const {data,error}=await c.from(table).select('*');if(error)throw error;return data||[]}
  async function rpc(name,args={}){const c=supa();if(!c)throw new Error('This action requires Supabase.');const {data,error}=await c.rpc(name,args);if(error)throw error;return data}

  window.SBDB={read,write,id,now,activeBusiness,setActiveBusiness,isConfigured,isDemo,supa,currentSession,currentUser,claimMembership,memberships,activeMembership,subscription,requireBusiness,list,get,save,remove,platformList,rpc};
})();
