// Calcoli per la sezione Progressi: serie per muscolo, agenda del mese, scale dei grafici.
// Funzioni pure (senza archivio né interfaccia): si possono provare con i test.

import { isoDay, parseDay, weekdayIt, daysBetween, addDaysIso, MESI_BREVI } from './dates.js';
import { sedutePassate, serieFatte, statistiche, serieMigliore } from './progression.js';
import { sedutaDelGiorno } from './settings.js';
import { pesiOrdinati } from './nutrition.js';

/** Giorno (locale) in cui è iniziata una seduta. */
export const giornoSeduta = s => isoDay(new Date(s.data));

/**
 * Serie fatte per gruppo muscolare tra due giorni (inclusi), contando il muscolo principale di ogni esercizio.
 * @param {(nome:string) => string} gruppoDi  per le sedute vecchie che non hanno il gruppo salvato
 * @returns {{gruppo:string, serie:number}[]} dal gruppo con più serie
 */
export function seriePerGruppo(sessioni, da, a, gruppoDi = () => 'altro') {
  const conta = {};
  for (const s of sedutePassate(sessioni)) {
    const g = giornoSeduta(s);
    if (g < da || g > a) continue;
    for (const v of s.voci) {
      const n = serieFatte(v).length;
      if (!n) continue;
      const gr = v.gruppo || gruppoDi(v.ex) || 'altro';
      conta[gr] = (conta[gr] || 0) + n;
    }
  }
  return Object.entries(conta).map(([gruppo, serie]) => ({ gruppo, serie })).sort((x, y) => y.serie - x.serie);
}

/**
 * Serie migliore di un esercizio negli ultimi `giorni` giorni (se non c'è, la migliore di sempre).
 * @returns {{kg:number, reps:number, data:string}|null}
 */
export function migliorePeriodo(sessioni, nome, oggi, giorni = 28) {
  const da = addDaysIso(oggi, -giorni);
  let recente = null, sempre = null;
  for (const s of sedutePassate(sessioni)) {
    const v = s.voci.find(x => x.ex === nome);
    const top = serieMigliore(serieFatte(v));
    if (!top) continue;
    const cand = { ...top, data: s.data };
    const meglio = (a, b) => !a || b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps);
    if (meglio(sempre, cand)) sempre = cand;
    if (giornoSeduta(s) >= da && meglio(recente, cand)) recente = cand;
  }
  return recente || sempre;
}

/**
 * Dati di ogni giorno per l'agenda.
 * @param {{giorni:string[], sessioni:object[], pesi:{giorno,kg}[], cibi:object[], giorniRec:object[], imp:object, oggi:string}} p
 * @returns {Map<string, {giorno, sedute:object[], prevista:string|null, peso:number|null, pesoPrima:number|null,
 *   kcal:number, prot:number, nCibi:number, nota:string, acquaMl:number, creatina:boolean, futuro:boolean}>}
 */
export function datiAgenda({ giorni, sessioni = [], pesi = [], cibi = [], giorniRec = [], imp, oggi }) {
  const set = new Set(giorni);
  const sedute = new Map(), cibo = new Map(), rec = new Map();
  for (const s of sedutePassate(sessioni)) {
    const g = giornoSeduta(s);
    if (!set.has(g)) continue;
    if (!sedute.has(g)) sedute.set(g, []);
    sedute.get(g).unshift(s); // dalla prima della giornata
  }
  for (const c of cibi) {
    if (!set.has(c.giorno)) continue;
    const t = cibo.get(c.giorno) || { kcal: 0, prot: 0, n: 0 };
    t.kcal += +c.kcal || 0;
    t.prot += +c.prot || 0;
    t.n++;
    cibo.set(c.giorno, t);
  }
  for (const r of giorniRec) rec.set(r.id || r.giorno, r);
  const pesiOrd = pesiOrdinati(pesi);
  const pesoDi = new Map(pesiOrd.map((p, i) => [p.giorno, { kg: p.kg, prima: i > 0 ? pesiOrd[i - 1].kg : null }]));

  const out = new Map();
  for (const g of giorni) {
    const d = parseDay(g);
    const t = cibo.get(g);
    const r = rec.get(g) || {};
    const p = pesoDi.get(g);
    out.set(g, {
      giorno: g,
      sedute: (sedute.get(g) || []).map(s => ({ s, stat: statistiche(s) })),
      prevista: sedutaDelGiorno(imp, weekdayIt(d)),
      peso: p ? p.kg : null,
      pesoPrima: p ? p.prima : null,
      kcal: t ? Math.round(t.kcal) : 0,
      prot: t ? Math.round(t.prot) : 0,
      nCibi: t ? t.n : 0,
      nota: r.nota || '',
      acquaMl: +r.acquaMl || 0,
      creatina: !!r.creatina,
      futuro: g > oggi,
    });
  }
  return out;
}

/** Riassunto di un mese dell'agenda (solo fino a oggi). */
export function riassuntoMese(agenda) {
  let allenamenti = 0, pesate = 0, giorniCibo = 0, kcal = 0, prot = 0;
  for (const d of agenda.values()) {
    if (d.futuro) continue;
    allenamenti += d.sedute.length;
    if (d.peso != null) pesate++;
    if (d.nCibi > 0) { giorniCibo++; kcal += d.kcal; prot += d.prot; }
  }
  return {
    allenamenti, pesate, giorniCibo,
    kcalMedia: giorniCibo ? Math.round(kcal / giorniCibo) : 0,
    protMedia: giorniCibo ? Math.round(prot / giorniCibo) : 0,
  };
}

/** Celle della griglia del mese: null per i giorni vuoti prima del 1° (la settimana parte di lunedì). */
export function grigliaMese(anno, mese) {
  const primo = new Date(anno, mese, 1);
  const vuoti = weekdayIt(primo) - 1;
  const n = new Date(anno, mese + 1, 0).getDate();
  const celle = Array(vuoti).fill(null);
  for (let i = 1; i <= n; i++) celle.push(isoDay(new Date(anno, mese, i)));
  while (celle.length % 7) celle.push(null);
  return celle;
}

/* ---------- scale dei grafici ---------- */

const PASSI = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

/**
 * Valori "tondi" per l'asse verticale (es. 54, 55, 56).
 * @returns {{min:number, max:number, passo:number, ticks:number[]}}
 */
export function scalaY(valori, { minSpan = 1, maxTicks = 5, daZero = false } = {}) {
  const v = valori.filter(x => isFinite(x));
  let lo = v.length ? Math.min(...v) : 0;
  let hi = v.length ? Math.max(...v) : 1;
  if (daZero) lo = Math.min(0, lo);
  if (hi - lo < minSpan) {
    const m = (hi + lo) / 2;
    lo = daZero ? Math.max(0, Math.min(lo, m - minSpan / 2)) : m - minSpan / 2;
    hi = lo + minSpan;
  }
  const passo = PASSI.find(p => Math.ceil(hi / p) - Math.floor(lo / p) <= maxTicks - 1) || PASSI[PASSI.length - 1];
  const min = Math.floor(lo / passo) * passo;
  let max = Math.ceil(hi / passo) * passo;
  if (max === min) max = min + passo;
  const ticks = [];
  for (let t = min; t <= max + passo / 1000; t += passo) ticks.push(Math.round(t * 1000) / 1000);
  return { min, max, passo, ticks };
}

/**
 * Date per l'asse orizzontale tra due giorni: ogni giorno, ogni settimana (lunedì), ogni mese…
 * @returns {{giorno:string, etichetta:string}[]}
 */
export function ticksGiorni(da, a, maxTicks = 5) {
  const span = Math.max(0, daysBetween(da, a));
  const out = [];
  const fmtG = g => { const d = parseDay(g); return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`; };
  for (const passo of [1, 2, 7, 14]) {
    if (span / passo + 1 > maxTicks) continue;
    let g = da;
    if (passo >= 7) { // dal primo lunedì
      while (weekdayIt(parseDay(g)) !== 1) g = addDaysIso(g, 1);
    }
    for (; g <= a; g = addDaysIso(g, passo)) out.push({ giorno: g, etichetta: fmtG(g) });
    return out;
  }
  const d0 = parseDay(da), d1 = parseDay(a);
  const mesi = (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth();
  const passoMesi = [1, 2, 3, 6, 12].find(p => mesi / p + 1 <= maxTicks) || 12;
  const cambiaAnno = d0.getFullYear() !== d1.getFullYear();
  for (let i = 0; ; i += passoMesi) {
    const d = new Date(d0.getFullYear(), d0.getMonth() + 1 + i, 1); // dal 1° del mese dopo l'inizio
    if (d > d1) break;
    const anno = String(d.getFullYear()).slice(2);
    out.push({ giorno: isoDay(d), etichetta: MESI_BREVI[d.getMonth()] + (cambiaAnno && (d.getMonth() === 0 || !out.length) ? ' ' + anno : '') });
  }
  return out;
}
