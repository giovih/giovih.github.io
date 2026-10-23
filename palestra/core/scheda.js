// La scheda cartacea (dati iniziali), il catalogo esercizi e le regole di esecuzione.

/** Gruppi muscolari: servono per proporre le sostituzioni. */
export const GRUPPI = {
  petto: 'Petto', schiena: 'Schiena', spalle: 'Spalle', post: 'Deltoidi posteriori',
  bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', avambracci: 'Avambracci',
  quadricipiti: 'Quadricipiti', femorali: 'Femorali', polpacci: 'Polpacci', addome: 'Addome',
};

/**
 * Attrezzi: decidono come si sale di peso e come si legge il campo kg.
 * passo = quanto si aggiunge quando si fa il massimo in tutte le serie;
 * arrot = arrotondamento dei pesi suggeriti (es. scarico -10%).
 */
export const ATTREZZI = {
  bil: { nome: 'Bilanciere', peso: 'kg totali', passo: 2.5, arrot: 2.5, consiglio: '+2,5 kg (1,25 per lato)' },
  man: { nome: 'Manubri', peso: 'kg per manubrio', passo: 2, arrot: 1, consiglio: '+1-2 kg per manubrio' },
  mac: { nome: 'Macchina', peso: 'kg', passo: 2.5, arrot: 2.5, consiglio: '+1 tacca' },
  cav: { nome: 'Cavi', peso: 'kg', passo: 2.5, arrot: 2.5, consiglio: '+1 tacca' },
  cl: { nome: 'Corpo libero', peso: 'kg di zavorra', passo: 2.5, arrot: 1.25, consiglio: 'aggiungi 1-2,5 kg di zavorra' },
};

/** Catalogo: esercizi della scheda + alternative per quando un attrezzo è occupato. */
export const CATALOGO = [
  ['Panca piana', 'petto', 'bil'], ['Panca inclinata manubri', 'petto', 'man'], ['Croci ai cavi', 'petto', 'cav'],
  ['Panca piana manubri', 'petto', 'man'], ['Panca inclinata bilanciere', 'petto', 'bil'],
  ['Chest press', 'petto', 'mac'], ['Pec deck', 'petto', 'mac'], ['Croci manubri', 'petto', 'man'],
  ['Piegamenti', 'petto', 'cl'],
  ['Rematore con bilanciere', 'schiena', 'bil'], ['Trazioni', 'schiena', 'cl'],
  ['Lat machine presa larga', 'schiena', 'cav'], ['Rematore al cavo basso', 'schiena', 'cav'],
  ['Rematore manubrio', 'schiena', 'man'], ['Rematore alla macchina', 'schiena', 'mac'],
  ['Lat machine presa stretta', 'schiena', 'cav'], ['Trazioni assistite', 'schiena', 'mac'],
  ['Pulley presa neutra', 'schiena', 'cav'],
  ['Military press manubri', 'spalle', 'man'], ['Military press bilanciere', 'spalle', 'bil'],
  ['Alzate laterali', 'spalle', 'man'], ['Shoulder press macchina', 'spalle', 'mac'],
  ['Alzate laterali ai cavi', 'spalle', 'cav'], ['Alzate laterali macchina', 'spalle', 'mac'],
  ['Face pull', 'post', 'cav'], ['Alzate posteriori (reverse pec deck)', 'post', 'mac'],
  ['Alzate posteriori manubri', 'post', 'man'], ['Alzate posteriori ai cavi', 'post', 'cav'],
  ['Curl EZ', 'bicipiti', 'bil'], ['Curl inclinato manubri', 'bicipiti', 'man'], ['Curl a martello', 'bicipiti', 'man'],
  ['Curl ai cavi', 'bicipiti', 'cav'], ['Curl manubri', 'bicipiti', 'man'], ['Curl alla panca Scott', 'bicipiti', 'mac'],
  ['French press', 'tricipiti', 'bil'], ['Dip alle parallele', 'tricipiti', 'cl'], ['Panca presa stretta', 'tricipiti', 'bil'],
  ['Estensione tricipiti sopra la testa', 'tricipiti', 'cav'], ['Pushdown ai cavi', 'tricipiti', 'cav'],
  ['Dip assistite', 'tricipiti', 'mac'], ['Estensione manubrio sopra la testa', 'tricipiti', 'man'],
  ['Wrist curl con manubri', 'avambracci', 'man'], ['Reverse wrist curl', 'avambracci', 'man'],
  ['Hammer curl concentrato', 'avambracci', 'man'], ['Wrist curl con bilanciere', 'avambracci', 'bil'],
  ['Reverse curl EZ', 'avambracci', 'bil'], ['Wrist curl ai cavi', 'avambracci', 'cav'],
  ['Squat', 'quadricipiti', 'bil'], ['Leg press', 'quadricipiti', 'mac'], ['Hack squat', 'quadricipiti', 'mac'],
  ['Affondi manubri', 'quadricipiti', 'man'], ['Leg extension', 'quadricipiti', 'mac'], ['Goblet squat', 'quadricipiti', 'man'],
  ['Stacco rumeno', 'femorali', 'bil'], ['Leg curl', 'femorali', 'mac'], ['Stacco rumeno manubri', 'femorali', 'man'],
  ['Leg curl da seduto', 'femorali', 'mac'],
  ['Calf raise in piedi', 'polpacci', 'mac'], ['Calf raise alla leg press', 'polpacci', 'mac'],
  ['Calf raise da seduto', 'polpacci', 'mac'],
  ['Hanging leg raise', 'addome', 'cl'], ['Crunch ai cavi', 'addome', 'cav'], ['Plank', 'addome', 'cl'],
].map(([nome, gruppo, eq]) => ({ nome, gruppo, eq }));

const r = (ex, serie, min, max, recMin, recMax = recMin, ss = null, drop = false) =>
  ({ ex, serie, min, max, recMin, recMax, ss, drop });

/**
 * Sedute. tono = colore tenue della seduta (vedi ui/design.css).
 * ss = stesso numero → superserie (due esercizi di fila, recupero a fine coppia).
 * drop = drop set sull'ultima serie dalla settimana 5 alla 7.
 */
export const SCHEDE = {
  A: {
    nome: 'Upper A', sotto: 'Forza petto e schiena', tono: 'ambra', righe: [
      r('Panca piana', 4, 6, 8, 120, 180),
      r('Rematore con bilanciere', 4, 6, 8, 120, 180),
      r('Military press manubri', 3, 8, 10, 120),
      r('Trazioni', 3, 6, 10, 120),
      r('Curl EZ', 3, 8, 10, 90, 90, 1),
      r('French press', 3, 8, 10, 90, 90, 1),
    ],
  },
  B: {
    nome: 'Upper B', sotto: 'Volume petto e schiena', tono: 'teal', righe: [
      r('Panca inclinata manubri', 4, 8, 10, 120),
      r('Lat machine presa larga', 4, 8, 10, 120),
      r('Croci ai cavi', 3, 12, 15, 60, 90, null, true),
      r('Rematore al cavo basso', 3, 10, 12, 90),
      r('Alzate laterali', 3, 12, 15, 60, 60, null, true),
      r('Face pull', 3, 15, 15, 60),
    ],
  },
  G: {
    nome: 'Gambe', sotto: 'Seduta compatta', tono: 'rosa', righe: [
      r('Squat', 4, 6, 8, 180),
      r('Stacco rumeno', 3, 8, 10, 120, 180),
      r('Leg press', 2, 10, 12, 120),
      r('Leg curl', 2, 10, 12, 90),
      r('Calf raise in piedi', 3, 12, 15, 60),
      r('Hanging leg raise', 3, 10, 15, 60),
    ],
  },
  C: {
    nome: 'Upper C', sotto: 'Spalle e braccia', tono: 'lavanda', righe: [
      r('Military press bilanciere', 4, 6, 8, 120, 180),
      r('Alzate laterali', 4, 12, 15, 60, 60, null, true),
      r('Alzate posteriori (reverse pec deck)', 3, 15, 15, 60),
      r('Dip alle parallele', 3, 8, 12, 120),
      r('Curl inclinato manubri', 3, 10, 12, 90, 90, null, true),
      r('Curl a martello', 3, 10, 12, 90, 90, 1),
      r('Estensione tricipiti sopra la testa', 3, 10, 12, 90, 90, 1),
    ],
  },
  F: {
    nome: 'Avambracci', sotto: 'Seduta breve facoltativa', tono: 'sabbia', facoltativa: true, righe: [
      r('Wrist curl con manubri', 3, 15, 20, 60),
      r('Reverse wrist curl', 3, 12, 15, 60),
      r('Hammer curl concentrato', 3, 10, 12, 60),
    ],
  },
};

/** Ordine in cui mostrare le sedute. */
export const ORDINE_SCHEDE = ['A', 'B', 'G', 'C', 'F'];

/** Calendario: 1 = lunedì … 7 = domenica. null = riposo. */
export const CALENDARIO_BASE = { 1: 'A', 2: null, 3: 'B', 4: null, 5: 'G', 6: 'C', 7: null };
export const CALENDARIO_ALT = { 1: 'G', 2: null, 3: 'A', 4: null, 5: 'B', 6: null, 7: 'C' };

/** Regole di esecuzione, mostrate come promemoria durante l'allenamento. */
export const REGOLE = [
  { icona: 'flame', titolo: 'Riscaldamento', testo: '5 minuti leggeri, poi 2 serie progressive del primo esercizio: metà peso per 8, poi il 75% per 4. Non contano e non vanno nel diario.' },
  { icona: 'gauge', titolo: 'Ripetizioni in canna', testo: 'Su squat, panca e stacco rumeno lascia sempre almeno 1 ripetizione in canna. Sugli isolamenti l\'ultima serie può arrivare a cedimento.' },
  { icona: 'timer', titolo: 'Tempo e ampiezza', testo: 'Discesa in 2-3 secondi, ampiezza completa. 1 secondo di pausa in basso su panca e squat; 1-2 secondi in allungamento su croci, stacco rumeno e curl inclinato.' },
  { icona: 'warning', titolo: 'Sicurezza', testo: 'Dolore acuto o articolare: fermati. Niente massimali a 1 ripetizione.' },
];

/** Copia profonda delle sedute iniziali (per le impostazioni). */
export const schedeIniziali = () => JSON.parse(JSON.stringify(SCHEDE));

/** Cerca un esercizio nel catalogo + quelli creati da te. */
export function trovaEsercizio(nome, personalizzati = []) {
  return CATALOGO.find(e => e.nome === nome) || personalizzati.find(e => e.nome === nome) || null;
}

export const attrezzoDi = (nome, pers = []) => trovaEsercizio(nome, pers)?.eq || 'mac';
export const gruppoDi = (nome, pers = []) => trovaEsercizio(nome, pers)?.gruppo || null;

/** Durata stimata di una seduta in minuti: ogni serie ~40 s di lavoro + recupero medio. */
export function durataStimata(scheda) {
  if (!scheda?.righe?.length) return 0;
  let sec = 5 * 60; // riscaldamento
  const righe = scheda.righe;
  righe.forEach((r, i) => {
    const conSuccessivo = r.ss != null && righe[i + 1]?.ss === r.ss;
    const conPrecedente = r.ss != null && righe[i - 1]?.ss === r.ss;
    const rec = conSuccessivo ? 15 : (r.recMin + r.recMax) / 2;
    sec += r.serie * (40 + rec);
    if (!conPrecedente) sec += 90; // preparare l'attrezzo
  });
  return Math.round(sec / 60 / 5) * 5;
}
