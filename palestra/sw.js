// Service worker: l'app funziona senza internet e riceve le notifiche push.
// Aggiorna VERSIONE a ogni pubblicazione: il telefono scarica la nuova versione da solo.

const VERSIONE = '2.2.0';
const CACHE = 'pal2-' + VERSIONE;

const FILE = [
  './', 'index.html', 'manifest.webmanifest', 'app.js',
  'lib/preact.js', 'lib/zxing.js',
  'ui/design.css', 'ui/screens.css', 'ui/icons.js', 'ui/kit.js', 'ui/overlay.js', 'ui/haptics.js', 'ui/charts.js', 'ui/keypad.js', 'ui/scanner.js',
  'core/dates.js', 'core/format.js', 'core/scheda.js', 'core/cycle.js', 'core/progression.js', 'core/nutrition.js',
  'core/foods.js', 'core/alimenti-extra.js', 'core/settings.js', 'core/reminders.js', 'core/migrate.js', 'core/sync-merge.js', 'core/coach.js', 'core/stats.js',
  'data/idb.js', 'data/store.js', 'data/actions.js', 'data/cloud.js', 'data/sync.js', 'data/push.js', 'data/off.js', 'data/ai.js', 'data/rest.js',
  'screens/app-shell.js', 'screens/oggi.js', 'screens/allenamento.js', 'screens/cibo.js', 'screens/aggiungi-cibo.js',
  'screens/progressi.js', 'screens/pr-corpo.js', 'screens/pr-allenamenti.js', 'screens/pr-agenda.js', 'screens/pr-diario.js',
  'screens/coach.js', 'screens/altro.js', 'screens/al-programma.js', 'screens/al-notifiche.js', 'screens/al-account.js', 'screens/al-prepara.js', 'screens/al-varie.js',
  'screens/comuni.js',
  'icons/icon-96.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // "reload" evita la cache HTTP di GitHub Pages (10 minuti)
    await Promise.all(FILE.map(async f => {
      try { await c.put(f, await fetch(new Request(f, { cache: 'reload' }))); } catch { /* il file arriverà dalla rete */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomi = await caches.keys();
    // tolgo le versioni vecchie di questa app e la cache della prima versione ("palestra-v5"…);
    // "palestra1-…" è della copia in /v1/ e resta
    const vecchia = n => (n.startsWith('pal2-') && n !== CACHE) || /^palestra-v\d+$/.test(n);
    await Promise.all(nomi.filter(vecchia).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;              // Supabase, Open Food Facts: sempre rete
  if (!url.pathname.startsWith(new URL('./', location).pathname)) return;
  if (url.pathname.includes('/v1/')) return;                 // versione precedente: ha il suo service worker

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // Pagine: sempre l'app (index.html), anche con #ancore o parametri
    if (req.mode === 'navigate') {
      const r = await c.match('index.html') || await c.match('./');
      if (r) return r;
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && r.type === 'basic') c.put(req, r.clone());
      return r;
    } catch (err) {
      if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
      throw err;
    }
  })());
});

/* ---------- notifiche push ---------- */

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titolo: 'Palestra', testo: e.data ? e.data.text() : '' }; }
  const titolo = d.titolo || 'Palestra';
  e.waitUntil(self.registration.showNotification(titolo, {
    body: d.testo || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-96.png',
    data: { url: d.url || './' },
    timestamp: Date.now(),
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const dest = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const tutti = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of tutti) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ tipo: 'apri', url: dest });
        return;
      }
    }
    await self.clients.openWindow(dest);
  })());
});

self.addEventListener('message', e => {
  if (e.data?.tipo === 'versione') e.source?.postMessage({ tipo: 'versione', versione: VERSIONE });
});
