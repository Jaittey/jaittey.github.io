const CACHE='small-business-html-v410-db-fix';
const CORE=['./','./index.html','./dashboard.html','./workspace.html','./assets/css/app.css','./assets/css/themes.css','./assets/js/config.js','./assets/js/storage.js','./assets/js/auth.js','./assets/js/theme.js','./assets/js/ui.js'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // Runtime config and HTML should always prefer the newest deployed copy.
  if(url.pathname.endsWith('/assets/js/runtime-config.js')||event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./offline.html'))));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
});
