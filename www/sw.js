// Minimal offline cache so the web version also opens with no signal.
const C="va-v1",F=["./","index.html","styles.css","app.js","jobs.js","config.js","logo.jpg","vendor/jspdf.umd.min.js","vendor/jspdf.plugin.autotable.min.js","vendor/firebase-app-compat.js","vendor/firebase-auth-compat.js","vendor/firebase-firestore-compat.js"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
