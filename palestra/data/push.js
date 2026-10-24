// Notifiche push (Web Push): permesso, iscrizione e promemoria programmati sul server.
//
// Come funziona: il telefono calcola i promemoria dei prossimi 14 giorni (core/reminders.js) e li manda a Supabase;
// il server li invia all'ora giusta come notifiche push, anche ad app chiusa. Il recupero tra le serie
// viene programmato quando parte il timer e annullato se lo salti.
// Su iPhone le notifiche web funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivo).

import * as C from './cloud.js';
import * as S from './store.js';
import * as R from './rest.js';
import { calcolaPromemoria, notificaRecupero } from '../core/reminders.js';
import { isoDay, addDaysIso } from '../core/dates.js';

const ascoltatori = new Set();
const avvisa = () => { for (const f of ascoltatori) { try { f(); } catch (e) { console.error(e); } } };
export const ascolta = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };

export const iOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const installata = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const supportate = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const permesso = () => ('Notification' in window ? Notification.permission : 'non-supportate');

/** Stato per la pagina delle notifiche. */
export async function stato() {
  let iscritto = false;
  if (supportate() && permesso() === 'granted') {
    try { iscritto = !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch { /* niente */ }
  }
  return {
    supportate: supportate(), installata: installata(), iOS: iOS(), permesso: permesso(),
    iscritto, collegato: C.collegato(), ultimaProgrammazione: S.getMeta('pushProgrammato', null),
  };
}

const b64urlInByte = s => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};
const byteInB64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let chiaveServer = null;
async function chiavePubblica() {
  if (!chiaveServer) {
    const r = await C.funzione('push', { azione: 'chiave' });
    if (!r?.chiave) throw new C.ErroreCloud('Il server delle notifiche non è pronto.', 'push_chiave', 0);
    chiaveServer = r.chiave;
  }
  return chiaveServer;
}

/** Chiede il permesso e iscrive il telefono alle notifiche del server. */
export async function attiva() {
  if (!supportate()) {
    throw new Error(iOS() && !installata()
      ? 'Prima aggiungi l\'app alla schermata Home (Condividi, poi "Aggiungi alla schermata Home") e aprila da lì.'
      : 'Questo browser non supporta le notifiche.');
  }
  const p = await Notification.requestPermission();
  avvisa();
  if (p !== 'granted') throw new Error('Notifiche non permesse. Puoi attivarle in Impostazioni, Notifiche, Palestra.');
  if (!C.collegato()) return { soloLocali: true };
  await iscrivi();
  await programmaPromemoria(true);
  return { soloLocali: false };
}

/** Iscrizione Web Push (rifatta se la chiave del server è cambiata). */
export async function iscrivi() {
  const reg = await navigator.serviceWorker.ready;
  const chiave = await chiavePubblica();
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const attuale = sub.options?.applicationServerKey ? byteInB64url(sub.options.applicationServerKey) : null;
    if (attuale && attuale !== chiave) { await sub.unsubscribe().catch(() => {}); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlInByte(chiave) });
  const j = sub.toJSON();
  await C.rpc('push_iscrivi', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  await S.setMeta('pushEndpoint', j.endpoint);
  avvisa();
  return true;
}

/** Disattiva le notifiche su questo telefono. */
export async function disattiva() {
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      if (C.collegato()) await C.rpc('push_disiscrivi', { p_endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } finally {
    await S.setMeta('pushEndpoint', null);
    avvisa();
  }
}

/** Cose già fatte (per non ricordarle): creatina presa, acqua bevuta, allenamento fatto. */
function fatti() {
  const oggi = isoDay();
  const out = { creatina: {}, acquaMl: {}, allenamento: {} };
  for (const g of S.lista('giorno')) {
    if (g.id < oggi) continue;
    if (g.creatina) out.creatina[g.id] = true;
    if (g.acquaMl) out.acquaMl[g.id] = g.acquaMl;
  }
  for (const s of S.lista('sessione')) {
    if (s.fine) out.allenamento[isoDay(new Date(s.data))] = true;
  }
  return out;
}

/** I prossimi promemoria (anche per mostrarli nelle impostazioni). */
export const prossimiPromemoria = (giorni = 14) => calcolaPromemoria(S.impostazioni(), { ora: new Date(), giorni, fatti: fatti() });

let timerProgramma = 0;
let ultimaFirma = '';
/**
 * Manda al server i promemoria dei prossimi 14 giorni (sostituisce quelli vecchi non ancora inviati).
 * Si chiama dopo ogni modifica utile, con un piccolo ritardo per raggruppare le modifiche.
 */
export async function programmaPromemoria(subito = false) {
  clearTimeout(timerProgramma);
  if (!subito) { timerProgramma = setTimeout(() => programmaPromemoria(true).catch(() => {}), 4000); return; }
  if (!C.collegato() || permesso() !== 'granted' || !S.getMeta('pushEndpoint')) return;
  const lista = prossimiPromemoria(14);
  const firma = JSON.stringify(lista.map(x => [x.tag, x.invio, x.testo]));
  if (firma === ultimaFirma) return;
  await C.rpc('push_programma', {
    p_lista: lista.map(({ tag, invio, scade, titolo, testo, url, categoria }) => ({ tag, invio, scade, titolo, testo, url, categoria })),
    p_da: new Date().toISOString(),
    p_a: new Date(addDaysIso(isoDay(), 15)).toISOString(),
  });
  ultimaFirma = firma;
  await S.setMeta('pushProgrammato', new Date().toISOString());
  avvisa();
}

/** Notifica di prova: dal server se possibile (prova vera), altrimenti direttamente dal telefono. */
export async function prova() {
  if (permesso() !== 'granted') throw new Error('Prima attiva le notifiche.');
  if (C.collegato() && S.getMeta('pushEndpoint')) {
    await C.rpc('push_prova', {});
    return 'server';
  }
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Palestra', { body: 'Le notifiche funzionano.', tag: 'prova', icon: 'icons/icon-192.png', badge: 'icons/icon-96.png' });
  return 'locale';
}

/** Collega il timer di recupero: quando parte programma la notifica sul server, quando lo salti la annulla. */
export function collegaRecupero() {
  R.collega(st => {
    if (!C.collegato() || permesso() !== 'granted' || !S.impostazioni().notifiche.recupero || !S.getMeta('pushEndpoint')) return;
    const p = st.fine && st.fine > Date.now() + 3000
      ? C.rpc('push_recupero', { p_notifica: notificaRecupero(st.fine, st.prossimo) })
      : C.rpc('push_annulla_recupero', {});
    p.catch(() => { /* senza rete: suona comunque l'app se è aperta */ });
  });
}
