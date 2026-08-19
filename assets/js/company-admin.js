window.addEventListener('DOMContentLoaded',async()=>{
 const form=document.querySelector('#companyForm');if(!form)return;
 try{
  await SBDB.bootstrap({requireBusiness:true});
  const s=(await SBDB.get('settings','business'))||{};
  const aliases={gstRate:'defaultGstRate',businessName:'businessName',registrationNumber:'registrationNumber'};
  Object.keys(form.elements).forEach(()=>{});
  Object.entries(s).forEach(([k,v])=>{if(form.elements[k]&&typeof v!=='object')form.elements[k].value=v??''});
  if(form.elements.gstRate && s.defaultGstRate!=null) form.elements.gstRate.value=s.defaultGstRate;
  const assets=await SBDB.getCompanyAssets();
  Object.entries(assets).forEach(([k,v])=>{const p=document.querySelector(`[data-preview="${k}"]`);if(v&&p)p.src=v});
 }catch(error){SBUI.toast(error.message,'error')}
 form.onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(form),data=Object.fromEntries(fd.entries());if('gstRate' in data){data.defaultGstRate=Number(data.gstRate||0);delete data.gstRate}if('currency' in data)data.currency=data.currency||'MVR';await SBDB.save('settings',data,'business');SBUI.toast('Company settings saved')}catch(error){SBUI.toast(error.message,'error')}};
 document.querySelectorAll('[data-image-field]').forEach(inp=>inp.onchange=async()=>{const f=inp.files?.[0];if(!f)return;try{const field=inp.dataset.imageField;const assetId={companyLogoDataUrl:'companyLogo',companyStampDataUrl:'companyStamp',managerSignatureDataUrl:'managerSignature'}[field];await SBDB.saveCompanyAsset(assetId,f);const p=document.querySelector(`[data-preview="${field}"]`);if(p)p.src=URL.createObjectURL(f);SBUI.toast('Image uploaded to Supabase')}catch(error){SBUI.toast(error.message,'error')}});
});
