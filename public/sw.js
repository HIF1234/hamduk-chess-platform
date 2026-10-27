// Hand-written on purpose -- vite-plugin-pwa's build-time generation doesn't run with
// TanStack Start's production build (open upstream bug, github.com/TanStack/router/issues/4988),
// and this app's actual caching needs are narrow enough not to need Workbox anyway.
//
// Scope, deliberately:
//  - /api/* and anything cross-origin (Supabase, including its realtime websocket): never
//    touched. A service worker can't intercept a WebSocket upgrade at all, and caching a
//    live game-state response even briefly is a correctness bug, not just staleness.
//  - HTML navigations: network-first. This app ships multiple deploys a day; a visitor
//    should never get stuck on a cached old shell. Falls back to a cached copy only if
//    there's truly no network, so the installed app still opens offline.
//  - Vite's hashed /assets/* files and /icons/*: cache-first. The filename changes whenever
//    the content does, so serving a cached copy is always correct, not just fast.
//
// Bump this on any change to the strategy below (not on every deploy -- static assets are
// content-hashed and don't need it); old caches are swept on activate.
const CACHE_VERSION = "v1";
const CACHE_NAME = `hamduk-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fonts, etc. -- untouched
  if (url.pathname.startsWith("/api/")) return; // live data, never cached

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached ?? caches.match("/");
        }
      })(),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
  }
});
