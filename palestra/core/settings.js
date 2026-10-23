// Impostazioni dell'app (un solo record, sincronizzato).

import { CALENDARIO_BASE, schedeIniziali, SCHEDE } from './scheda.js';
import { OBIETTIVI_BASE } from './nutrition.js';

/** Lunedì della settimana 1 (prima settimana in cui è stata usata l'app). */
export const INIZIO_PROGRAMMA = '2026-10-12';
export const PESO_PARTENZA = 56.1;

export function impostazioniIniziali() {
  return {
    versione: 2,
    inizioProgramma: INIZIO_PROGRAMMA,
    pesoPartenza: PESO_PARTENZA,
    altezza: 172,
    calendario: { ...CALENDARIO_BASE },
    schede: schedeIniziali(),
    // Seduta facoltativa per gli avambracci in un giorno di riposo (2 = martedì, 4 = giovedì).
    avambracci: { attivo: false, giorno: 2 },
    // Orario in cui vai in palestra: serve per i promemoria (pranzo prima, merenda dopo).
    palestra: { ora: '16:00', perGiorno: {} },
    obiettivi: { ...OBIETTIVI_BASE, baseKcalMin: OBIETTIVI_BASE.kcalMin, baseKcalMax: OBIETTIVI_BASE.kcalMax, ultimoAggiustamento: null },
    notifiche: {
      recupero: true,
      allenamento: { on: true, anticipo: 60 },
      pesata: { on: true, giorno: 1, ora: '07:00' },
      colazione: { on: true, ora: '07:00' },
      spuntino: { on: true, ora: '10:00' },
      pranzo: { on: true, auto: true, ora: '13:30', anticipo: 90 },
      merenda: { on: true, auto: true, ora: '17:00', dopo: 105 },
      cena: { on: true, ora: '20:00' },
      notte: { on: true, ora: '22:30' },
      creatina: { on: true, ora: '07:30' },
      acqua: { on: true, ore: ['10:30', '13:00', '16:30', '19:00'] },
    },
    tema: 'auto', // auto | scuro | chiaro
  };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/** Unisce i valori salvati con quelli predefiniti (così i campi nuovi esistono sempre). */
function unisci(base, salvato) {
  if (!isObj(salvato)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(salvato)) {
    if (v === undefined) continue;
    out[k] = isObj(base[k]) && isObj(v) ? unisci(base[k], v) : v;
  }
  return out;
}

/** Impostazioni sempre complete e valide, anche se salvate da una versione precedente. */
export function normalizzaImpostazioni(salvate) {
  const s = unisci(impostazioniIniziali(), salvate);
  // le schede: tengo quelle salvate ma completo nome/tono/sotto se mancano
  const schede = {};
  for (const [cod, def] of Object.entries(SCHEDE)) {
    const x = salvate?.schede?.[cod];
    schede[cod] = x && Array.isArray(x.righe) && x.righe.length
      ? { ...JSON.parse(JSON.stringify(def)), righe: x.righe.filter(r => r && r.ex) }
      : JSON.parse(JSON.stringify(def));
  }
  s.schede = schede;
  for (let d = 1; d <= 7; d++) {
    const c = s.calendario[d];
    if (c != null && !schede[c]) s.calendario[d] = null;
  }
  if (![2, 4].includes(+s.avambracci.giorno)) s.avambracci.giorno = 2;
  if (!['auto', 'scuro', 'chiaro'].includes(s.tema)) s.tema = 'auto';
  return s;
}

/** Orario della palestra in un giorno della settimana (1 = lunedì). */
export const oraPalestra = (imp, giornoSett) => imp?.palestra?.perGiorno?.[giornoSett] || imp?.palestra?.ora || '16:00';

/** Seduta prevista in un giorno della settimana (1-7), compresa quella facoltativa degli avambracci. */
export function sedutaDelGiorno(imp, giornoSett) {
  const c = imp?.calendario?.[giornoSett];
  if (c) return c;
  if (imp?.avambracci?.attivo && +imp.avambracci.giorno === giornoSett) return 'F';
  return null;
}
