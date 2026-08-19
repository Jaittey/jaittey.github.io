(function(){
  const cfg = () => window.SB_CONFIG || {};
  const key = (name) => `sbhtml_${name}`;
  const lower = (v='') => String(v || '').trim().toLowerCase();
  const now = () => new Date().toISOString();
  const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const read = (name, fallback=[]) => { try { const v=JSON.parse(localStorage.getItem(key(name))); return v ?? fallback; } catch { return fallback; } };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Blob) && !(value instanceof File)) {
      return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k, clean(v)]));
    }
    if (value instanceof Date) return value.toISOString();
    return value;
  };

  let client = null;
  let bootPromise = null;
  let context = { user:null, memberships:[], membership:null, business:null, subscription:null, businessId:'', businessName:'', role:'', isSuperAdmin:false };

  function configurationError(){
    const missing=[];
    if(!cfg().supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if(!cfg().supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
    return missing.length ? `Database configuration missing: ${missing.join(', ')}. GitHub Actions must generate assets/js/runtime-config.js from repository secrets.` : '';
  }
  function isConfigured(){ return !configurationError() && !!window.supabase; }
  function supa(){
    if(!isConfigured()) return null;
    if(!client){
      client = window.supabase.createClient(cfg().supabaseUrl, cfg().supabasePublishableKey, {
        auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });
    }
    return client;
  }
  async function currentUser(){
    const c=supa();
    if(!c) throw new Error(configurationError() || 'Supabase client failed to load.');
    const {data,error}=await c.auth.getUser();
    if(error && !String(error.message||'').toLowerCase().includes('session')) throw error;
    return data?.user || null;
  }
  async function currentSession(){
    const c=supa(); if(!c) throw new Error(configurationError() || 'Supabase client failed to load.');
    const {data,error}=await c.auth.getSession(); if(error) throw error; return data?.session || null;
  }
  async function ensurePlatformProfile(user){
    if(!user?.id || !user?.email) return;
    const c=supa();
    const meta=user.user_metadata||{};
    const {error}=await c.from('platform_users').upsert({
      id:user.id,
      email:lower(user.email),
      display_name:meta.full_name||meta.name||meta.display_name||'',
      photo_url:meta.avatar_url||meta.picture||'',
      is_super_admin:lower(user.email)===lower(cfg().superAdminEmail),
      last_login_at:now(),
      updated_at:now(),
    },{onConflict:'id'});
    if(error) throw error;
    const {error:claimError}=await c.rpc('sb_claim_membership');
    if(claimError && !String(claimError.message||'').includes('does not exist')) throw claimError;
  }
  async function getMemberships(user){
    if(!user?.email) return [];
    const c=supa();
    const {data,error}=await c.from('business_memberships').select('*').eq('email',lower(user.email)).eq('active',true);
    if(error) throw error;
    return data||[];
  }
  function legacyBusinessIdCandidates(){
    return [
      localStorage.getItem(key('activeBusinessId')),
      localStorage.getItem('sb-active-business'),
      localStorage.getItem('df7-active-business'),
    ].filter(Boolean);
  }
  function setActiveBusiness(businessId,businessName=''){
    if(!businessId) return;
    localStorage.setItem(key('activeBusinessId'),businessId);
    localStorage.setItem('sb-active-business',businessId);
    if(businessName) localStorage.setItem(key('activeBusinessName'),businessName);
    context.businessId=businessId;
    if(businessName) context.businessName=businessName;
  }
  function clearActiveBusiness(){
    localStorage.removeItem(key('activeBusinessId'));
    localStorage.removeItem('sb-active-business');
    localStorage.removeItem('df7-active-business');
    context.businessId=''; context.businessName=''; context.membership=null; context.business=null; context.subscription=null;
  }
  async function resolveWorkspace(user){
    const c=supa();
    const memberships=await getMemberships(user);
    context.memberships=memberships;
    if(!memberships.length){ clearActiveBusiness(); return context; }
    const stored=legacyBusinessIdCandidates().find(candidate=>memberships.some(m=>m.business_id===candidate));
    const selected=memberships.find(m=>m.business_id===stored) || memberships[0];
    setActiveBusiness(selected.business_id,selected.business_name||'');
    context.membership=selected;
    context.role=selected.role||'user';
    const [{data:business,error:businessError},{data:subscription,error:subscriptionError}]=await Promise.all([
      c.from('businesses').select('*').eq('id',selected.business_id).maybeSingle(),
      c.from('business_subscriptions').select('*').eq('business_id',selected.business_id).maybeSingle(),
    ]);
    if(businessError) throw businessError;
    if(subscriptionError) throw subscriptionError;
    context.business=business||null;
    context.businessName=business?.name||selected.business_name||'';
    context.subscription=subscription||{status:'NONE',plan_id:''};
    setActiveBusiness(selected.business_id,context.businessName);
    return context;
  }
  async function bootstrap(options={}){
    const requireBusiness = options.requireBusiness !== false;
    if(bootPromise){
      const result=await bootPromise;
      if(requireBusiness && !result.businessId) throw new Error('No company workspace is selected.');
      return result;
    }
    bootPromise=(async()=>{
      const configIssue=configurationError();
      if(configIssue) throw new Error(configIssue);
      const user=await currentUser();
      if(!user){ context={...context,user:null}; return context; }
      await ensurePlatformProfile(user);
      context.user=user;
      context.isSuperAdmin=lower(user.email)===lower(cfg().superAdminEmail);
      await resolveWorkspace(user);
      return context;
    })().catch(err=>{ bootPromise=null; throw err; });
    const result=await bootPromise;
    if(requireBusiness && !result.businessId) throw new Error('No company workspace is selected.');
    return result;
  }
  function resetBootstrap(){ bootPromise=null; }
  async function selectBusiness(businessId){
    const user=context.user||await currentUser();
    const memberships=context.memberships?.length?context.memberships:await getMemberships(user);
    const membership=memberships.find(m=>m.business_id===businessId);
    if(!membership) throw new Error('You do not have access to this business.');
    setActiveBusiness(membership.business_id,membership.business_name||'');
    resetBootstrap();
    return bootstrap({requireBusiness:true});
  }
  function activeBusiness(){ return context.businessId || legacyBusinessIdCandidates()[0] || ''; }
  async function requireBusinessId(){
    if(!context.businessId) await bootstrap({requireBusiness:true});
    if(!context.businessId) throw new Error('Select a business workspace first.');
    return context.businessId;
  }

  async function list(collection){
    const c=supa(); if(!c) throw new Error(configurationError()||'Database connection is unavailable.');
    const businessId=await requireBusinessId();
    if(collection==='userAccess'){
      const {data,error}=await c.from('business_memberships').select('*').eq('business_id',businessId);
      if(error) throw error;
      return (data||[]).map(r=>({id:r.email,email:r.email,displayName:r.display_name||'',role:r.role,active:r.active?'ACTIVE':'INACTIVE',notes:r.notes||'',permissions:Array.isArray(r.permissions)?r.permissions.join(', '):'',customPermissions:!!r.custom_permissions}));
    }
    const {data,error}=await c.from('business_records').select('id,data,created_at,updated_at').eq('business_id',businessId).eq('collection_name',collection);
    if(error) throw error;
    return (data||[]).map(r=>({id:r.id,...(r.data||{})}));
  }
  async function get(collection,idv){
    const rows=await list(collection); return rows.find(x=>String(x.id)===String(idv))||null;
  }
  async function writeActivity(action,module,recordId=''){
    if(module==='activityLogs') return;
    try{
      const user=context.user||await currentUser(); if(!user) return;
      const businessId=await requireBusinessId(); const rid=id();
      const data={action,module,recordId,userEmail:user.email||'',userName:user.user_metadata?.full_name||user.user_metadata?.name||'',createdAt:now(),updatedAt:now()};
      await supa().from('business_records').upsert({business_id:businessId,collection_name:'activityLogs',id:rid,data,updated_at:now()},{onConflict:'business_id,collection_name,id'});
    }catch(e){ console.warn('Activity log could not be written:',e); }
  }
  async function save(collection,data,idv){
    const c=supa(); if(!c) throw new Error(configurationError()||'Database connection is unavailable.');
    const businessId=await requireBusinessId(); const recordId=idv||id(); const stamp=now();
    if(collection==='userAccess'){
      const email=lower(data.email||idv); if(!email) throw new Error('User email is required.');
      const permissions=Array.isArray(data.permissions)?data.permissions:String(data.permissions||'').split(',').map(x=>x.trim()).filter(Boolean);
      const payload={business_id:businessId,email,display_name:String(data.displayName||'').trim(),role:data.role||'user',active:String(data.active||'ACTIVE').toUpperCase()!=='INACTIVE',notes:String(data.notes||'').trim(),custom_permissions:!!data.customPermissions,permissions,business_name:context.businessName||localStorage.getItem(key('activeBusinessName'))||'',updated_at:stamp};
      const {error}=await c.from('business_memberships').upsert(payload,{onConflict:'business_id,email'}); if(error) throw error;
      await writeActivity('UPDATE USER ACCESS','userAccess',email); return email;
    }
    let next=clean(data||{});
    if(idv){
      const {data:existing,error:readError}=await c.from('business_records').select('data,created_at').eq('business_id',businessId).eq('collection_name',collection).eq('id',recordId).maybeSingle();
      if(readError) throw readError;
      next={...(existing?.data||{}),...next};
      if(!next.createdAt&&existing?.created_at) next.createdAt=existing.created_at;
    }
    if(!next.createdAt) next.createdAt=stamp; next.updatedAt=stamp;
    const {error}=await c.from('business_records').upsert({business_id:businessId,collection_name:collection,id:recordId,data:next,updated_at:stamp},{onConflict:'business_id,collection_name,id'});
    if(error) throw error;
    await writeActivity(idv?'UPDATE':'CREATE',collection,recordId);
    return recordId;
  }
  async function remove(collection,idv){
    const c=supa(); if(!c) throw new Error(configurationError()||'Database connection is unavailable.');
    const businessId=await requireBusinessId();
    if(collection==='userAccess'){
      const {error}=await c.from('business_memberships').delete().eq('business_id',businessId).eq('email',lower(idv)); if(error) throw error;
      await writeActivity('DELETE USER ACCESS','userAccess',idv); return;
    }
    const {error}=await c.from('business_records').delete().eq('business_id',businessId).eq('collection_name',collection).eq('id',idv); if(error) throw error;
    await writeActivity('DELETE',collection,idv);
  }
  async function platformList(table){
    const c=supa(); if(!c) throw new Error(configurationError()||'Database connection is unavailable.');
    await bootstrap({requireBusiness:false});
    const {data,error}=await c.from(table).select('*'); if(error) throw error; return data||[];
  }
  async function rpc(name,args){
    const c=supa(); if(!c) throw new Error(configurationError()||'Database connection is unavailable.');
    await bootstrap({requireBusiness:false});
    const {data,error}=await c.rpc(name,args); if(error) throw error; return data;
  }
  async function registerBusiness(form={}){
    const c=supa(); if(!c) throw new Error(configurationError()||'Database connection is unavailable.');
    await bootstrap({requireBusiness:false});
    const {data,error}=await c.rpc('sb_register_business',{p_form:clean(form)}); if(error) throw error;
    setActiveBusiness(data,form.name||form.businessName||''); resetBootstrap(); await bootstrap({requireBusiness:true}); return data;
  }
  async function getCompanyAssets(){
    const c=supa(); const businessId=await requireBusinessId();
    const {data,error}=await c.from('company_assets').select('*').eq('business_id',businessId); if(error) throw error;
    const result={companyLogoDataUrl:'',companyStampDataUrl:'',managerSignatureDataUrl:''};
    const map={companyLogo:'companyLogoDataUrl',companyStamp:'companyStampDataUrl',managerSignature:'managerSignatureDataUrl'};
    for(const row of data||[]){
      const field=map[row.asset_id]; if(!field||!row.storage_path) continue;
      const {data:blob,error:downloadError}=await c.storage.from('company-assets').download(row.storage_path); if(downloadError) continue;
      result[field]=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
    }
    return result;
  }
  async function saveCompanyAsset(assetId,file){
    if(!['companyLogo','companyStamp','managerSignature'].includes(assetId)) throw new Error('Unsupported company asset.');
    if(!(file instanceof File) || !String(file.type||'').startsWith('image/')) throw new Error('Choose a valid image file.');
    const c=supa(); const businessId=await requireBusinessId(); const ext=file.type.includes('jpeg')?'jpg':file.type.includes('webp')?'webp':'png'; const path=`${businessId}/${assetId}.${ext}`;
    const {data:existing}=await c.from('company_assets').select('storage_path').eq('business_id',businessId).eq('asset_id',assetId).maybeSingle();
    if(existing?.storage_path&&existing.storage_path!==path) await c.storage.from('company-assets').remove([existing.storage_path]);
    const {error:uploadError}=await c.storage.from('company-assets').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'}); if(uploadError) throw uploadError;
    const user=context.user||await currentUser();
    const {error}=await c.from('company_assets').upsert({business_id:businessId,asset_id:assetId,storage_path:path,file_name:file.name||`${assetId}.${ext}`,content_type:file.type,uploaded_by:user?.email||'',updated_at:now()},{onConflict:'business_id,asset_id'}); if(error) throw error;
    await writeActivity('UPLOAD COMPANY ASSET','companyAssets',assetId);
    return path;
  }
  async function connectionStatus(){
    try{
      const state=await bootstrap({requireBusiness:false});
      return {ok:true,configured:true,authenticated:!!state.user,businessId:state.businessId,businessName:state.businessName,role:state.role,isSuperAdmin:state.isSuperAdmin,subscription:state.subscription};
    }catch(error){ return {ok:false,configured:isConfigured(),error:error.message||String(error)}; }
  }

  window.SBDB={cfg,key,read,write,id,now,isConfigured,configurationError,supa,currentUser,currentSession,bootstrap,resetBootstrap,selectBusiness,setActiveBusiness,clearActiveBusiness,activeBusiness,context:()=>context,list,get,save,remove,platformList,rpc,registerBusiness,getCompanyAssets,saveCompanyAsset,connectionStatus};
})();
