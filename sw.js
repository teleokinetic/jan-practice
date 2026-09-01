/* Jan's Practice Map — offline support.
   The shell (page, manifest, icons, the movement frames) is precached, then refreshed in the
   background on every load. Videos stream from YouTube and are never cached. copy.json is never
   served from cache (the app fetches it with cache: 'no-store'). Bump CACHE on every deploy. */
var CACHE = "jan-map-v2";
var SHELL = ["./", "./index.html", "./manifest.webmanifest",
             "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png",
             "./img/phrase-thumb.jpg", "./img/stork-frame.jpg", "./img/hinge-frame.jpg"];

self.addEventListener("install", function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(CACHE);
    await c.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var names = await caches.keys();
    await Promise.all(names.filter(function (n) { return n !== CACHE; })
      .map(function (n) { return caches.delete(n); }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return; // note-sending (FormSubmit POST) etc. → network

  // copy.json is fetched with cache: 'no-store' — always let it go to network.
  if (url.origin === location.origin && /copy\.json$/.test(url.pathname)) return;

  if (url.origin === location.origin) {
    // shell: cache-first, refresh in background
    e.respondWith((async function () {
      var cached = await caches.match(e.request, { ignoreSearch: true });
      var net = fetch(e.request).then(function (r) {
        if (r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, r.clone()); });
        return r;
      }).catch(function () { return cached; });
      return cached || net;
    })());
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    // fonts: cache-first so typography survives offline
    e.respondWith((async function () {
      var cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        var r = await fetch(e.request);
        if (r.ok || r.type === "opaque") { var c = await caches.open(CACHE); c.put(e.request, r.clone()); }
        return r;
      } catch (err) { return Response.error(); }
    })());
  }
  // YouTube and any other cross-origin request: not intercepted → network
});
