// Nile Meridian service worker. Pages: network first (4 s timeout), then the last cached copy, then the
// offline page. Static files: cache first. Only same-origin GETs are handled; outlet links pass through.
const VERSION = "202610071715";
const CACHE = "nm-" + VERSION;
const PRECACHE = ["./", "index.html", "wire.html", "tracker.html", "style.css", "app.js", "offline.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(PRECACHE.map((u) => fetch(u, { cache: "reload" }).then((r) => r.ok && c.put(u, r)).catch(() => {})))
  ).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("nm-") && k !== CACHE)
    .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)); }
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req, { cache: "no-cache" }), timeout(4000)]);
        if (res.ok) cache.put(url.pathname.endsWith("/") ? "./" : req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true }) ||
          (url.pathname.endsWith("/") && await cache.match("./"));
        return hit || cache.match("offline.html");
      }
    })());
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
    return res;
  })));
});
