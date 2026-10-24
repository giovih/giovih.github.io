// Coach: riassunto dei dati per l'intelligenza artificiale e spunti automatici della settimana (senza AI).
// Regola di fondo: l'obiettivo è salire di peso. Gli spunti possono dire di mangiare di più,
// mai di mangiare meno o di dimagrire.

import { isoDay, addDaysIso, parseDay, weekdayIt, GIORNI, MESI, mondayOf } from './dates.js';
import { sedutePassate, serieFatte, storico, suggerisci, recordBattuti } from './progression.js';
import { pesiOrdinati, consiglioPeso, ritmoPeso } from './nutrition.js';
import { settimanaProgramma } from './cycle.js';
import { sedutaDelGiorno, oraPalestra } from './settings.js';
import { attrezzoDi } from './scheda.js';
import { fmtNum } from './format.js';
import { PASTI } from './foods.js';

/** Domande di esempio per iniziare una chat. */
export const DOMANDE = [
  'Come sto andando questa settimana?',
  'Cosa mangio stasera per arrivare alle proteine?',
  'Cosa devo fare oggi in palestra?',
  'Idee per uno spuntino da 500 kcal da portare a scuola',
  'Perché un esercizio non sale?',
  'Sto salendo di peso abbastanza?',
];

const giornoTesto = g => { const d = parseDay(g); return `${GIORNI[weekdayIt(d)]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
const serieTesto = sets => sets.map(x => (x.kg > 0 ? `${fmtNum(x.kg)}x${x.reps}` : `${x.reps}`)).join(', ');

/** Totali per giorno dei cibi registrati. */
function perGiorno(cibi) {
  const m = new Map();
  for (const c of cibi || []) {
    if (!c?.giorno) continue;
    const t = m.get(c.giorno) || { kcal: 0, prot: 0, carb: 0, grassi: 0, voci: [] };
    t.kcal += +c.kcal || 0; t.prot += +c.prot || 0; t.carb += +c.carb || 0; t.grassi += +c.grassi || 0;
    t.voci.push(c);
    m.set(c.giorno, t);
  }
  return m;
}

/** Giorni completi (prima di oggi) degli ultimi `n` giorni. */
const giorniPrima = (oggi, n) => Array.from({ length: n }, (_, i) => addDaysIso(oggi, -(i + 1)));

/**
 * Riassunto in testo semplice dei dati dell'app, da mandare al Coach insieme alla domanda.
 * @param {{oggi:string, imp:object, sessioni:object[], cibi:object[], giorni:object[], pesi:object[], diario:object[], esercizi:object[]}} d
 */
export function riassuntoDati({ oggi = isoDay(), imp, sessioni = [], cibi = [], giorni = [], pesi = [], diario = [], esercizi = [] }) {
  const out = [];
  const w = settimanaProgramma(imp.inizioProgramma, oggi);
  const o = imp.obiettivi;
  out.push(`Oggi è ${giornoTesto(oggi)} ${oggi.slice(0, 4)}. Settimana ${w.n} del programma (ciclo ${w.ciclo} di 8)`
    + `${w.scarico ? ', settimana di scarico (metà serie, -10% di peso)' : ''}${w.drop ? ', settimane con drop set sull\'ultima serie' : ''}.`);
  out.push(`Altezza ${imp.altezza || 172} cm. Peso di partenza ${fmtNum(imp.pesoPartenza)} kg.`);

  // calendario e schede
  const cal = [];
  for (let g = 1; g <= 7; g++) {
    const c = sedutaDelGiorno(imp, g);
    cal.push(`${GIORNI[g]} ${c ? `${imp.schede[c]?.nome || c} (palestra alle ${oraPalestra(imp, g)})` : 'riposo'}`);
  }
  out.push('\nCALENDARIO: ' + cal.join('; ') + '.');
  out.push('SCHEDE:');
  for (const [cod, sc] of Object.entries(imp.schede)) {
    if (cod === 'F' && !imp.avambracci?.attivo) continue;
    out.push(`- ${sc.nome}: ` + sc.righe.map(r => `${r.ex} ${r.serie}x${r.min === r.max ? r.min : `${r.min}-${r.max}`}`).join('; '));
  }

  // allenamenti recenti
  const sedute = sedutePassate(sessioni);
  const da = addDaysIso(oggi, -42);
  const recenti = sedute.filter(s => isoDay(new Date(s.data)) >= da).slice(0, 24);
  out.push('\nALLENAMENTI (ultime 6 settimane, dal più recente; kg x ripetizioni):');
  if (!recenti.length) out.push('nessuno');
  for (const s of recenti) {
    const voci = s.voci.filter(v => serieFatte(v).length)
      .map(v => `${v.ex} ${serieTesto(serieFatte(v))}${v.pulita === false ? ' (tecnica non pulita)' : ''}${v.nota ? ` [nota: ${v.nota}]` : ''}`);
    const durata = s.fine ? Math.round((new Date(s.fine) - new Date(s.data)) / 60000) : 0;
    out.push(`- ${isoDay(new Date(s.data))} ${s.nome}${s.scarico ? ' (scarico)' : ''}, ${durata} min: ${voci.join('; ')}`);
  }

  // cosa fare la prossima volta (doppia progressione)
  const prossime = [];
  for (const sc of Object.values(imp.schede)) {
    for (const r of sc.righe) {
      const h = storico(sessioni, r.ex);
      if (!h.length) continue;
      const s = suggerisci(r, h, attrezzoDi(r.ex, esercizi), w.scarico);
      prossime.push(`${r.ex}: ${s.kg != null ? `${fmtNum(s.kg)} kg ` : ''}${s.reps.join('/')} rip. (${s.tipo})`);
    }
  }
  if (prossime.length) out.push('PROSSIMA VOLTA (consigli della doppia progressione): ' + prossime.join('; '));

  // cibo
  const tot = perGiorno(cibi);
  out.push(`\nOBIETTIVI DEL CIBO: ${o.kcalMin}-${o.kcalMax} kcal, proteine almeno ${o.proteine} g, carboidrati ${o.carboidrati} g, grassi ${o.grassi} g, acqua ${fmtNum((o.acquaMl || 2500) / 1000)} L, creatina 5 g al giorno.`);
  out.push('CIBO (ultimi 7 giorni, dal più recente):');
  const rec = new Map((giorni || []).map(g => [g.id || g.giorno, g]));
  let qualcosa = false;
  for (let i = 0; i < 7; i++) {
    const g = addDaysIso(oggi, -i);
    const t = tot.get(g);
    const r = rec.get(g) || {};
    if (!t && !r.acquaMl && !r.creatina) continue;
    qualcosa = true;
    const pasti = t ? PASTI.map(p => {
      const v = t.voci.filter(c => c.pasto === p.key);
      return v.length ? `${p.nome.toLowerCase()}: ${v.map(c => `${c.nome} (${Math.round(c.kcal)} kcal)`).join(', ')}` : null;
    }).filter(Boolean).join('; ') : '';
    out.push(`- ${g}${i === 0 ? ' (oggi, giornata in corso)' : ''}: ${t ? `${Math.round(t.kcal)} kcal, P ${Math.round(t.prot)} g, C ${Math.round(t.carb)} g, G ${Math.round(t.grassi)} g` : 'cibo non registrato'}`
      + `, acqua ${r.acquaMl ? `${r.acquaMl} ml` : 'non registrata'}, creatina ${r.creatina ? 'sì' : 'no'}${pasti ? `. ${pasti}` : ''}`);
  }
  if (!qualcosa) out.push('niente registrato');

  // peso
  const p = pesiOrdinati(pesi);
  const ultimi = p.filter(x => x.giorno >= addDaysIso(oggi, -84));
  out.push('\nPESO (ultime 12 settimane): ' + (ultimi.length ? ultimi.map(x => `${x.giorno} ${fmtNum(x.kg)} kg`).join(', ') : 'nessuna pesata'));
  const ritmo = ritmoPeso(p, oggi);
  if (ritmo != null) out.push(`Ritmo recente: ${ritmo >= 0 ? '+' : ''}${fmtNum(Math.round(ritmo * 100) / 100)} kg a settimana.`);
  const c = consiglioPeso(p, o, oggi);
  out.push(`Consiglio automatico dell'app: ${c.titolo}. ${c.testo}`);

  // diario e note
  if (diario.length) {
    out.push('\nDIARIO: ' + diario.slice(0, 6).map(e => `settimana ${e.settimana} (${e.giorno}): ${e.peso ? fmtNum(e.peso) + ' kg' : ''}, panca ${e.panca || '-'}, squat ${e.squat || '-'}, rematore ${e.rematore || '-'}${e.note ? `, note: ${e.note}` : ''}`).join(' | '));
  }
  const note = (giorni || []).filter(g => g.nota && (g.id || g.giorno) >= addDaysIso(oggi, -14))
    .sort((a, b) => (b.id || b.giorno).localeCompare(a.id || a.giorno)).slice(0, 10);
  if (note.length) out.push('NOTE DEI GIORNI: ' + note.map(g => `${g.id || g.giorno}: ${g.nota}`).join(' | '));

  return out.join('\n');
}

/**
 * Spunti automatici sulla settimana: frasi brevi, senza AI, calcolate dai dati.
 * @returns {{id:string, icona:string, tono:'bene'|'consiglio'|'info', titolo:string, testo:string, vai?:[string, object?]}[]}
 */
export function spunti({ oggi = isoDay(), imp, sessioni = [], cibi = [], giorni = [], pesi = [], esercizi = [] }) {
  const out = [];
  const o = imp.obiettivi;
  const tot = perGiorno(cibi);
  const ultimi7 = giorniPrima(oggi, 7);
  const conCibo = ultimi7.filter(g => tot.has(g));

  // peso (il consiglio più importante va per primo)
  const c = consiglioPeso(pesi, o, oggi);
  if (c.tipo === 'aumenta' || c.tipo === 'riduci') {
    out.push({ id: 'peso', icona: c.tipo === 'aumenta' ? 'arrowUp' : 'gauge', tono: 'consiglio', titolo: c.titolo, testo: c.testo, vai: ['progressi', { sotto: 'corpo' }] });
  } else if (c.tipo === 'ok' && c.ritmo != null && c.ritmo >= 0.25) {
    out.push({ id: 'peso', icona: 'scale', tono: 'bene', titolo: c.titolo, testo: c.testo, vai: ['progressi', { sotto: 'corpo' }] });
  }

  // allenamenti della settimana (fino a oggi)
  const lun = isoDay(mondayOf(parseDay(oggi)));
  const fatte = sedutePassate(sessioni).filter(s => isoDay(new Date(s.data)) >= lun);
  let previsteFinora = 0, previsteTot = 0;
  for (let i = 0; i < 7; i++) {
    const g = addDaysIso(lun, i);
    if (!sedutaDelGiorno(imp, weekdayIt(parseDay(g)))) continue;
    previsteTot++;
    if (g < oggi) previsteFinora++; // la seduta di oggi non è "saltata": la giornata non è finita
  }
  if (previsteTot) {
    if (fatte.length >= previsteTot) {
      out.push({ id: 'settimana', icona: 'calendarCheck', tono: 'bene', titolo: 'Settimana completa', testo: `Hai fatto tutti i ${previsteTot} allenamenti della settimana.` });
    } else if (fatte.length < previsteFinora) {
      out.push({ id: 'settimana', icona: 'calendar', tono: 'info', titolo: `${fatte.length} allenamenti su ${previsteTot}`,
        testo: 'Se hai saltato una seduta non recuperarla tutta insieme: riprendi dalla prossima del calendario.' });
    } else {
      out.push({ id: 'settimana', icona: 'calendar', tono: 'info', titolo: `${fatte.length} allenamenti su ${previsteTot}`, testo: 'In linea con il calendario.' });
    }
  }

  // record degli ultimi 7 giorni
  const sette = addDaysIso(oggi, -6);
  const rec = sedutePassate(sessioni).filter(s => isoDay(new Date(s.data)) >= sette)
    .reduce((t, s) => t + recordBattuti(sessioni, s).length, 0);
  if (rec > 0) out.push({ id: 'record', icona: 'trophy', tono: 'bene', titolo: rec === 1 ? '1 record questa settimana' : `${rec} record questa settimana`, testo: 'Più peso o più ripetizioni di sempre: la progressione funziona.' });

  // esercizi fermi o pronti a salire
  const w = settimanaProgramma(imp.inizioProgramma, oggi);
  const fermi = [], sali = [];
  const visti = new Set();
  for (let g = 1; g <= 7; g++) {
    const cod = sedutaDelGiorno(imp, g);
    for (const r of imp.schede[cod]?.righe || []) {
      if (visti.has(r.ex)) continue;
      visti.add(r.ex);
      const h = storico(sessioni, r.ex);
      if (!h.length) continue;
      const s = suggerisci(r, h, attrezzoDi(r.ex, esercizi), w.scarico);
      if (s.tipo === 'fermo') fermi.push(r.ex);
      if (s.tipo === 'sali') sali.push(r.ex);
    }
  }
  if (fermi.length) {
    out.push({ id: 'fermi', icona: 'gauge', tono: 'consiglio', titolo: fermi.length === 1 ? `${fermi[0]} è fermo` : `${fermi.length} esercizi fermi`,
      testo: `${fermi.join(', ')}: da 3 sedute senza miglioramenti. La prossima volta scendi del 10% e risali; dormi e mangia abbastanza.` });
  }
  if (sali.length) {
    out.push({ id: 'sali', icona: 'arrowUp', tono: 'bene', titolo: sali.length === 1 ? 'Un esercizio sale di peso' : `${sali.length} esercizi salgono di peso`,
      testo: `La prossima volta più peso su: ${sali.join(', ')}.` });
  }

  // cibo: proteine e calorie (solo se ci sono abbastanza giorni registrati)
  if (conCibo.length >= 3) {
    const media = k => conCibo.reduce((t, g) => t + tot.get(g)[k], 0) / conCibo.length;
    const kcal = Math.round(media('kcal')), prot = Math.round(media('prot'));
    if (kcal < o.kcalMin - 150) {
      out.push({ id: 'kcal', icona: 'flame', tono: 'consiglio', titolo: 'Calorie sotto l\'obiettivo',
        testo: `Media ${kcal} kcal al giorno, ne servono almeno ${o.kcalMin}. Per salire aggiungi uno spuntino o porzioni un po' più grandi.`, vai: ['cibo'] });
    } else {
      out.push({ id: 'kcal', icona: 'flame', tono: 'bene', titolo: 'Calorie a posto', testo: `Media ${kcal} kcal al giorno negli ultimi giorni registrati.` });
    }
    if (prot < o.proteine * 0.9) {
      out.push({ id: 'prot', icona: 'target', tono: 'consiglio', titolo: 'Proteine un po\' basse',
        testo: `Media ${prot} g al giorno, l'obiettivo è ${o.proteine} g. Aggiungi yogurt greco, latte, uova o tonno a merenda.`, vai: ['cibo'] });
    } else {
      out.push({ id: 'prot', icona: 'target', tono: 'bene', titolo: 'Proteine a posto', testo: `Media ${prot} g al giorno.` });
    }
  }
  if (conCibo.length < 4) {
    out.push(conCibo.length
      ? { id: 'registra', icona: 'forkKnife', tono: 'info', titolo: `Cibo registrato ${conCibo.length} ${conCibo.length === 1 ? 'giorno' : 'giorni'} su 7`,
        testo: 'Più giorni registri, più i consigli su calorie e proteine sono precisi.', vai: ['cibo'] }
      : { id: 'registra', icona: 'forkKnife', tono: 'info', titolo: 'Registra quello che mangi',
        testo: 'Con qualche giorno registrato qui vedi se calorie e proteine sono abbastanza per salire di peso.', vai: ['cibo'] });
  }

  // creatina
  const rg = new Map((giorni || []).map(g => [g.id || g.giorno, g]));
  const creatina = ultimi7.filter(g => rg.get(g)?.creatina).length;
  const usaApp = ultimi7.some(g => tot.has(g) || rg.has(g));
  if (usaApp && creatina < 5) {
    out.push({ id: 'creatina', icona: 'pill', tono: 'info', titolo: `Creatina ${creatina} ${creatina === 1 ? 'giorno' : 'giorni'} su 7`,
      testo: 'Funziona se la prendi tutti i giorni, anche quelli di riposo: 5 g con un pasto.' });
  }
  return out;
}
