const CACHE_NAME = "partyhub-static-v2";
const STATIC_PATHS = ["/manifest.webmanifest", "/offline.html", "/icons/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_PATHS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith("partyhub-static-") && key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigation is network-first. Only a generic offline document is cached;
  // invitation pages, auth state and all private API responses remain uncached.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/offline.html")) || Response.error())
    );
    return;
  }

  // Cache immutable Next.js build assets and the public app manifest only.
  if (url.pathname.startsWith("/_next/static/") || STATIC_PATHS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(async cached => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          await caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
    );
  }
});
