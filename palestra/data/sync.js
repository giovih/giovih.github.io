// Sincronizzazione con Supabase. Prima di tutto il telefono: l'app funziona sempre offline e
// quando c'è rete manda le modifiche e riceve quelle degli altri dispositivi.
//
// Regole (vedi core/sync-merge.js): per ogni record vince la modifica più recente; gli id sono unici,
// quindi niente doppioni; le cancellazioni viaggiano come "lapidi" (deleted = true).
// Ordine di ogni giro: 1) ricevo  2) mando  3) foto. Ricevere prima evita che un telefono appena installato
// sovrascriva i dati veri con quelli iniziali (che comunque sono "deboli", vedi store.js).

import * as S from './store.js';
import * as C from './cloud.js';
import { eVecchioStato } from '../core/migrate.js';

const SOVRAPPOSIZIONE = 10000;   // ms: riscarico gli ultimi 10 s per non perdere scritture arrivate in ritardo
const PAGINA = 500;
const OGNI = 60000;              // controllo le novità ogni minuto mentre l'app è aperta
const BUCKET = 'foto';

const ascoltatori = new Set();
let st = { fase: C.collegato() ? 'inattivo' : 'spento', ultimo: S.getMeta('syncUltimo', null), daInviare: 0, errore: null };
const avvisa = () => { for (const f of ascoltatori) { try { f({ ...st }); } catch (e) { console.error(e); } } };
const imposta = patch => { st = { ...st, ...patch }; avvisa(); };

export const ascolta = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };
export const stato = () => ({ ...st, daInviare: S.quantiDaInviare() });

let inCorso = null;
let ancora = false;

/** Un giro completo di sincronizzazione (uno alla volta; se ne chiedi un altro mentre gira, parte subito dopo). */
export function sincronizzaOra() {
  if (!C.collegato()) { imposta({ fase: 'spento' }); return Promise.resolve(); }
  if (inCorso) { ancora = true; return inCorso; }
  inCorso = (async () => {
    try {
      do {
        ancora = false;
        await giro();
      } while (ancora);
    } finally {
      inCorso = null;
    }
  })();
  return inCorso;
}

async function giro() {
  if (navigator.onLine === false) { imposta({ fase: 'offline' }); return; }
  try {
    const uid = C.utente()?.id;
    if (!uid) return;
    // cambio di account (o primo collegamento): riparto da zero e mando tutto quello che c'è sul telefono
    const primo = S.getMeta('syncUtente') !== uid;
    if (primo) {
      await S.setMeta('syncUtente', uid);
      await S.setMeta('syncCursore', null);
      await S.setMeta('fotoRemoteEliminate', []);
      S.segnaTuttoDaInviare();
    }
    imposta({ fase: 'ricezione', errore: null });
    await ricevi(primo || !S.getMeta('syncCursore'));
    if (!S.getMeta('statoV1Controllato')) await recuperaVersionePrecedente(uid);
    imposta({ fase: 'invio' });
    await invia();
    await foto(uid);
    const ora = new Date().toISOString();
    await S.setMeta('syncUltimo', ora);
    imposta({ fase: 'inattivo', ultimo: ora, errore: null, daInviare: S.quantiDaInviare() });
  } catch (e) {
    const offline = e?.codice === 'offline';
    imposta({ fase: offline ? 'offline' : 'errore', errore: offline ? null : (e?.message || 'Errore di sincronizzazione'), daInviare: S.quantiDaInviare() });
    if (!offline) console.warn('sync', e);
  }
}

/** Scarica le novità a pagine, ripartendo un po' prima dell'ultimo segnalibro. */
async function ricevi(primoGiro) {
  const segno = S.getMeta('syncCursore') || { ts: 0, kind: '', id: '' };
  let cur = { ts: Math.max(0, (segno.ts || 0) - SOVRAPPOSIZIONE), kind: '', id: '' };
  let massimo = segno;
  for (let pagine = 0; pagine < 200; pagine++) {
    const r = await C.rpc('sync_pull', { p_ts: cur.ts, p_kind: cur.kind, p_id: cur.id, p_limite: PAGINA });
    const righe = r?.righe || [];
    if (righe.length) {
      // al primo collegamento valgono le impostazioni salvate online (non quelle iniziali di questo telefono)
      S.applicaDalServer(righe, { forza: primoGiro ? ['impostazioni'] : [] });
      await eliminaFotoLocaliCancellate(righe);
      const u = righe[righe.length - 1];
      cur = { ts: +u.server_ts, kind: u.kind, id: u.id };
      if (cur.ts > (massimo.ts || 0) || (cur.ts === massimo.ts && `${cur.kind}/${cur.id}` > `${massimo.kind}/${massimo.id}`)) massimo = cur;
    }
    if (!r?.altri) break;
  }
  await S.setMeta('syncCursore', massimo);
}

/** Manda le modifiche del telefono. I record che il server ha già più nuovi tornano indietro e li applico. */
async function invia() {
  for (let giri = 0; giri < 100; giri++) {
    const lotto = S.daInviare(200);
    if (!lotto.length) return;
    const righe = lotto.map(({ kind, id, data, updated, deleted }) => ({ kind, id, data: deleted ? null : data, updated, deleted: !!deleted }));
    const r = await C.rpc('sync_push', { p_righe: righe });
    // inviati: non più "da mandare" (a meno che non siano cambiati nel frattempo)
    S.segnaComeInviati(lotto);
    // il server aveva già una versione più nuova (o uguale): tengo quella, così tutti i telefoni convergono
    if (r?.rifiutati?.length) S.applicaDalServer(r.rifiutati);
    if (lotto.length < 200) return;
  }
}

/* ---------- foto di progresso (spazio privato "foto") ---------- */

const percorso = (uid, key) => `${uid}/${key.replace(/^foto\//, '')}.jpg`;

async function foto(uid) {
  // 1. carico quelle nuove (solo se la foto esiste ancora)
  const vive = new Set(S.lista('foto').map(f => f.id));
  for (const b of await S.blobDaCaricare()) {
    const id = b.key.replace(/^foto\//, '').replace(/_t$/, '');
    if (!b.key.startsWith('foto/') || !vive.has(id) || !b.blob) continue;
    await C.caricaFile(BUCKET, percorso(uid, b.key), b.blob);
    await S.segnaBlobCaricato(b.key);
  }
  // 2. scarico quelle che mancano (prima le miniature)
  for (const tipo of ['_t', '']) {
    for (const f of S.lista('foto')) {
      const key = `foto/${f.id}${tipo}`;
      if (await S.leggiBlob(key)) continue;
      try {
        const blob = await C.scaricaFile(BUCKET, percorso(uid, key));
        await S.salvaBlob(key, blob, true);
      } catch (e) {
        if (e?.status !== 400 && e?.status !== 404) throw e; // non c'è ancora online: arriverà dal telefono che l'ha fatta
      }
    }
  }
  // 3. cancello online quelle eliminate
  const fatte = new Set(S.getMeta('fotoRemoteEliminate', []));
  const lapidi = S.lapidi('foto').filter(id => !fatte.has(id));
  if (lapidi.length) {
    await C.eliminaFile(BUCKET, lapidi.flatMap(id => [percorso(uid, `foto/${id}`), percorso(uid, `foto/${id}_t`)]));
    await S.setMeta('fotoRemoteEliminate', [...fatte, ...lapidi].slice(-2000));
  }
}

/** Una foto cancellata su un altro telefono: tolgo anche le immagini da questo. */
async function eliminaFotoLocaliCancellate(righe) {
  for (const r of righe) {
    if (r.kind === 'foto' && r.deleted) {
      await S.eliminaBlob(`foto/${r.id}`);
      await S.eliminaBlob(`foto/${r.id}_t`);
    }
  }
}

/**
 * La versione precedente salvava tutto in una tabella "stato": se c'è, la importo una volta
 * (gli id sono gli stessi dell'importazione dal telefono, quindi niente doppioni).
 */
async function recuperaVersionePrecedente(uid) {
  try {
    const righe = await C.rest(`/rest/v1/stato?select=dati&user_id=eq.${uid}`);
    const dati = righe?.[0]?.dati;
    if (eVecchioStato(dati)) await S.importaVecchio(dati, []);
  } catch (e) {
    if (e?.codice === 'offline') throw e; // riprovo al prossimo giro
    // la tabella non c'è (progetto nuovo): niente da recuperare
  }
  await S.setMeta('statoV1Controllato', true);
}

/* ---------- avvio ---------- */

let timerModifiche = 0;
let avviato = false;

/** Avvia la sincronizzazione automatica (una volta, all'avvio dell'app). */
export function avviaSync() {
  if (avviato) return;
  avviato = true;
  // il link di conferma dell'email riapre l'app con l'accesso già fatto
  C.leggiTokenDaIndirizzo();
  // dopo ogni modifica sul telefono mando entro 2 secondi
  S.ascolta(() => {
    if (!C.collegato() || !S.quantiDaInviare()) return;
    clearTimeout(timerModifiche);
    timerModifiche = setTimeout(() => sincronizzaOra(), 2000);
  });
  C.ascolta(s => {
    if (s.collegato) sincronizzaOra();
    else imposta({ fase: 'spento', errore: null });
  });
  addEventListener('online', () => sincronizzaOra());
  addEventListener('offline', () => imposta({ fase: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // prima che iOS sospenda l'app provo a mandare le ultime modifiche
      if (C.collegato() && S.quantiDaInviare()) sincronizzaOra();
    } else if (C.collegato()) {
      const ultimo = st.ultimo ? Date.parse(st.ultimo) : 0;
      if (Date.now() - ultimo > 15000) sincronizzaOra();
    }
  });
  setInterval(() => { if (!document.hidden && C.collegato()) sincronizzaOra(); }, OGNI);
  if (C.collegato()) sincronizzaOra();
}
