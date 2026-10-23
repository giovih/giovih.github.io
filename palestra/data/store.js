// Archivio dei dati dell'app: tutto in memoria per essere veloce, salvato in IndexedDB,
// con il flag "dirty" per sapere cosa inviare online.

import * as idb from './idb.js';
import { applicaRemoti, prossimoUpdated, segnaInviati } from '../core/sync-merge.js';
import { normalizzaImpostazioni, impostazioniIniziali } from '../core/settings.js';
import { daVecchioStato, pesiIniziali, eVecchioStato, eBackupNuovo } from '../core/migrate.js';
import { isoDay } from '../core/dates.js';

const recs = new Map();        // "kind/id" → { kind, id, data, updated, deleted, dirty }
const cache = new Map();       // kind → lista già pronta
const meta = {};
const ascoltatori = new Set();
let versione = 0;
let daScrivere = new Map();
let timerScrittura = null;
let notificaInCoda = false;

const chiave = (kind, id) => `${kind}/${id}`;

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  }));

/* ---------- ascolto dei cambiamenti ---------- */

export function ascolta(fn) { ascoltatori.add(fn); return () => ascoltatori.delete(fn); }
export const getVersione = () => versione;

function notifica() {
  versione++;
  if (notificaInCoda) return;
  notificaInCoda = true;
  queueMicrotask(() => {
    notificaInCoda = false;
    for (const fn of ascoltatori) { try { fn(versione); } catch (e) { console.error(e); } }
  });
}

/* ---------- scrittura su IndexedDB (a gruppi) ---------- */

function accoda(rec) {
  daScrivere.set(chiave(rec.kind, rec.id), rec);
  clearTimeout(timerScrittura);
  timerScrittura = setTimeout(scriviOra, 120);
}

export async function scriviOra() {
  clearTimeout(timerScrittura);
  if (!daScrivere.size) return;
  const lotto = [...daScrivere.values()].map(r => ({ ...r }));
  daScrivere = new Map();
  try { await idb.scrivi('records', lotto); } catch (e) { console.error('Salvataggio non riuscito', e); }
}

// iOS può chiudere l'app in qualsiasi momento: salvo appena va in background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) scriviOra(); });
  addEventListener('pagehide', () => scriviOra());
}

/* ---------- lettura ---------- */

/** Tutti i record (non cancellati) di un tipo, come { id, ...data }. */
export function lista(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const out = [];
  for (const r of recs.values()) if (r.kind === kind && !r.deleted && r.data) out.push({ ...r.data, id: r.id });
  cache.set(kind, out);
  return out;
}

export function leggi(kind, id) {
  const r = recs.get(chiave(kind, id));
  return r && !r.deleted && r.data ? { ...r.data, id: r.id } : null;
}

/* ---------- modifica ---------- */

/** Salva (crea o sostituisce) un record. */
export function salva(kind, id, data) {
  const k = chiave(kind, id);
  const prec = recs.get(k);
  const rec = { kind, id: String(id), data: structuredClone(data), updated: prossimoUpdated(prec?.updated), deleted: false, dirty: true };
  delete rec.data.id;
  recs.set(k, rec);
  cache.delete(kind);
  accoda(rec);
  notifica();
  return { ...rec.data, id: rec.id };
}

/** Modifica un record con una funzione (riceve una copia). */
export function modifica(kind, id, fn, iniziale = null) {
  const att = leggi(kind, id) ?? (iniziale ? structuredClone(iniziale) : null);
  if (!att) return null;
  const nuovo = fn(structuredClone(att)) ?? att;
  return salva(kind, id, nuovo);
}

export function elimina(kind, id) {
  const k = chiave(kind, id);
  const prec = recs.get(k);
  if (!prec || prec.deleted) return;
  const rec = { kind, id: String(id), data: null, updated: prossimoUpdated(prec.updated), deleted: true, dirty: true };
  recs.set(k, rec);
  cache.delete(kind);
  accoda(rec);
  notifica();
}

/* ---------- impostazioni ---------- */

let impCache = null, impVer = -1;
export function impostazioni() {
  if (impCache && impVer === versione) return impCache;
  impCache = normalizzaImpostazioni(leggi('impostazioni', 'impostazioni'));
  impVer = versione;
  return impCache;
}

export function salvaImpostazioni(fn) {
  const nuove = fn(structuredClone(impostazioni())) || impostazioni();
  salva('impostazioni', 'impostazioni', nuove);
  if (!meta.impostazioniToccate) setMeta('impostazioniToccate', true);
}

/* ---------- meta (stato locale non sincronizzato) ---------- */

export const getMeta = (k, def = null) => (k in meta ? meta[k] : def);
export async function setMeta(k, v) {
  meta[k] = v;
  try { await idb.scrivi('meta', [{ key: k, value: v }]); } catch (e) { console.error(e); }
}

/* ---------- foto (blob) ---------- */

const urlBlob = new Map();

export async function salvaBlob(key, blob, caricato = false) {
  await idb.scrivi('blobs', [{ key, blob, caricato }]);
  if (urlBlob.has(key)) { URL.revokeObjectURL(urlBlob.get(key)); urlBlob.delete(key); }
  notifica();
}
export async function leggiBlob(key) { return (await idb.leggi('blobs', key)) || null; }
export async function urlDiBlob(key) {
  if (urlBlob.has(key)) return urlBlob.get(key);
  const b = await leggiBlob(key);
  if (!b?.blob) return null;
  const u = URL.createObjectURL(b.blob);
  urlBlob.set(key, u);
  return u;
}
export async function eliminaBlob(key) {
  await idb.cancella('blobs', key);
  if (urlBlob.has(key)) { URL.revokeObjectURL(urlBlob.get(key)); urlBlob.delete(key); }
}
export async function blobDaCaricare() { return (await idb.tutti('blobs')).filter(b => !b.caricato); }
export async function segnaBlobCaricato(key) {
  const b = await idb.leggi('blobs', key);
  if (b) await idb.scrivi('blobs', [{ ...b, caricato: true }]);
}

/* ---------- sincronizzazione ---------- */

export function daInviare(max = 500) {
  const out = [];
  for (const r of recs.values()) if (r.dirty) { out.push({ ...r }); if (out.length >= max) break; }
  return out;
}
export const quantiDaInviare = () => { let n = 0; for (const r of recs.values()) if (r.dirty) n++; return n; };

export function segnaComeInviati(inviati) {
  const puliti = segnaInviati(recs, inviati);
  for (const r of puliti) accoda(r);
}

export function applicaDalServer(righe) {
  const cambiati = applicaRemoti(recs, righe);
  if (!cambiati.length) return 0;
  for (const r of cambiati) { cache.delete(r.kind); accoda(r); }
  notifica();
  return cambiati.length;
}

/** Segna tutto come da inviare (primo collegamento a un account). */
export function segnaTuttoDaInviare() {
  for (const r of recs.values()) { r.dirty = true; accoda(r); }
}

/* ---------- avvio e importazioni ---------- */

function scriviMolti(lista, sporchi = true) {
  for (const { kind, id, data } of lista) {
    const k = chiave(kind, id);
    const prec = recs.get(k);
    const rec = { kind, id: String(id), data, updated: prossimoUpdated(prec?.updated), deleted: false, dirty: sporchi };
    recs.set(k, rec);
    cache.delete(kind);
    accoda(rec);
  }
}

function dataUrlInBlob(u) {
  const [testa, b64] = u.split(',');
  const tipo = /data:([^;]+)/.exec(testa)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: tipo });
}

/** Importa lo stato della versione precedente (o il suo file di backup). */
export async function importaVecchio(S, fotoVecchie = []) {
  const { impostazioni: imp, records, blob } = daVecchioStato(S, fotoVecchie);
  // le impostazioni importate valgono solo se non le ho già cambiate qui
  if (!leggi('impostazioni', 'impostazioni') || !getMeta('impostazioniToccate')) records.push({ kind: 'impostazioni', id: 'impostazioni', data: imp });
  // non sovrascrivo record più recenti già presenti (es. importo due volte)
  scriviMolti(records.filter(r => !recs.has(chiave(r.kind, r.id)) || r.kind === 'impostazioni'));
  for (const b of blob) { try { await idb.scrivi('blobs', [{ key: b.key, blob: dataUrlInBlob(b.dataUrl), caricato: false }]); } catch (e) { console.error(e); } }
  aggiungiPesiIniziali();
  await scriviOra();
  notifica();
  return records.length;
}

/** Importa un backup nel formato nuovo. */
export async function importaBackup(B) {
  let n = 0;
  for (const r of B.records || []) {
    if (!r?.kind || r.id == null) continue;
    const loc = recs.get(chiave(r.kind, r.id));
    if (loc && loc.updated >= (r.updated || 0)) continue; // ho già una versione uguale o più recente
    recs.set(chiave(r.kind, r.id), { kind: r.kind, id: String(r.id), data: r.deleted ? null : r.data, updated: r.updated || Date.now(), deleted: !!r.deleted, dirty: true });
    cache.delete(r.kind);
    accoda(recs.get(chiave(r.kind, r.id)));
    n++;
  }
  for (const b of B.foto || []) {
    try { await idb.scrivi('blobs', [{ key: b.key, blob: dataUrlInBlob(b.dataUrl), caricato: false }]); } catch (e) { console.error(e); }
  }
  await scriviOra();
  notifica();
  return n;
}

/** Riconosce e importa un file di backup (versione precedente o nuova). */
export async function importaFile(testo) {
  const x = JSON.parse(testo);
  if (eBackupNuovo(x)) return { tipo: 'nuovo', n: await importaBackup(x) };
  if (eVecchioStato(x)) return { tipo: 'vecchio', n: await importaVecchio(x, []) };
  throw new Error('Il file non è un backup dell\'app.');
}

/** Backup completo nel formato nuovo (foto comprese se richiesto). */
export async function creaBackup(conFoto = true) {
  await scriviOra();
  const records = [...recs.values()].filter(r => !r.deleted).map(({ kind, id, data, updated }) => ({ kind, id, data, updated }));
  const foto = [];
  if (conFoto) {
    for (const b of await idb.tutti('blobs')) {
      if (!b.blob) continue;
      const dataUrl = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b.blob); });
      foto.push({ key: b.key, dataUrl });
    }
  }
  return { formato: 'palestra-backup', versione: 2, esportato: new Date().toISOString(), records, foto };
}

function aggiungiPesiIniziali() {
  const pesi = lista('peso').map(p => ({ giorno: p.giorno || p.id, kg: p.kg }));
  const nuovi = pesiIniziali(pesi, impostazioni().inizioProgramma);
  scriviMolti(nuovi.map(p => ({ kind: 'peso', id: p.giorno, data: { giorno: p.giorno, kg: p.kg } })));
}

/** Avvio: carica tutto, migra i dati del sito al primo avvio, aggiunge i pesi iniziali. */
export async function avvia() {
  const [righe, metaRighe] = await Promise.all([idb.tutti('records'), idb.tutti('meta')]);
  for (const r of righe) recs.set(chiave(r.kind, r.id), r);
  for (const m of metaRighe) meta[m.key] = m.value;

  if (!meta.migrato) {
    let vecchio = null;
    try { vecchio = JSON.parse(localStorage.getItem('palestra-v1') || 'null'); } catch { vecchio = null; }
    if (eVecchioStato(vecchio)) {
      const foto = await idb.leggiDbEsterno('palestra-foto', 'foto');
      await importaVecchio(vecchio, foto);
      // dati del vecchio salvataggio online: riuso indirizzo e chiave pubblica del progetto
      try {
        const s = JSON.parse(localStorage.getItem('palestra-sync') || 'null');
        if (s?.url && s?.anon && !localStorage.getItem('palestra-cloud')) {
          localStorage.setItem('palestra-cloud', JSON.stringify({ url: s.url, chiave: s.anon }));
        }
      } catch { /* niente */ }
    }
    if (!leggi('impostazioni', 'impostazioni')) salva('impostazioni', 'impostazioni', impostazioniIniziali());
    aggiungiPesiIniziali();
    // La chiave dell'AI non deve stare sul telefono: ora passa da Supabase.
    try { localStorage.removeItem('palestra-api-key'); } catch { /* niente */ }
    await scriviOra();
    await setMeta('migrato', { quando: new Date().toISOString(), daVecchio: !!vecchio });
  }
  if (!getMeta('pesiIniziali2026')) {
    aggiungiPesiIniziali();
    await scriviOra();
    await setMeta('pesiIniziali2026', true);
  }
  notifica();
}

/** Cancella tutto dal telefono (non tocca i dati online). */
export async function cancellaTutto() {
  recs.clear(); cache.clear(); daScrivere = new Map();
  for (const k of Object.keys(meta)) delete meta[k];
  await Promise.all([idb.svuota('records'), idb.svuota('blobs'), idb.svuota('meta')]);
  salva('impostazioni', 'impostazioni', impostazioniIniziali());
  aggiungiPesiIniziali();
  await scriviOra();
  await setMeta('migrato', { quando: new Date().toISOString(), daVecchio: false });
  notifica();
}

export const oggi = () => isoDay();
