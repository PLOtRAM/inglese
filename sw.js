// Service worker: app disponibile senza rete e notifica del mattino.
const CACHE = 'inglese-v3';
const SHELL = ['./', 'shared.js', 'manifest.webmanifest', 'icon-192.png', 'fonts/atkinson-hyperlegible-400.woff2', 'fonts/atkinson-hyperlegible-700.woff2', 'fonts/bricolage-grotesque.woff2', 'fonts/jetbrains-mono.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k!==CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// File dell'app: prima la rete (così gli aggiornamenti arrivano subito), copia salvata se manca la rete. I dati (api.github.com) non passano di qui.
// cache:'no-cache' = chiede sempre al server se il file è cambiato: GitHub Pages dice max-age=600, e senza questo si vedevano per 10 minuti file vecchi (anche misti: pagina nuova con shared.js vecchio).
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin) return;
  // caratteri e icone non cambiano: copia salvata subito, rete solo se manca. shortcut: se ne cambi uno, alza CACHE qui sopra.
  if(/\/(fonts\/|icon-)/.test(u.pathname)) return e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => { const copy = n.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return n; })));
  e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || caches.match('./'))));
});

self.addEventListener('push', e => {
  let d = {}; try{ d = e.data.json(); }catch(_){ d = {title:'Inglese', body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Inglese', {body: d.body || '', icon:'icon-192.png', badge:'icon-192.png', tag:'report', data:{url: d.url || './#piano'}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './#piano';     // './#piano' = piano del giorno, './#turno' = scelta del turno
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cs => cs.length ? cs[0].focus().then(c => c.postMessage(url.split('#')[1] || 'piano')) : self.clients.openWindow(url)));
});
