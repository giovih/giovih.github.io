// Fa funzionare l'app anche senza internet (in palestra spesso non c'è campo).
const CACHE = "palestra1-v7";
const FILE = ["./", "index.html", "style.css", "app.js", "dati.js", "cibo.js", "extra.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n.startsWith("palestra1-") && n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});
// Prima la rete (aggiornamenti subito), senza rete la copia salvata.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
