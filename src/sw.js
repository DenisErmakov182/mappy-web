/*
 * Mappy intentionally does not cache its application shell in the service
 * worker. The product depends on live map, API and photo requests, while a
 * cached shell can keep an obsolete deployment alive on iOS.
 *
 * There is deliberately no install/skipWaiting handler: an already open PWA
 * keeps its current runtime. This worker activates naturally only after all
 * Mappy windows close, then removes caches left by the former Workbox worker.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))),
    ),
  );
});
