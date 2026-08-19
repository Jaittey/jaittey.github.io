(function(){
  const runtime = window.SB_RUNTIME_CONFIG || {};
  window.SB_CONFIG = {
    appName: 'Small Business',
    version: '4.1 HTML DB Fix',
    supabaseUrl: String(runtime.supabaseUrl || 'https://cpibkajrhpmsewzrbfqj.supabase.co').trim(),
    supabasePublishableKey: String(runtime.supabasePublishableKey || runtime.supabaseAnonKey || 'sb_publishable_gXff-L5CplkrsfrFKdw4vA_VImC9SG_').trim(),
    superAdminEmail: String(runtime.superAdminEmail || 'jaeitte@gmail.com').trim().toLowerCase(),
    googleClientId: String(runtime.googleClientId || '').trim(),
    currency: 'MVR',
    // Never silently switch a deployed application to browser-only demo data.
    demoMode: false,
  };
})();
