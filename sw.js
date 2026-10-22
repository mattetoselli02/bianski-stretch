/* Bianski Stretch — funziona offline: tiene in cache l'app e i caratteri */
const VERSIONE = 'bianski-2';
const FILE = ['./', 'index.html', 'app.js', 'motore.js', 'esercizi.js', 'manifest.webmanifest', 'icone/icona-180.png', 'icone/icona-192.png', 'icone/icona-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIONE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // caratteri di Google: prima la cache
  if (url.hostname.includes('fonts.g')) { e.respondWith(caches.open(VERSIONE).then(c => c.match(req).then(r => r || fetch(req).then(res => { c.put(req, res.clone()); return res; })))); return; }
  if (url.origin !== location.origin) return;
  // file dell'app: rete se c'è (così gli aggiornamenti arrivano), altrimenti cache
  e.respondWith(fetch(req).then(res => { const cp = res.clone(); caches.open(VERSIONE).then(c => c.put(req, cp)); return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
