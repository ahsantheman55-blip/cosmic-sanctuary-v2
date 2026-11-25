/* Cosmic Sanctuary version 2 service worker (library text is cached as it is read, or all at once with Save the whole library): keeps the app for offline use, and answers sound files from the cache
   that "Save all sounds for offline use" fills (on this site and the companion sound site). */
const SHELL='cs2-shell-v1';
const FILES=['./','index.html','app.js','engine.js','eras.js','settings.js','audio.js','libcore.js','library.js','modes.js','sounds.json','credits.html','library/index.json'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>/shell/.test(k)&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const r=e.request; if(r.method!=='GET') return; const u=new URL(r.url);
 if(/\/sounds\/[^/]+\/[^/]+\.mp3$/.test(u.pathname)){ e.respondWith(caches.match(r.url,{ignoreSearch:true}).then(m=>m||fetch(r).catch(()=>new Response('',{status:503,statusText:'Offline'})))); return; }
 if(u.origin!==self.location.origin) return;
 e.respondWith(fetch(r).then(resp=>{ if(resp&&resp.ok&&resp.type==='basic'){ const cp=resp.clone(); caches.open(SHELL).then(c=>c.put(r,cp)).catch(()=>{}); } return resp; })
  .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('./'):undefined)).then(m=>m||new Response('Offline',{status:503,statusText:'Offline'})))); });
