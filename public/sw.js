/*
 * Offline support: after the first visit the app opens without a network.
 * - Everything in the build is cached when the service worker installs.
 * - Pages: network first (to pick up new versions), cached copy when offline.
 * - Hashed bundles and Tesseract files from the CDN: cache first, they never change.
 * - Other same-origin files (icons, fonts, wasm): cached copy, refreshed in the background.
 * Cached responses keep their COOP/COEP headers, so the database still works offline.
 */
// Both filled in by scripts/finish-web-export.js: a hash of the build, and every file of it.
// Screens are loaded on demand, so all of them are fetched up front (~3 MB) to work offline.
const CACHE = 'chi-tieu-__BUILD_HASH__';
const PRECACHE = ['/index.html' /* __PRECACHE__ */];
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // Every route is the same single-page app shell.
    if (response.ok) await cache.put(SHELL, response.clone());
    return response;
  } catch {
    return (await cache.match(SHELL)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}
