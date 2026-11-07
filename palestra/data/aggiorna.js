// Aggiornamento dell'app: controlla se sul sito c'è una versione nuova e la installa.

/** Forza l'aggiornamento: scarica i file nuovi dal sito e ricarica l'app (i dati restano, sono nel telefono). */
export async function aggiornaOra() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    reg?.waiting?.postMessage({ tipo: 'attiva' });
  } catch { /* senza rete: ricarico comunque */ }
  try {
    for (const n of await caches.keys()) if (n.startsWith('pal2-')) await caches.delete(n);
  } catch { /* niente */ }
  location.reload();
}
