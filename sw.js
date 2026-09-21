/* 离线缓存。改版本号即可让所有装了的手机更新。 */
const V='travelkit-v2';
const CORE=['./','index.html','assets/style.css','assets/app.js',
            'data/tree.json','data/items.json','manifest.webmanifest',
            'icons/icon-180.png','icons/icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    /* 数据文件：先网络后缓存，保证内容能更新；其余：缓存优先，保证秒开和离线 */
    e.request.url.includes('/data/')
      ? fetch(e.request).then(r=>{const c=r.clone(); caches.open(V).then(x=>x.put(e.request,c)); return r;})
          .catch(()=>caches.match(e.request))
      : caches.match(e.request).then(r=>r||fetch(e.request))
  );
});
