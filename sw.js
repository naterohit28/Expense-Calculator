/** Offline release cache: install the complete app, then serve that release consistently. */

const CACHE_NAME = 'flavor-fusion-v2-cache-v13';
// The Classic FFexp / FFmobile pages are retired: no longer linked or cached offline
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './register-sw.js',
  './db.js',
  './utils.js',
  './icons.js',
  './i18n.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// On a slow connection, don't keep the user waiting longer than this before using the cache
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      // 'reload' skips the browser's HTTP cache so the precache is this release's files
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))

  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('flavor-fusion-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;

  if (sameOrigin || e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Fonts and other third-party files: cache first
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

// Serve the complete installed release. A slow request must not mix an old
// cached module with a newly deployed module in an already-running client.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === 'navigate') { const page = await cache.match('./index.html'); if (page) return page; }
  try { return await fetch(request); } catch { return Response.error(); }
}
