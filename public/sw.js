/*
 * ServePoint service worker — hand-rolled, no workbox.
 *
 * Caching policy (the POS truth table):
 *  - App shell + BUILD ASSETS + hashed build files: precached at install.
 *    The build step injects the dist/assets manifest into BUILD_ASSETS via
 *    scripts/inject-sw-precache.mjs (an empty list here is dev-safe).
 *  - Navigations (any SPA deep link): network-FIRST with a 5s timeout, then
 *    the cached shell, then a minimal offline notice. Freshness wins while
 *    there is a network; the shell wins when there isn't.
 *  - Supabase (data + realtime + auth): NETWORK-ONLY, never cached. Orders,
 *    payments and the counter-gate must never be served from a stale cache.
 *  - Cross-origin fonts: cache-first (immutable by nature).
 *
 * Release discipline: bump VERSION on every shell-changing deploy so old
 * caches are evicted on activate.
 */
const VERSION = 'servepoint-v5.29.0-r1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const FONT_CACHE = `${VERSION}-fonts`;

const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
];

/** Injected at build time by scripts/inject-sw-precache.mjs (hashed files). */
const BUILD_ASSETS = [];

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  // The app can ask the SW to take an update immediately.
  if (event.data === 'SP_CHECK_UPDATE') self.skipWaiting();
});

/**
 * Precache the shell into SHELL_CACHE and the hashed build assets into
 * ASSET_CACHE — the runtime cacheFirst lookup reads ASSET_CACHE, so the
 * precache must land there for a cold offline boot to find its scripts.
 * Every request uses `cache: 'reload'` (bypasses the HTTP cache) and is
 * header-cleaned (see cachePutClean).
 */
async function precacheAll() {
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(ASSET_CACHE);
  const put = async (cache, url) => {
    try {
      const fresh = await fetch(new Request(url, { cache: 'reload' }));
      if (fresh && fresh.ok) await cachePutClean(cache, new URL(url, self.location.origin), fresh);
    } catch {
      // A missing optional asset must never block the install.
    }
  };
  await Promise.allSettled([
    ...SHELL_ASSETS.map((url) => put(shell, url)),
    ...BUILD_ASSETS.map((url) => put(assets, url)),
  ]);
  await self.skipWaiting();
}

/**
 * fetch() hands us the DECODED body while the headers may still claim
 * `Content-Encoding: gzip` and the old `Content-Length`. Storing that pair
 * verbatim makes the browser re-decompress an already-decoded body on the
 * offline path. Store the truth: decoded body, honest headers.
 */
async function cachePutClean(cache, request, response) {
  try {
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    const cleaned = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    await cache.put(request, cleaned);
  } catch {
    // Opaque / tainted responses: store as-is (fonts etc.).
    await cache.put(request, response.clone()).catch(() => {});
  }
}

/** Cache-first for immutable assets; populates on the way past when online. */
async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  // ignoreVary: the build server stamps `Vary: Origin` on module assets;
  // module requests carry Origin while our precache requests don't, and a
  // strict Vary match would miss a perfectly good cached script offline.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && (fresh.ok || fresh.type === 'opaque')) {
    cachePutClean(cache, request, fresh.clone()).catch(() => {});
  }
  return fresh;
}

/**
 * Network-first navigation with a 5s watchdog:
 *   fresh page  ->  cache.put + return
 *   timeout/off ->  exact cached match -> SPA shell ('/') -> offline notice
 */
async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const fresh = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (fresh && fresh.ok) cachePutClean(cache, request, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
      (await cache.match('/', { ignoreVary: true })) ||
      new Response(
        '<!doctype html><title>ServePoint — offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#F6F5F2;color:#1A1A1A;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:20px">You are offline</h1><p style="color:#6B6B6B;font-size:14px">ServePoint will reconnect automatically — try again in a moment.</p></div></body>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Money and kitchen paths are never served from a cache.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return; // ws(s), blob:, etc.
  if (url.hostname.endsWith('supabase.co')) return; // data + realtime + auth: network only

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    // Hashed build assets + same-origin static: cache-first.
    event.respondWith(cacheFirst(ASSET_CACHE, request));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(FONT_CACHE, request));
  }
  // Everything else cross-origin: let the browser handle it (no SW opinion).
});
