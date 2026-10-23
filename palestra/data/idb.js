// Piccolo involucro di IndexedDB con le Promise.
// Archivi: records (dati), blobs (foto), meta (stato della sincronizzazione e flag).

const NOME = 'palestra2';
const VERSIONE = 1;
let dbp = null;

const req = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

export function apri() {
  if (dbp) return dbp;
  dbp = new Promise((ok, ko) => {
    const r = indexedDB.open(NOME, VERSIONE);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: ['kind', 'id'] });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => {
      const db = r.result;
      // se un'altra scheda aggiorna il database, chiudo per non bloccarla
      db.onversionchange = () => db.close();
      ok(db);
    };
    r.onerror = () => ko(r.error);
    r.onblocked = () => console.warn('IndexedDB bloccato da un\'altra scheda');
  });
  return dbp;
}

export async function tutti(store) {
  const db = await apri();
  return req(db.transaction(store).objectStore(store).getAll());
}

export async function leggi(store, key) {
  const db = await apri();
  return req(db.transaction(store).objectStore(store).get(key));
}

/** Scrive più valori in una sola transazione. */
export async function scrivi(store, valori) {
  if (!valori.length) return;
  const db = await apri();
  await new Promise((ok, ko) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of valori) os.put(v);
    tx.oncomplete = ok;
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error);
  });
}

export async function cancella(store, key) {
  const db = await apri();
  await new Promise((ok, ko) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = ok;
    tx.onerror = () => ko(tx.error);
  });
}

export async function svuota(store) {
  const db = await apri();
  await new Promise((ok, ko) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = ok;
    tx.onerror = () => ko(tx.error);
  });
}

/** Legge un database IndexedDB della versione precedente (senza crearlo se non esiste). */
export function leggiDbEsterno(nome, store) {
  return new Promise(ok => {
    let creato = false;
    const r = indexedDB.open(nome);
    r.onupgradeneeded = () => { creato = true; };
    r.onsuccess = () => {
      const db = r.result;
      if (creato || !db.objectStoreNames.contains(store)) {
        db.close();
        if (creato) indexedDB.deleteDatabase(nome);
        return ok([]);
      }
      const g = db.transaction(store).objectStore(store).getAll();
      g.onsuccess = () => { ok(g.result || []); db.close(); };
      g.onerror = () => { ok([]); db.close(); };
    };
    r.onerror = () => ok([]);
  });
}
