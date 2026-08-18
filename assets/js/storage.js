
(function(){
  const cfg=()=>window.SB_CONFIG||{};
  const key=(name)=>`sbhtml_${name}`;
  const read=(name,fallback=[])=>{try{const v=JSON.parse(localStorage.getItem(key(name)));return v??fallback}catch{return fallback}};
  const write=(name,value)=>localStorage.setItem(key(name),JSON.stringify(value));
  const id=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const now=()=>new Date().toISOString();
  const activeBusiness=()=>localStorage.getItem(key('activeBusinessId'))||'demo-business';
  const isConfigured=()=>Boolean(cfg().supabaseUrl&&cfg().supabasePublishableKey&&window.supabase);
  let client=null;
  function supa(){if(!isConfigured()) return null;if(!client) client=window.supabase.createClient(cfg().supabaseUrl,cfg().supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return client}
  async function currentUser(){const c=supa();if(!c)return read('demoUser',null);const {data}=await c.auth.getUser();return data.user||null}
  async function list(collection){
    const c=supa(), businessId=activeBusiness();
    if(!c) return read(`records_${businessId}_${collection}`,[]);
    if(collection==='userAccess'){
      const {data,error}=await c.from('business_memberships').select('*').eq('business_id',businessId);
      if(error) throw error;
      return (data||[]).map(r=>({id:r.email,email:r.email,displayName:r.display_name,role:r.role,active:r.active?'ACTIVE':'INACTIVE',permissions:Array.isArray(r.permissions)?r.permissions.join(', '):'',customPermissions:r.custom_permissions}));
    }
    const {data,error}=await c.from('business_records').select('id,data,created_at,updated_at').eq('business_id',businessId).eq('collection_name',collection);
    if(error) throw error;
    return (data||[]).map(r=>({id:r.id,...(r.data||{})}));
  }
  async function get(collection,idv){
    const items=await list(collection); return items.find(x=>x.id===idv)||null;
  }
  async function save(collection,data,idv){
    const recordId=idv||id(), businessId=activeBusiness(), stamp=now(), next={...data,updatedAt:stamp};
    if(!next.createdAt) next.createdAt=stamp;
    const c=supa();
    if(!c){
      const items=read(`records_${businessId}_${collection}`,[]);
      const i=items.findIndex(x=>x.id===recordId);
      const row={id:recordId,...next};
      if(i>=0)items[i]={...items[i],...row};else items.push(row);
      write(`records_${businessId}_${collection}`,items);
      return recordId;
    }
    if(collection==='userAccess'){
      const email=String(next.email||recordId||'').trim().toLowerCase();
      if(!email) throw new Error('User email is required.');
      const permissions=String(next.permissions||'').split(',').map(x=>x.trim()).filter(Boolean);
      const {error}=await c.from('business_memberships').upsert({business_id:businessId,email,display_name:next.displayName||'',role:next.role||'user',active:String(next.active||'ACTIVE').toUpperCase()!=='INACTIVE',permissions,custom_permissions:Boolean(next.customPermissions),business_name:localStorage.getItem('sbhtml_activeBusinessName')||''},{onConflict:'business_id,email'});
      if(error) throw error; return email;
    }
    const {error}=await c.from('business_records').upsert({business_id:businessId,collection_name:collection,id:recordId,data:next,updated_at:stamp},{onConflict:'business_id,collection_name,id'});
    if(error) throw error; return recordId;
  }
  async function remove(collection,idv){
    const businessId=activeBusiness(),c=supa();
    if(!c){write(`records_${businessId}_${collection}`,read(`records_${businessId}_${collection}`,[]).filter(x=>x.id!==idv));return}
    if(collection==='userAccess'){const {error}=await c.from('business_memberships').delete().eq('business_id',businessId).eq('email',String(idv).toLowerCase());if(error)throw error;return}
    const {error}=await c.from('business_records').delete().eq('business_id',businessId).eq('collection_name',collection).eq('id',idv);if(error)throw error;
  }
  async function platformList(table){const c=supa();if(!c)return read(`platform_${table}`,[]);const {data,error}=await c.from(table).select('*');if(error)throw error;return data||[]}
  async function rpc(name,args){const c=supa();if(!c)throw new Error('This action requires Supabase configuration.');const {data,error}=await c.rpc(name,args);if(error)throw error;return data}
  window.SBDB={read,write,id,now,activeBusiness,isConfigured,supa,currentUser,list,get,save,remove,platformList,rpc};
})();
