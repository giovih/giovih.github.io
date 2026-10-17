// Fa aprire l'app anche senza internet (le pagine vengono tenute in memoria).
const CACHE = "armadio-v3";
const FILE = [
  "./", "index.html", "style.css", "app.js", "stilista.js", "archivio.js", "meteo.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(n => n.startsWith("armadio-") && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Prima prova la rete (così gli aggiornamenti arrivano subito), se non c'è usa la copia.
// Il meteo non passa di qui: l'app tiene da sola le ultime previsioni.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
