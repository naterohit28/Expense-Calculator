/**
 * Flavor Fusion v2 Service Worker
 * Offline support for the PWA.
 *
 * The app's own files are fetched network-first: the page and its scripts must come
 * from the same release, or a new page can run with old scripts (new buttons that do
 * nothing). The cache is the offline fallback. Third-party assets (fonts) are
 * cache-first since they never change.
 */

const CACHE_NAME = 'flavor-fusion-v2-cache-v9';
// The Classic FFexp / FFmobile pages are retired: no longer linked or cached offline
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
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
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const fromCache = async () =>
    (await cache.match(request, { ignoreSearch: true })) ||
    (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);

  // 'no-cache' revalidates with the server (cheap 304 when unchanged)
  const fresh = (request.mode === 'navigate' ? fetch(request) : fetch(request, { cache: 'no-cache' }))
    .then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res; });
  const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, 'slow'));

  try {
    const first = await Promise.race([fresh, slow]);
    if (first !== 'slow') return first;
    // Network is slow: use the saved copy if there is one, otherwise keep waiting
    return (await fromCache()) || (await fresh);
  } catch {
    // Offline
    return (await fromCache()) || Response.error();
  }
}
