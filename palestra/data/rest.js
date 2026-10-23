// Timer di recupero tra le serie. Salva l'ora di fine: resta giusto anche se l'app viene chiusa.
// Quando parte, se le notifiche sono attive, chiede al server di mandare una notifica a fine recupero.

const CHIAVE = 'palestra-recupero';
const ascoltatori = new Set();
let collegamento = null; // funzione chiamata a ogni cambio (programma o annulla la notifica)

function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
    if (s && s.fine > Date.now() - 5000) return s;
  } catch { /* niente */ }
  return { fine: null, totale: 0, prossimo: null, sessione: null };
}

let stato = carica();

function cambia(nuovo, avvisa = true) {
  stato = nuovo;
  try { localStorage.setItem(CHIAVE, JSON.stringify(stato)); } catch { /* niente */ }
  for (const f of ascoltatori) f(stato);
  if (avvisa && collegamento) { try { collegamento(stato); } catch (e) { console.error(e); } }
}

export const ascolta = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };
export const statoRecupero = () => stato;
export const inCorso = (ora = Date.now()) => !!stato.fine && stato.fine > ora;
export const rimanente = (ora = Date.now()) => (stato.fine ? Math.max(0, Math.ceil((stato.fine - ora) / 1000)) : 0);

/** Imposta la funzione che programma la notifica push (vedi data/push.js). */
export const collega = fn => { collegamento = fn; };

export function avvia(secondi, prossimo = null, sessione = null) {
  const s = Math.max(5, Math.round(secondi));
  cambia({ fine: Date.now() + s * 1000, totale: s, prossimo, sessione });
}

export function aggiungi(delta) {
  if (!stato.fine) return;
  const fine = Math.max(Date.now() + 1000, stato.fine + delta * 1000);
  cambia({ ...stato, fine, totale: Math.max(5, stato.totale + delta) });
}

export function salta() {
  if (!stato.fine) return;
  cambia({ fine: null, totale: 0, prossimo: null, sessione: null });
}

/**
 * Il tempo è finito con l'app aperta: chiudo il timer. Se la notifica non è ancora partita
 * dal server la annullo (non serve: l'app ha già suonato).
 */
export function concluso() {
  if (!stato.fine) return;
  cambia({ fine: null, totale: 0, prossimo: null, sessione: null });
}
