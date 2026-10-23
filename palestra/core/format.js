// Testi e numeri formattati all'italiana.

const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 62.5 → "62,5", 60 → "60", null → "–". */
export function fmtNum(v) {
  if (v == null || v === '' || !isFinite(v)) return '–';
  return nf.format(Math.round(v * 100) / 100);
}

/** Sempre un decimale: 54.7 → "54,7", 55 → "55,0". */
export const fmtKg1 = v => (v == null || !isFinite(v)) ? '–' : nf1.format(v);

/** Interi con separatore delle migliaia: 12345 → "12.345". */
export const fmtInt = v => (v == null || !isFinite(v)) ? '–' : nf.format(Math.round(v));

/** Differenza con segno: +0,4 / −1,4 (meno tipografico). */
export function fmtDelta(v, dec = 1) {
  if (v == null || !isFinite(v)) return '–';
  const r = Math.round(v * 10 ** dec) / 10 ** dec;
  if (r === 0) return '±0';
  return (r > 0 ? '+' : '−') + new Intl.NumberFormat('it-IT', { maximumFractionDigits: dec }).format(Math.abs(r));
}

/** Legge numeri scritti all'italiana ("56,4"). Restituisce null se non è un numero. */
export function parseNum(s) {
  if (typeof s === 'number') return isFinite(s) ? s : null;
  if (typeof s !== 'string') return null;
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return null;
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** 4500 s → "1 h 15 min", 1800 → "30 min". */
export function fmtMinutes(sec) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** Recupero: (120, 180) → "2-3 min", (90, 90) → "90 s", (60, 90) → "60-90 s". */
export function fmtRest(a, b = a) {
  if (a >= 120 && a % 60 === 0 && b % 60 === 0) return a === b ? `${a / 60} min` : `${a / 60}-${b / 60} min`;
  return a === b ? `${a} s` : `${a}-${b} s`;
}

/** Serie × ripetizioni: "4 × 6-8" oppure "3 × 15". */
export const fmtSetsReps = (serie, min, max) => min === max ? `${serie} × ${min}` : `${serie} × ${min}-${max}`;

/** Ripetizioni: "6-8" oppure "15". */
export const fmtReps = (min, max) => min === max ? `${min}` : `${min}-${max}`;

/** "1,5 L" da millilitri. */
export const fmtLitri = ml => `${fmtNum(Math.round((ml || 0) / 100) / 10)} L`;

/** Plurale semplice. */
export const plural = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
