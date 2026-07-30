const CACHE = 'pw-optimizer-v2';
const STATIC_CACHE = 'pw-optimizer-static-v2';
const DYNAMIC_CACHE = 'pw-optimizer-dynamic-v2';
const OFFLINE_URL = '/offline/';

const PRECACHE_URLS = [
  '/',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
];

// ---- Install ----
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const base = self.location.pathname.replace(/\/sw\.js$/, '') || '';
      const urls = PRECACHE_URLS.map((u) => `${base}${u}`);
      urls.push(`${base}${OFFLINE_URL}`);
      await cache.addAll(urls).catch(() => {});
    })(),
  );
});

// ---- Activate ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const keep = new Set([CACHE, STATIC_CACHE, DYNAMIC_CACHE]);
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// ---- Fetch ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const base = self.location.pathname.replace(/\/sw\.js$/, '') || '';
  const isSameOrigin = url.origin === self.location.origin;

  // Offline page for navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(`${base}${OFFLINE_URL}`);
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first
  if (isSameOrigin && url.pathname.match(/\.(wasm|js|css|svg|png|ico|webmanifest)$/)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      })(),
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(request);
        return cached || new Response('', { status: 504 });
      }
    })(),
  );
});
