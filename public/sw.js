const VERSION = 'v29';
const CACHE = `pw-optimizer-${VERSION}`;
const STATIC_CACHE = `pw-optimizer-static-${VERSION}`;
const DYNAMIC_CACHE = `pw-optimizer-dynamic-${VERSION}`;

// Derive basePath from the SW's own URL (e.g. /Notes-Print-Optimizer/sw.js -> /Notes-Print-Optimizer)
const BASE = self.location.pathname.replace(/\/sw\.js$/, '') || '';
const OFFLINE_URL = `${BASE}/offline/`;

// Deliberate decision (architecture review, Aug 2026): every public tool
// route is precached. Each page is a few KB of static HTML (<60 KB total),
// and offline deep-linking is a core product promise ("100% Offline").
// Adding a tool = adding its route here AND to lib/tools/registry.ts.
const TOOL_ROUTES = [
  '/tools/dark-print/',
  '/tools/enhance-light-pdf/',
  '/tools/protect-pdf/',
  '/tools/pdf-to-images/',
  '/tools/merge-pdf/',
  '/tools/split-pdf/',
  '/tools/image-to-pdf/',
  '/tools/password-generator/',
  '/tools/qr-generator/',
  '/tools/word-counter/',
  '/tools/case-converter/',
  '/tools/n-up/',
];

const PRECACHE_URLS = [
  `${BASE}/`,
  `${BASE}/offline/`,
  ...TOOL_ROUTES.map((route) => `${BASE}${route}`),
  `${BASE}/icon.svg`,
  `${BASE}/icon-192-v2.png`,
  `${BASE}/icon-512-v2.png`,
  `${BASE}/icon-maskable-v2.png`,
  `${BASE}/icon-maskable-v2.svg`,
  `${BASE}/vendor/pdf.worker.min.mjs`,
  `${BASE}/vendor/pdf.min.mjs`,
  `${BASE}/wasm/npo_wasm.js`,
  `${BASE}/wasm/npo_wasm_bg.wasm`,
];

// ---- Install ----
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
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
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
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
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
          const rootPage = await caches.match(`${BASE}/`);
          if (rootPage) return rootPage;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline · Print Optimizer</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fb;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px"><div style="text-align:center;max-width:420px"><div style="width:64px;height:64px;margin:0 auto;display:flex;align-items:center;justify-content:center;border-radius:16px;background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca">Offline</div><h1 style="margin:24px 0 8px;font-size:24px;letter-spacing:-0.02em">You Are Offline</h1><p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">Core tools stay available offline after your first visit — everything runs on your device. Reconnect to load fresh pages.</p><p style="margin:24px 0 0;font-size:11px;color:#94a3b8">Offline · Print Optimizer · Juyel Hossain</p></div></body></html>',
            { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/html' } },
          );
        }
      })(),
    );
    return;
  }

  // WASM assets: network-first (fixed filenames, must never go stale)
  if (url.pathname.match(/\.wasm$/)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first with long TTL
  if (url.pathname.match(/\.(js|css|svg|png|ico|webmanifest|woff2?|mjs)$/)) {
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
          if (res.ok) cache.put(request, res.clone());
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
