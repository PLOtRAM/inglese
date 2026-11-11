// Service worker: app disponibile senza rete e notifica del mattino.
const CACHE = 'inglese-v1';
const SHELL = ['./', 'shared.js', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k!==CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// File dell'app: prima la rete (così gli aggiornamenti arrivano subito), copia salvata se manca la rete. I dati (api.github.com) non passano di qui.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || caches.match('./'))));
});

self.addEventListener('push', e => {
  let d = {}; try{ d = e.data.json(); }catch(_){ d = {title:'Inglese', body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Inglese', {body: d.body || '', icon:'icon-192.png', badge:'icon-192.png', tag:'report'}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
