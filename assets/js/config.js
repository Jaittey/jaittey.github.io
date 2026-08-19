(function(){
  const runtime = window.SB_RUNTIME_CONFIG || {};
  window.SB_CONFIG = {
    appName: 'Small Business',
    version: '4.1 HTML DB Fix',
    supabaseUrl: String(runtime.supabaseUrl || '').trim(),
    supabasePublishableKey: String(runtime.supabasePublishableKey || runtime.supabaseAnonKey || '').trim(),
    superAdminEmail: String(runtime.superAdminEmail || 'jaeitte@gmail.com').trim().toLowerCase(),
    googleClientId: String(runtime.googleClientId || '').trim(),
    currency: 'MVR',
    // Never silently switch a deployed application to browser-only demo data.
    demoMode: false,
  };
})();
