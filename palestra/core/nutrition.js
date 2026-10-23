// Calcoli su calorie, macro e peso corporeo.
//
// L'obiettivo è SALIRE di peso (+0,25-0,5 kg a settimana). I consigli possono aumentare le calorie;
// la riduzione di 200 kcal (se sali più di 0,7 kg a settimana per più settimane) non porta mai
// l'obiettivo sotto quello di partenza della scheda.

import { daysBetween, addDaysIso, parseDay } from './dates.js';
import { fmtNum } from './format.js';

export const MACRO = ['kcal', 'prot', 'carb', 'grassi'];

/** Somma di calorie e macro di una lista di cibi (arrotondate). */
export function totali(voci) {
  const t = { kcal: 0, prot: 0, carb: 0, grassi: 0 };
  for (const v of voci || []) for (const k of MACRO) t[k] += +v?.[k] || 0;
  for (const k of MACRO) t[k] = Math.round(t[k]);
  return t;
}

/** Valori per una quantità a partire da quelli per 100 g (o 100 ml). */
export function perQuantita(per100, grammi) {
  const f = (+grammi || 0) / 100;
  const out = {};
  for (const k of MACRO) out[k] = Math.round((+per100?.[k] || 0) * f * 10) / 10;
  out.kcal = Math.round(out.kcal);
  return out;
}

/** kcal stimate dai macro (4/4/9). */
export const kcalDaMacro = ({ prot = 0, carb = 0, grassi = 0 }) => Math.round(prot * 4 + carb * 4 + grassi * 9);

/** Percentuale (0-1, limitata) di un valore rispetto all'obiettivo. */
export const quota = (v, obiettivo) => obiettivo > 0 ? Math.max(0, Math.min(1, v / obiettivo)) : 0;

/** Obiettivi giornalieri iniziali della scheda. */
export const OBIETTIVI_BASE = { kcalMin: 3000, kcalMax: 3300, proteine: 120, carboidrati: 400, grassi: 85, acquaMl: 2500 };

/** Velocità consigliata di aumento di peso (kg a settimana). */
export const RITMO = { min: 0.25, max: 0.5, troppo: 0.7 };

/** Pesi ordinati per giorno, un solo valore al giorno. */
export function pesiOrdinati(pesi) {
  const perGiorno = new Map();
  for (const p of pesi || []) if (p && p.giorno && isFinite(p.kg) && p.kg > 0) perGiorno.set(p.giorno, +p.kg);
  return [...perGiorno].map(([giorno, kg]) => ({ giorno, kg })).sort((a, b) => a.giorno.localeCompare(b.giorno));
}

/** Ultima pesata fatta almeno `giorni` giorni prima di `rif` (la più vicina a quella distanza). */
function pesataPrima(pesi, rif, giorni) {
  let best = null;
  for (const p of pesi) if (daysBetween(p.giorno, rif.giorno) >= giorni) best = p;
  return best;
}

/**
 * Consiglio sulle calorie in base all'andamento del peso.
 * @param {{giorno:string, kg:number}[]} pesiIn
 * @param {{kcalMin:number, kcalMax:number, baseKcalMin?:number, ultimoAggiustamento?:string|null}} obiettivi
 * @param {string} oggi "AAAA-MM-GG"
 * @returns {{tipo:'dati'|'attesa'|'aumenta'|'riduci'|'ok'|'veloce', delta:number, titolo:string, testo:string, ritmo:number|null}}
 */
export function consiglioPeso(pesiIn, obiettivi, oggi) {
  const pesi = pesiOrdinati(pesiIn);
  const base = obiettivi?.baseKcalMin ?? OBIETTIVI_BASE.kcalMin;
  const out = (tipo, delta, titolo, testo, ritmo = null) => ({ tipo, delta, titolo, testo, ritmo });

  if (pesi.length < 2) {
    return out('dati', 0, 'Pesati una volta a settimana', 'Al mattino a digiuno, dopo il bagno. Con due pesate vedi l\'andamento.');
  }
  const ult = pesi[pesi.length - 1];
  const primo = pesi[0];
  const giorniTot = Math.max(1, daysBetween(primo.giorno, ult.giorno));
  const ritmoTot = (ult.kg - primo.kg) / (giorniTot / 7);

  // Dopo un cambio dell'obiettivo aspetto 2 settimane di pesate prima di consigliare di nuovo.
  const agg = obiettivi?.ultimoAggiustamento;
  if (agg && daysBetween(agg, oggi) < 14) {
    return out('attesa', 0, 'Obiettivo aggiornato di recente',
      `Hai cambiato le calorie il ${fmtGiorno(agg)}: continua a pesarti, tra due settimane vediamo l'effetto.`, ritmoTot);
  }

  const rif2 = pesataPrima(pesi, ult, 12);
  if (rif2) {
    const sett = daysBetween(rif2.giorno, ult.giorno) / 7;
    const ritmo = (ult.kg - rif2.kg) / sett;
    if (ult.kg <= rif2.kg) {
      return out('aumenta', 250, 'Aggiungi 250 kcal al giorno',
        `In due settimane il peso non è salito (da ${fmtNum(rif2.kg)} a ${fmtNum(ult.kg)} kg). Aggiungi uno spuntino o porzioni un po' più grandi.`, ritmo);
    }
    // "per più settimane": controllo anche le due settimane precedenti
    const rif4 = pesataPrima(pesi, rif2, 12);
    const ritmoPrima = rif4 ? (rif2.kg - rif4.kg) / (daysBetween(rif4.giorno, rif2.giorno) / 7) : null;
    if (ritmo > RITMO.troppo && ritmoPrima != null && ritmoPrima > RITMO.troppo) {
      if ((obiettivi?.kcalMin ?? base) - 200 >= base) {
        return out('riduci', -200, 'Rallenta un po\': 200 kcal in meno',
          `Stai salendo più di ${fmtNum(RITMO.troppo)} kg a settimana da più settimane. Torna un passo indietro con le calorie: resti comunque sopra l'obiettivo di partenza.`, ritmo);
      }
      return out('veloce', 0, 'Stai salendo in fretta',
        'Va bene così: continua con l\'obiettivo della scheda e controlla che i carichi in palestra salgano.', ritmo);
    }
    if (ritmo < RITMO.min) {
      return out('ok', 0, 'Stai salendo piano',
        `Circa ${fmtNum(Math.round(ritmo * 100) / 100)} kg a settimana. Se nelle prossime due settimane non sali, aggiungi 250 kcal.`, ritmo);
    }
    return out('ok', 0, 'Stai salendo bene', `Circa ${fmtNum(Math.round(ritmo * 100) / 100)} kg a settimana: continua così.`, ritmo);
  }

  // Meno di due settimane di dati: se sto perdendo peso lo dico subito.
  const prec = pesi[pesi.length - 2];
  if (ult.kg <= prec.kg - 0.5 || ult.kg <= primo.kg - 0.5) {
    const da = ult.kg <= primo.kg - 0.5 ? primo : prec;
    return out('aumenta', 250, 'Aggiungi 250 kcal al giorno',
      `Il peso è sceso da ${fmtNum(da.kg)} a ${fmtNum(ult.kg)} kg: l'obiettivo è salire. Aggiungi uno spuntino o porzioni un po' più grandi.`, ritmoTot);
  }
  return out('ok', 0, 'Continua a pesarti', 'Tra due settimane di pesate vedrai se stai salendo al ritmo giusto (+0,25-0,5 kg a settimana).', ritmoTot);
}

/** Applica il consiglio agli obiettivi (mai sotto la base della scheda). */
export function applicaConsiglio(obiettivi, consiglio, oggi) {
  if (!consiglio?.delta) return obiettivi;
  const base = obiettivi.baseKcalMin ?? OBIETTIVI_BASE.kcalMin;
  const baseMax = obiettivi.baseKcalMax ?? OBIETTIVI_BASE.kcalMax;
  const min = Math.max(base, obiettivi.kcalMin + consiglio.delta);
  const max = Math.max(baseMax, obiettivi.kcalMax + consiglio.delta);
  const realeDelta = min - obiettivi.kcalMin;
  return {
    ...obiettivi,
    kcalMin: min,
    kcalMax: max,
    // le calorie in più (o in meno) vanno soprattutto sui carboidrati
    carboidrati: Math.max(250, Math.round((obiettivi.carboidrati || 400) + realeDelta / 4)),
    ultimoAggiustamento: oggi,
  };
}

/**
 * Da quale pesata parte la fascia obiettivo del grafico.
 * Senza cambi di calorie: dalla prima pesata. Dopo un cambio (ultimoAggiustamento) riparte
 * dall'ultima pesata fatta fino a quel giorno: da lì, con le calorie nuove, si deve salire di 0,25-0,5 kg a settimana.
 */
export function ancoraObiettivo(pesiIn, ultimoAggiustamento = null) {
  const pesi = pesiOrdinati(pesiIn);
  if (!pesi.length) return null;
  if (ultimoAggiustamento) {
    let a = null;
    for (const p of pesi) if (p.giorno <= ultimoAggiustamento) a = p;
    return a || pesi.find(p => p.giorno > ultimoAggiustamento) || pesi[0];
  }
  return pesi[0];
}

/** Fascia obiettivo per il grafico: dalla pesata di partenza, +0,25 e +0,5 kg a settimana. */
export function lineaObiettivo(pesiIn, finoA, ultimoAggiustamento = null) {
  const p0 = ancoraObiettivo(pesiIn, ultimoAggiustamento);
  if (!p0) return null;
  const sett = Math.max(0, daysBetween(p0.giorno, finoA)) / 7;
  return {
    da: { giorno: p0.giorno, kg: p0.kg },
    a: { giorno: finoA, min: p0.kg + RITMO.min * sett, max: p0.kg + RITMO.max * sett },
  };
}

/** Peso atteso in un giorno secondo la fascia obiettivo. */
export function pesoAtteso(pesiIn, giorno, ultimoAggiustamento = null) {
  const l = lineaObiettivo(pesiIn, giorno, ultimoAggiustamento);
  return l ? { min: l.a.min, max: l.a.max } : null;
}

/**
 * Ritmo del peso in kg a settimana: retta dei minimi quadrati sulle pesate degli ultimi `giorni` giorni.
 * Restituisce null se le pesate coprono meno di 6 giorni (troppo presto per dirlo).
 */
export function ritmoPeso(pesiIn, finoA, giorni = 28) {
  const pesi = pesiOrdinati(pesiIn).filter(p => !finoA || p.giorno <= finoA);
  if (pesi.length < 2) return null;
  const da = addDaysIso(pesi[pesi.length - 1].giorno, -giorni);
  let fin = pesi.filter(p => p.giorno >= da);
  if (fin.length < 2) fin = pesi.slice(-2); // pesate rare: uso le ultime due
  if (daysBetween(fin[0].giorno, fin[fin.length - 1].giorno) < 6) return null;
  const xs = fin.map(p => daysBetween(fin[0].giorno, p.giorno));
  const ys = fin.map(p => p.kg);
  const mx = xs.reduce((t, x) => t + x, 0) / xs.length;
  const my = ys.reduce((t, y) => t + y, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? (num / den) * 7 : null;
}

function fmtGiorno(iso) {
  const d = parseDay(iso);
  return d ? `${d.getDate()}/${d.getMonth() + 1}` : iso;
}

/** Media mobile semplice per smussare il grafico (finestra in giorni). */
export function mediaMobile(pesiIn, finestra = 7) {
  const pesi = pesiOrdinati(pesiIn);
  return pesi.map(p => {
    const da = addDaysIso(p.giorno, -(finestra - 1));
    const vicini = pesi.filter(q => q.giorno >= da && q.giorno <= p.giorno);
    return { giorno: p.giorno, kg: vicini.reduce((t, q) => t + q.kg, 0) / vicini.length };
  });
}
