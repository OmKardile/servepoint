/*
 * ServePoint service worker — hand-rolled, no workbox.
 *
 * Caching policy (the POS truth table):
 *  - App shell + BUILD ASSETS + hashed build files: precached at install.
 *    The build step injects the dist/assets manifest into BUILD_ASSETS via
 *    scripts/inject-sw-precache.mjs (an empty list here is dev-safe).
 *  - Navigations (any SPA deep link): network-FIRST with a 5s timeout, then
 *    the cached shell, then a house-voiced offline notice. Freshness wins
 *    while there is a network; the shell wins when there isn't.
 *  - Supabase (data + realtime + auth): NETWORK-ONLY, never cached. Orders,
 *    payments and the counter-gate must never be served from a stale cache.
 *  - Cross-origin fonts: cache-first (immutable by nature).
 *
 * Release discipline: bump VERSION on every shell-changing deploy so old
 * caches are evicted on activate.
 */
const VERSION = "servepoint-v5.304.0-r1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const FONT_CACHE = `${VERSION}-fonts`;

/**
 * v5.142.0 — the static shell assets (favicon, manifest, icons) precache into
 * ASSET_CACHE, the cache the fetch handler actually READS for same-origin
 * requests; SHELL_CACHE keeps navigations only ('/' plus every runtime-cached
 * deep link). Before this fix the static assets were precached into a cache
 * the runtime lookup never opened — offline, the favicon and manifest failed
 * even though they sat one cache-key away from where the lookups happen.
 */
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
    put(shell, '/'),
    ...SHELL_ASSETS.filter((url) => url !== '/').map((url) => put(assets, url)),
    ...BUILD_ASSETS.map((url) => put(assets, url)),
  ]);
  /**
   * v5.144.0 — the worker now WAITS, as v5.7.0's contract always said it
   * did. Until now a stray self-skipWaiting() (an original v5.6.0 line
   * never reconciled with the v5.7.0 waiting design) let an update take
   * control the moment its precache finished — clients.claim() then fired
   * controllerchange and the page yanked itself mid-task, the exact thing
   * the update toast exists to prevent. The ONLY skip path is the
   * SP_CHECK_UPDATE message from the user's Refresh tap.
   */
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
 * v5.142.0 — the last-resort offline page speaks the house register (cream
 * canvas, teal serif-italic headline, gold reload door, the brand mark with a
 * graceful no-image fallback). This page is the FLOOR of the offline story:
 * it only renders when even the precached shell is missing from the cache —
 * a half-failed install during an outage. It is honest: the old stub claimed
 * "ServePoint will reconnect automatically", but nothing reconnects by
 * itself — a person taps Try again. Status stays 503 (it IS unavailable).
 * The favicon reference renders only if the precache reached ASSET_CACHE;
 * otherwise the styled chip stands alone and the words carry the page.
 */
const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Offline · ServePoint</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  /* v5.148.0 — the 181 parked polish. The headline always ASKED for the
     house serif, but no @font-face existed in this document, so 'Instrument
     Serif' could never resolve — even when FONT_CACHE held the real face
     (the app fetches it on every boot and the SW serves fonts cache-first).
     Declaring the face lets the SW's own font route deliver the cached
     woff2 to an offline page that otherwise never loads the Google CSS:
     the house serif now speaks offline whenever the house ran before the
     outage, and a truly cold offline (install half-failed, fonts never
     fetched) falls back to Georgia honestly. One face only — the italic
     latin file this page actually renders; no other weights are used here. */
  @font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7M.woff2) format('woff2')}
  html,body{margin:0;height:100%}
  body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#F6F5F2;color:#1A1A1A;display:grid;place-items:center;padding:24px;box-sizing:border-box}
  .card{max-width:440px;text-align:center}
  .mark{width:56px;height:56px;margin:0 auto 18px;border-radius:16px;background:#F6F1E9;border:1px solid #E3E7E0;display:grid;place-items:center;overflow:hidden}
  .mark img{width:40px;height:40px;object-fit:contain}
  h1{font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;color:#0F3D3E;font-size:32px;line-height:1.15;margin:0 0 12px}
  p{color:#5B6B63;font-size:14.5px;line-height:1.65;margin:0 0 26px}
  button{font-family:inherit;background:#B88E2F;color:#fff;border:0;border-radius:999px;padding:12px 30px;font-size:14px;font-weight:600;cursor:pointer}
  button:hover{background:#A67D24}
</style>
</head>
<body>
<div class="card">
  <div class="mark"><img src="/favicon-32.png" alt="" onerror="this.remove()"></div>
  <h1>You&rsquo;re offline.</h1>
  <p>ServePoint needs a connection for orders, bills and the kitchen rail &mdash; nothing was lost. The counter picks up where it left off once you&rsquo;re back online.</p>
  <button onclick="location.reload()">Try again</button>
</div>
</body>
</html>`;

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
      new Response(OFFLINE_PAGE, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
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
