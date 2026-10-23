// In che settimana del programma sono: cicli di 8 settimane, l'ottava è di scarico.

import { parseDay, mondayOf, DAY_MS, isoDay } from './dates.js';

/**
 * @param {string} inizio  lunedì (o qualsiasi giorno) della settimana 1, "AAAA-MM-GG"
 * @param {string} giorno  giorno da valutare, "AAAA-MM-GG"
 */
export function settimanaProgramma(inizio, giorno = isoDay()) {
  const a = mondayOf(parseDay(inizio) || new Date());
  const b = mondayOf(parseDay(giorno) || new Date());
  // arrotondo per il cambio dell'ora legale
  const n = Math.max(0, Math.round((b - a) / (7 * DAY_MS))) + 1;
  const ciclo = ((n - 1) % 8) + 1;
  return {
    n,                              // settimana totale: 1, 2, 3…
    ciclo,                          // 1…8
    scarico: ciclo === 8,           // metà serie, -10% di peso
    drop: ciclo >= 5 && ciclo < 8,  // drop set sull'ultima serie di alcuni esercizi
    diario: n === 1 || n % 4 === 0, // settimane 1, 4, 8, 12…
  };
}
