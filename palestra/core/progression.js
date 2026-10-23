// Doppia progressione della scheda e statistiche degli allenamenti.
//
// Regole:
// - si parte dal minimo dell'intervallo (es. 4 × 6-8 → 6 ripetizioni) e si aggiunge 1 ripetizione a settimana a parità di peso;
// - quando si fa il massimo delle ripetizioni in tutte le serie con tecnica pulita, la volta dopo si sale di peso e si riparte dal minimo;
// - quanto salire dipende dall'attrezzo (bilanciere +2,5 kg, manubri +1-2 kg, macchine e cavi +1 tacca, trazioni e dip zavorra);
// - se non si aggiunge una ripetizione si ripete lo stesso peso; fermi da 3 sedute → -10% e risalita;
// - le sedute di scarico (settimana 8) non contano: dopo lo scarico si riparte dai pesi di prima.

import { ATTREZZI } from './scheda.js';
import { fmtNum } from './format.js';

/** Arrotonda al multiplo di `passo` più vicino. */
export const arrotonda = (kg, passo = 0.5) => Math.round(kg / passo) * passo;

/** Sedute finite, dalla più recente. */
export function sedutePassate(sessioni) {
  return sessioni
    .filter(s => s && s.fine && Array.isArray(s.voci))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

/** Serie completate (con ripetizioni) di una voce. */
export const serieFatte = voce => (voce?.sets || [])
  .filter(x => x && x.fatto && (x.reps || 0) > 0)
  .map(x => ({ kg: +x.kg || 0, reps: +x.reps }));

/**
 * Storico di un esercizio per la progressione: niente sedute di scarico, dalla più recente.
 * @returns {{data: string, sets: {kg:number, reps:number}[], pulita: boolean}[]}
 */
export function storico(sessioni, nome) {
  const out = [];
  for (const s of sedutePassate(sessioni)) {
    if (s.scarico) continue;
    const v = s.voci.find(v => v.ex === nome);
    if (!v) continue;
    const sets = serieFatte(v);
    if (sets.length) out.push({ data: s.data, sets, pulita: v.pulita !== false });
  }
  return out;
}

/** Ultima volta in assoluto (anche scarico): serie fatte, per la colonna "Precedente". */
export function ultimaVolta(sessioni, nome, esclusoId = null) {
  for (const s of sedutePassate(sessioni)) {
    if (s.id && s.id === esclusoId) continue;
    const v = s.voci.find(v => v.ex === nome);
    const sets = serieFatte(v);
    if (sets.length) return { data: s.data, sets, nota: v.nota || '' };
  }
  return null;
}

const totaleRip = h => h.sets.reduce((t, x) => t + x.reps, 0);
const kgTop = h => h.sets[0]?.kg ?? 0;

/**
 * Cosa fare oggi per un esercizio.
 * @param {{serie:number, min:number, max:number}} riga
 * @param {ReturnType<typeof storico>} hist  storico (dal più recente)
 * @param {string} eq  attrezzo (bil, man, mac, cav, cl)
 * @param {boolean} scarico  settimana di scarico
 * @returns {{kg: number|null, reps: number[], tipo: string, msg: string}}
 */
export function suggerisci(riga, hist, eq = 'mac', scarico = false) {
  const A = ATTREZZI[eq] || ATTREZZI.mac;
  const serie = Math.max(1, riga.serie | 0);
  const out = { kg: null, reps: Array(serie).fill(riga.min), tipo: 'primo', msg: `Prima volta: scegli un peso con cui fai ${riga.min} ripetizioni pulite.` };

  const ult = hist[0];
  if (ult) {
    const kg = kgTop(ult);
    const tuttoMax = ult.sets.length >= serie && ult.sets.every(x => x.reps >= riga.max) && ult.pulita;
    const fermo = hist.length >= 3
      && hist.slice(0, 3).every(h => kgTop(h) === kg)
      && totaleRip(hist[0]) <= totaleRip(hist[2]);

    if (tuttoMax) {
      out.kg = kg + A.passo;
      out.tipo = 'sali';
      out.msg = `Massimo in tutte le serie: sali di peso (${A.consiglio}) e riparti da ${riga.min}.`;
    } else if (fermo && kg > 0) {
      out.kg = Math.max(0, Math.min(kg - A.arrot, arrotonda(kg * 0.9, A.arrot)));
      out.tipo = 'fermo';
      out.msg = `Fermo da 3 sedute: scendi del 10% (${fmtNum(out.kg)} kg) e risali.`;
    } else {
      out.kg = kg;
      out.reps = out.reps.map((_, i) => {
        const prec = (ult.sets[i] ?? ult.sets[ult.sets.length - 1]).reps;
        return Math.max(riga.min, Math.min(prec + 1, riga.max));
      });
      const migliorato = hist.length < 2 || totaleRip(hist[0]) > totaleRip(hist[1]);
      out.tipo = migliorato ? 'aggiungi' : 'ripeti';
      out.msg = migliorato
        ? 'Stesso peso, +1 ripetizione per serie.'
        : 'L\'ultima volta non hai aggiunto ripetizioni: stesso peso, riprova a fare +1.';
      if (eq === 'cl' && kg === 0) out.msg += ' Quando fai il massimo in tutte le serie si aggiunge zavorra.';
    }
  }

  if (scarico) {
    if (out.kg) out.kg = arrotonda(out.kg * 0.9, A.arrot);
    out.reps = out.reps.slice(0, Math.ceil(serie / 2));
    out.tipo = 'scarico';
    out.msg = 'Settimana di scarico: metà serie e -10% di peso. ' + out.msg;
  }
  return out;
}

/** Statistiche di una seduta. */
export function statistiche(s) {
  let serie = 0, totali = 0, volume = 0, ripetizioni = 0;
  for (const v of s?.voci || []) {
    for (const x of v.sets || []) {
      totali++;
      if (x.fatto && x.reps > 0) {
        serie++;
        ripetizioni += +x.reps;
        volume += (+x.kg || 0) * x.reps;
      }
    }
  }
  const durata = s?.fine && s?.data ? Math.max(0, (new Date(s.fine) - new Date(s.data)) / 1000) : 0;
  return { serie, totali, volume: Math.round(volume), ripetizioni, durata };
}

/** Serie migliore: più peso, a parità di peso più ripetizioni. */
export function serieMigliore(sets) {
  let top = null;
  for (const x of sets) if (!top || x.kg > top.kg || (x.kg === top.kg && x.reps > top.reps)) top = x;
  return top;
}

/** Record battuti in una seduta rispetto a tutte quelle precedenti. */
export function recordBattuti(sessioni, s) {
  const prima = sedutePassate(sessioni).filter(x => x.id !== s.id && (x.data || '') < (s.data || ''));
  const out = [];
  for (const v of s.voci || []) {
    const mie = serieFatte(v);
    if (!mie.length) continue;
    const top = serieMigliore(mie);
    const precedenti = prima.flatMap(x => serieFatte(x.voci.find(y => y.ex === v.ex)));
    if (!precedenti.length || top.kg <= 0) continue;
    const best = serieMigliore(precedenti);
    if (top.kg > best.kg || (top.kg === best.kg && top.reps > best.reps)) out.push({ ex: v.ex, kg: top.kg, reps: top.reps });
  }
  return out;
}

/** Punti per i grafici di un esercizio: peso migliore e ripetizioni totali per seduta (dalla più vecchia). */
export function puntiEsercizio(sessioni, nome) {
  return sedutePassate(sessioni).reverse().flatMap(s => {
    const sets = serieFatte(s.voci.find(v => v.ex === nome));
    if (!sets.length) return [];
    return [{ data: s.data, kg: Math.max(...sets.map(x => x.kg)), reps: sets.reduce((t, x) => t + x.reps, 0), scarico: !!s.scarico }];
  });
}

/** Nomi degli esercizi fatti almeno una volta (dal più recente). */
export function eserciziFatti(sessioni) {
  const visti = new Set();
  for (const s of sedutePassate(sessioni)) for (const v of s.voci) if (serieFatte(v).length) visti.add(v.ex);
  return [...visti];
}
