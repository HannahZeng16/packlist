/* build 20260918-151709 —— 每次重新生成都会换缓存名，装在桌面上的也能拿到更新 */
const C='ntu-wb-20260918-151709';
const F=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET') return;
 const isPage = e.request.mode==='navigate' || e.request.destination==='document';
 if(isPage){                     /* 页面：先联网拿最新，断网才用缓存 */
   e.respondWith(fetch(e.request).then(res=>{
     const cp=res.clone(); caches.open(C).then(c=>c.put('./index.html',cp)); return res;
   }).catch(()=>caches.match('./index.html')));
   return;
 }
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
   const cp=res.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return res;
 }).catch(()=>caches.match('./index.html'))));
});
