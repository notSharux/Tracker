/* Tracker service worker — offline app shell + runtime cache for fonts/icons.
   Bump CACHE to force clients to refetch the shell after an update. */
const CACHE = 'tracker-v3';
const PRECACHE = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(() => {})           // never let a missing asset block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never touch sync POST/PATCH
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return;          // sync calls always hit the network
  if (req.cache === 'no-store' || req.cache === 'no-cache') return; // live data (Fitness-Dienst): nie aus dem Cache

  // The HTML document: network-first (so updates show), fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          caches.open(CACHE).then(c => { c.put(req, r.clone()); c.put('./index.html', r.clone()); });
          return r;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (CSS, fonts, icons): cache-first, fill the cache on first online load.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
      }
      return r;
    }).catch(() => hit))
  );
});
