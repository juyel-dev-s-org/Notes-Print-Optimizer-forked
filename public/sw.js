const VERSION = 'v3';
const CACHE = `pw-optimizer-${VERSION}`;
const STATIC_CACHE = `pw-optimizer-static-${VERSION}`;
const DYNAMIC_CACHE = `pw-optimizer-dynamic-${VERSION}`;
const OFFLINE_URL = '/offline/';

const PRECACHE_URLS = [
  '/',
  '/offline/',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/manifest.webmanifest',
];

// ---- Install ----
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const base = self.location.pathname.replace(/\/sw\.js$/, '') || '';
      const urls = PRECACHE_URLS.map((u) => `${base}${u}`);
      // Cache individually so one failure doesn't block all
      await Promise.allSettled(
        urls.map((url) =>
          cache.add(url).catch(() => {
            console.warn('[SW] Failed to precache:', url);
          }),
        ),
      );
    })(),
  );
});

// ---- Activate ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const keep = new Set([CACHE, STATIC_CACHE, DYNAMIC_CACHE]);
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ---- Fetch ----
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const base = self.location.pathname.replace(/\/sw\.js$/, '') || '';
  const isSameOrigin = url.origin === self.location.origin;

  // Skip cross-origin requests
  if (!isSameOrigin) return;

  // Navigation requests: network-first with offline fallback
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
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match(`${base}${OFFLINE_URL}`);
          if (offlinePage) return offlinePage;
          return new Response(
            '<!DOCTYPE html><html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html' },
            },
          );
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(wasm|js|css|svg|png|ico|webmanifest|woff2?)$/)) {
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
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        }
      })(),
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(DYNAMIC_CACHE);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) {
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })(),
  );
});

// ---- Message handler ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
