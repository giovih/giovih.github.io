// Date in ora locale. I giorni sono stringhe "AAAA-MM-GG" (fuso orario del telefono).

export const DAY_MS = 86400000;

export const GIORNI = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
export const GIORNI_BREVI = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const GIORNI_INIZIALI = ['', 'L', 'M', 'M', 'G', 'V', 'S', 'D'];
export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export const pad2 = n => String(n).padStart(2, '0');
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/** Data → "AAAA-MM-GG" (ora locale). */
export function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "AAAA-MM-GG" → Date a mezzanotte locale. Restituisce null se non valida. */
export function parseDay(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d) ? null : d;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const addDaysIso = (s, n) => isoDay(addDays(parseDay(s), n));

/** Giorni di calendario tra due date "AAAA-MM-GG" (b - a). Arrotonda per l'ora legale. */
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
}

/** Lunedì della settimana di d (mezzanotte locale). */
export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Giorno della settimana all'italiana: 1 = lunedì … 7 = domenica. */
export const weekdayIt = d => ((d.getDay() + 6) % 7) + 1;

/** "HH:MM" → minuti dalla mezzanotte. */
export function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : 0;
}

export function minutesToTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** Date di un giorno "AAAA-MM-GG" all'ora "HH:MM" locale. */
export function atTime(dayIso, time) {
  const d = parseDay(dayIso);
  const min = timeToMinutes(time);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d;
}

/** "venerdì 23 ottobre" */
export function formatDayLong(d) {
  return `${GIORNI[weekdayIt(d)]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** "23 ott" */
export function formatDayShort(d) {
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
}

/** "Oggi", "Ieri", "Domani" o "ven 23 ott". */
export function formatRelativeDay(dayIso, today = isoDay()) {
  const diff = daysBetween(today, dayIso);
  if (diff === 0) return 'Oggi';
  if (diff === -1) return 'Ieri';
  if (diff === 1) return 'Domani';
  const d = parseDay(dayIso);
  return `${GIORNI_BREVI[weekdayIt(d)]} ${formatDayShort(d)}`;
}

/** Tutti i giorni (stringhe) di un mese, per l'agenda. */
export function monthDays(year, month) {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => isoDay(new Date(year, month, i + 1)));
}
