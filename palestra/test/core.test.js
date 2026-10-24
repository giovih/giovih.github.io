// Test della logica pura: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isoDay, parseDay, daysBetween, addDaysIso, weekdayIt, timeToMinutes, minutesToTime, atTime } from '../core/dates.js';
import { fmtNum, fmtKg1, parseNum, fmtDuration, fmtRest, fmtSetsReps, fmtDelta } from '../core/format.js';
import { settimanaProgramma } from '../core/cycle.js';
import { suggerisci, storico, ultimaVolta, statistiche, recordBattuti, arrotonda, puntiEsercizio } from '../core/progression.js';
import { totali, perQuantita, kcalDaMacro, consiglioPeso, applicaConsiglio, lineaObiettivo, OBIETTIVI_BASE } from '../core/nutrition.js';
import { PRESET, ALIMENTI, cercaLocale, PASTI, pastoPerOra } from '../core/foods.js';
import { durataStimata, SCHEDE } from '../core/scheda.js';
import { impostazioniIniziali, normalizzaImpostazioni, sedutaDelGiorno } from '../core/settings.js';
import { calcolaPromemoria, notificaRecupero } from '../core/reminders.js';
import { daVecchioStato, pesiIniziali, eVecchioStato } from '../core/migrate.js';

// ---------- date e formati ----------

test('date locali', () => {
  assert.equal(isoDay(new Date(2026, 9, 23)), '2026-10-23');
  assert.equal(daysBetween('2026-10-12', '2026-10-23'), 11);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // cambio ora legale
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayIt(parseDay('2026-10-23')), 5); // venerdì
  assert.equal(weekdayIt(parseDay('2026-10-25')), 7); // domenica
  assert.equal(timeToMinutes('16:30'), 990);
  assert.equal(minutesToTime(-30), '23:30');
  assert.equal(atTime('2026-10-23', '07:15').getHours(), 7);
  assert.equal(parseDay('non è una data'), null);
});

test('numeri all\'italiana', () => {
  assert.equal(fmtNum(62.5), '62,5');
  assert.equal(fmtNum(60), '60');
  assert.equal(fmtNum(null), '–');
  assert.equal(fmtKg1(55), '55,0');
  assert.equal(parseNum('56,4'), 56.4);
  assert.equal(parseNum(' 7 '), 7);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum(''), null);
  assert.equal(fmtDuration(75), '1:15');
  assert.equal(fmtDuration(3725), '1:02:05');
  assert.equal(fmtRest(120, 180), '2-3 min');
  assert.equal(fmtRest(90, 90), '90 s');
  assert.equal(fmtRest(60, 90), '60-90 s');
  assert.equal(fmtSetsReps(4, 6, 8), '4 × 6-8');
  assert.equal(fmtSetsReps(3, 15, 15), '3 × 15');
  assert.equal(fmtDelta(-1.4), '−1,4');
  assert.equal(fmtDelta(0.04), '±0');
});

// ---------- settimane del programma ----------

test('settimana del ciclo, scarico, drop set e diario', () => {
  const w = d => settimanaProgramma('2026-10-12', d);
  assert.deepEqual(w('2026-10-12'), { n: 1, ciclo: 1, scarico: false, drop: false, diario: true });
  assert.equal(w('2026-10-23').n, 2);
  assert.equal(w('2026-10-25').n, 2); // domenica: stessa settimana
  assert.equal(w('2026-11-09').drop, true); // settimana 5
  const s8 = w('2026-11-30');
  assert.equal(s8.n, 8);
  assert.equal(s8.scarico, true);
  assert.equal(s8.drop, false);
  assert.equal(s8.diario, true);
  assert.equal(w('2026-12-07').ciclo, 1); // settimana 9 → nuovo ciclo
  assert.equal(w('2026-10-01').n, 1); // prima dell'inizio: settimana 1
});

// ---------- doppia progressione ----------

const riga = { serie: 4, min: 6, max: 8 };
const h = (kg, reps, pulita = true) => ({ data: '', sets: reps.map(r => ({ kg, reps: r })), pulita });

test('prima volta: si parte dal minimo', () => {
  const s = suggerisci(riga, [], 'bil');
  assert.equal(s.kg, null);
  assert.deepEqual(s.reps, [6, 6, 6, 6]);
  assert.equal(s.tipo, 'primo');
});

test('+1 ripetizione a parità di peso', () => {
  const s = suggerisci(riga, [h(40, [6, 6, 6, 5])], 'bil');
  assert.equal(s.kg, 40);
  assert.deepEqual(s.reps, [7, 7, 7, 6]);
  assert.equal(s.tipo, 'aggiungi');
});

test('massimo in tutte le serie: si sale di peso secondo l\'attrezzo', () => {
  assert.equal(suggerisci(riga, [h(40, [8, 8, 8, 8])], 'bil').kg, 42.5);
  assert.equal(suggerisci(riga, [h(14, [8, 8, 8, 8])], 'man').kg, 16);
  assert.equal(suggerisci(riga, [h(30, [8, 8, 8, 8])], 'cav').kg, 32.5);
  const s = suggerisci(riga, [h(40, [8, 8, 8, 8])], 'bil');
  assert.deepEqual(s.reps, [6, 6, 6, 6]);
  assert.equal(s.tipo, 'sali');
});

test('tecnica non pulita: niente aumento di peso', () => {
  const s = suggerisci(riga, [h(40, [8, 8, 8, 8], false)], 'bil');
  assert.equal(s.kg, 40);
  assert.deepEqual(s.reps, [8, 8, 8, 8]);
});

test('serie mancanti: niente aumento', () => {
  const s = suggerisci(riga, [h(40, [8, 8, 8])], 'bil');
  assert.equal(s.kg, 40);
});

test('nessun miglioramento: stesso peso, riprova', () => {
  const s = suggerisci(riga, [h(40, [7, 6, 6, 6]), h(40, [7, 6, 6, 6])], 'bil');
  assert.equal(s.tipo, 'ripeti');
  assert.equal(s.kg, 40);
});

test('fermo da 3 sedute: -10% e risalita', () => {
  const s = suggerisci(riga, [h(60, [7, 6, 6, 6]), h(60, [7, 6, 6, 6]), h(60, [7, 6, 6, 6])], 'bil');
  assert.equal(s.tipo, 'fermo');
  assert.equal(s.kg, 55); // 54 arrotondato a 2,5
  assert.ok(s.kg < 60);
});

test('trazioni a corpo libero: prima le ripetizioni, poi zavorra', () => {
  const r = { serie: 3, min: 6, max: 10 };
  const a = suggerisci(r, [h(0, [8, 7, 6])], 'cl');
  assert.equal(a.kg, 0);
  assert.match(a.msg, /zavorra/);
  const b = suggerisci(r, [h(0, [10, 10, 10])], 'cl');
  assert.equal(b.kg, 2.5);
});

test('scarico: metà serie e -10%', () => {
  const s = suggerisci(riga, [h(60, [6, 6, 6, 6])], 'bil', true);
  assert.equal(s.reps.length, 2);
  assert.equal(s.kg, 55);
  assert.equal(s.tipo, 'scarico');
});

test('ripetizioni mai sotto il minimo', () => {
  const s = suggerisci(riga, [h(40, [4, 4, 4, 4])], 'bil');
  assert.deepEqual(s.reps, [6, 6, 6, 6]);
});

test('arrotondamento', () => {
  assert.equal(arrotonda(54, 2.5), 55);
  assert.equal(arrotonda(9.4, 1), 9);
});

const seduta = (id, data, voci, extra = {}) => ({ id, data, fine: data, voci, ...extra });
const voce = (ex, sets, extra = {}) => ({ ex, sets: sets.map(([kg, reps, fatto = true]) => ({ kg, reps, fatto })), ...extra });

test('storico esclude scarico e serie non fatte', () => {
  const sed = [
    seduta('1', '2026-10-12T16:00:00Z', [voce('Panca piana', [[40, 6], [40, 6], [40, 0, false]])]),
    seduta('2', '2026-10-19T16:00:00Z', [voce('Panca piana', [[36, 6]])], { scarico: true }),
    seduta('3', '2026-10-20T16:00:00Z', [voce('Squat', [[50, 8]])]),
    { id: '4', data: '2026-10-21T16:00:00Z', fine: null, voci: [voce('Panca piana', [[45, 6]])] }, // in corso
  ];
  const st = storico(sed, 'Panca piana');
  assert.equal(st.length, 1);
  assert.equal(st[0].sets.length, 2);
  assert.equal(ultimaVolta(sed, 'Panca piana').sets[0].kg, 36); // l'ultima volta comprende lo scarico
  assert.equal(ultimaVolta(sed, 'Stacco'), null);
  const p = puntiEsercizio(sed, 'Panca piana');
  assert.equal(p.length, 2);
  assert.equal(p[1].scarico, true);
});

test('statistiche e record', () => {
  const a = seduta('a', '2026-10-12T16:00:00Z', [voce('Panca piana', [[40, 8], [40, 7]])]);
  const b = { ...seduta('b', '2026-10-19T16:00:00Z', [voce('Panca piana', [[42.5, 6], [40, 0, false]])]), fine: '2026-10-19T17:05:00Z' };
  const st = statistiche(b);
  assert.equal(st.serie, 1);
  assert.equal(st.totali, 2);
  assert.equal(st.volume, 255);
  assert.equal(st.durata, 3900);
  assert.deepEqual(recordBattuti([a, b], b), [{ ex: 'Panca piana', kg: 42.5, reps: 6 }]);
  assert.deepEqual(recordBattuti([a], a), []); // prima volta: nessun record
});

test('durata stimata delle sedute tra 50 e 80 minuti', () => {
  for (const c of ['A', 'B', 'G', 'C']) {
    const m = durataStimata(SCHEDE[c]);
    assert.ok(m >= 50 && m <= 80, `${c}: ${m} min`);
  }
  assert.equal(durataStimata(null), 0);
});

// ---------- calorie e macro ----------

test('totali dei cibi', () => {
  assert.deepEqual(totali([{ kcal: 680, prot: 33, carb: 85, grassi: 23 }, { kcal: 310.4, prot: 11, carb: 46, grassi: 9 }]),
    { kcal: 990, prot: 44, carb: 131, grassi: 32 });
  assert.deepEqual(totali([]), { kcal: 0, prot: 0, carb: 0, grassi: 0 });
  assert.deepEqual(totali(null), { kcal: 0, prot: 0, carb: 0, grassi: 0 });
  assert.deepEqual(totali([{ kcal: 'x' }, null]), { kcal: 0, prot: 0, carb: 0, grassi: 0 });
});

test('valori per quantità', () => {
  const pasta = ALIMENTI.find(x => x.id === 'db-pasta');
  assert.deepEqual(perQuantita(pasta, 110), { kcal: 395, prot: 14.3, carb: 78.1, grassi: 2.2 });
  assert.equal(perQuantita(pasta, 0).kcal, 0);
  assert.equal(kcalDaMacro({ prot: 33, carb: 85, grassi: 23 }), 679);
});

test('pasti preimpostati: kcal coerenti con i macro e uguali alla scheda', () => {
  assert.equal(PRESET.length, 18);
  for (const p of PRESET) {
    const k = kcalDaMacro(p);
    assert.ok(Math.abs(k - p.kcal) <= 20, `${p.nome}: ${k} vs ${p.kcal}`);
    assert.ok(PASTI.some(x => x.key === p.pasto));
  }
  assert.equal(PRESET.find(p => p.id === 'preset-colazione-1').kcal, 680);
  assert.equal(PRESET.find(p => p.id === 'preset-notte-2').prot, 14);
});

test('alimenti di base: kcal coerenti con i macro', () => {
  for (const x of ALIMENTI) {
    const k = kcalDaMacro(x);
    // alcol, fibre e arrotondamenti delle tabelle: tolleranza 12%
    assert.ok(Math.abs(k - x.kcal) <= Math.max(15, x.kcal * 0.12), `${x.nome}: ${k} vs ${x.kcal}`);
  }
});

test('ricerca alimenti senza accenti', () => {
  assert.equal(cercaLocale('YOGURT greco')[0].id, 'db-yogurt-greco');
  assert.ok(cercaLocale('burro arachidi').some(x => x.id === 'db-burro-arachidi'));
  assert.deepEqual(cercaLocale(''), []);
  assert.equal(pastoPerOra(7), 'colazione');
  assert.equal(pastoPerOra(23), 'notte');
});

// ---------- peso e consigli ----------

const obiettivi = { ...OBIETTIVI_BASE, baseKcalMin: 3000, baseKcalMax: 3300, ultimoAggiustamento: null };
const pesi = arr => arr.map(([giorno, kg]) => ({ giorno, kg }));

test('peso: pochi dati', () => {
  assert.equal(consiglioPeso([], obiettivi, '2026-10-23').tipo, 'dati');
  assert.equal(consiglioPeso(pesi([['2026-10-12', 56.1]]), obiettivi, '2026-10-23').tipo, 'dati');
});

test('peso sceso (56,1 → 54,7): +250 kcal', () => {
  const c = consiglioPeso(pesi([['2026-10-12', 56.1], ['2026-10-23', 54.7]]), obiettivi, '2026-10-23');
  assert.equal(c.tipo, 'aumenta');
  assert.equal(c.delta, 250);
});

test('peso fermo da 2 settimane: +250 kcal', () => {
  const c = consiglioPeso(pesi([['2026-10-01', 56], ['2026-10-08', 56.2], ['2026-10-15', 56]]), obiettivi, '2026-10-15');
  assert.equal(c.tipo, 'aumenta');
});

test('salita giusta: nessun cambio', () => {
  const c = consiglioPeso(pesi([['2026-10-01', 56], ['2026-10-08', 56.4], ['2026-10-15', 56.8]]), obiettivi, '2026-10-15');
  assert.equal(c.tipo, 'ok');
  assert.equal(c.delta, 0);
});

test('salita troppo veloce per più settimane: -200 solo sopra la base', () => {
  const p = pesi([['2026-09-17', 56], ['2026-10-01', 57.6], ['2026-10-15', 59.2]]);
  // obiettivo già alzato a 3500: si può togliere 200
  const alzato = { ...obiettivi, kcalMin: 3500, kcalMax: 3800 };
  const c = consiglioPeso(p, alzato, '2026-10-15');
  assert.equal(c.tipo, 'riduci');
  assert.equal(c.delta, -200);
  // alla base (3000): mai sotto, solo un messaggio
  const c2 = consiglioPeso(p, obiettivi, '2026-10-15');
  assert.equal(c2.tipo, 'veloce');
  assert.equal(c2.delta, 0);
});

test('applicare il consiglio non scende mai sotto la base', () => {
  const su = applicaConsiglio(obiettivi, { delta: 250 }, '2026-10-23');
  assert.equal(su.kcalMin, 3250);
  assert.equal(su.kcalMax, 3550);
  assert.equal(su.ultimoAggiustamento, '2026-10-23');
  const giu = applicaConsiglio(obiettivi, { delta: -200 }, '2026-10-23');
  assert.equal(giu.kcalMin, 3000);
  assert.equal(giu.kcalMax, 3300);
  assert.equal(applicaConsiglio(obiettivi, { delta: 0 }, 'x'), obiettivi);
});

test('dopo un aggiustamento si aspettano 2 settimane', () => {
  const c = consiglioPeso(pesi([['2026-10-12', 56.1], ['2026-10-23', 54.7]]), { ...obiettivi, ultimoAggiustamento: '2026-10-20' }, '2026-10-23');
  assert.equal(c.tipo, 'attesa');
});

test('linea obiettivo', () => {
  const l = lineaObiettivo(pesi([['2026-10-12', 56.1]]), '2026-11-09');
  assert.equal(l.a.min.toFixed(2), '57.10');
  assert.equal(l.a.max.toFixed(2), '58.10');
  assert.equal(lineaObiettivo([], '2026-11-09'), null);
});

// ---------- impostazioni e promemoria ----------

test('impostazioni: normalizzazione robusta', () => {
  const s = normalizzaImpostazioni({ calendario: { 1: 'Z' }, tema: 'boh', notifiche: { cena: { on: false } } });
  assert.equal(s.calendario[1], null);
  assert.equal(s.tema, 'auto');
  assert.equal(s.notifiche.cena.on, false);
  assert.equal(s.notifiche.cena.ora, '20:00');
  assert.equal(normalizzaImpostazioni(null).schede.A.righe.length, 6);
  assert.equal(sedutaDelGiorno(s, 2), null);
  assert.equal(sedutaDelGiorno({ ...s, avambracci: { attivo: true, giorno: 2 } }, 2), 'F');
});

test('promemoria: giorno di palestra', () => {
  const imp = impostazioniIniziali();
  const ora = new Date(2026, 9, 23, 6, 0); // venerdì 23, ore 6
  const p = calcolaPromemoria(imp, { ora, giorni: 1 });
  const tag = t => p.find(x => x.tag === t);
  assert.equal(new Date(tag('allenamento:2026-10-23').invio).getHours(), 15); // un'ora prima delle 16
  assert.equal(new Date(tag('pasto-pranzo:2026-10-23').invio).getHours(), 14); // 16:00 - 90 min = 14:30
  assert.equal(new Date(tag('pasto-pranzo:2026-10-23').invio).getMinutes(), 30);
  assert.equal(new Date(tag('pasto-merenda:2026-10-23').invio).getHours(), 17); // 16:00 + 105 = 17:45
  assert.ok(tag('creatina:2026-10-23'));
  assert.equal(p.filter(x => x.categoria === 'acqua').length, 4);
  assert.ok(!p.some(x => x.categoria === 'pesata')); // venerdì
  for (const x of p) assert.doesNotMatch(x.titolo + x.testo, /\p{Extended_Pictographic}/u);
});

test('promemoria: riposo, cose già fatte, impostazioni spente', () => {
  const imp = impostazioniIniziali();
  const ora = new Date(2026, 9, 26, 12, 0); // lunedì 26 a mezzogiorno
  const p = calcolaPromemoria(imp, { ora, giorni: 2, fatti: { creatina: { '2026-10-26': true }, acquaMl: { '2026-10-26': 3000 } } });
  assert.ok(!p.some(x => x.tag === 'creatina:2026-10-26'));
  assert.ok(!p.some(x => x.tag.startsWith('acqua:2026-10-26')));
  assert.ok(!p.some(x => x.tag === 'pasto-colazione:2026-10-26')); // già passata
  assert.ok(!p.some(x => x.tag === 'allenamento:2026-10-27')); // martedì riposo
  assert.equal(new Date(p.find(x => x.tag === 'pasto-pranzo:2026-10-27').invio).getHours(), 13); // riposo: 13:30
  imp.notifiche.pasti = undefined;
  imp.notifiche.colazione.on = false;
  assert.ok(!calcolaPromemoria(imp, { ora, giorni: 2 }).some(x => x.tag.startsWith('pasto-colazione')));
  const r = notificaRecupero(new Date(2026, 9, 23, 16, 5), 'Panca piana');
  assert.equal(r.tag, 'recupero');
  assert.match(r.testo, /Panca piana/);
});

// ---------- importazione dalla versione precedente ----------

const vecchio = {
  v: 1, inizio: '2026-10-12', calendario: { 1: 'A', 2: null, 3: 'B', 4: null, 5: 'G', 6: 'C', 7: null },
  schede: { A: { nome: 'Upper A', righe: [{ ex: 'Chest press', serie: 4, min: 6, max: 8, recMin: 120, recMax: 180, ss: null, drop: false }] } },
  esercizi: [{ nome: 'Pullover', gruppo: 'schiena', eq: 'man' }],
  sedute: [{ id: 1760630400000, data: '2026-10-16T14:00:00.000Z', fine: '2026-10-16T15:05:00.000Z', codice: 'G', nome: 'Gambe', settimana: 1, ciclo: 1, scarico: false,
    voci: [{ ex: 'Squat', serie: 4, min: 6, max: 8, recMin: 180, recMax: 180, ss: null, drop: false, pulita: true, msg: '', sets: [{ kg: 50, reps: 6, fatto: true }, { kg: '', reps: 6, fatto: false }] }] }],
  attiva: null,
  cibo: { '2026-10-17': { pasti: { pranzo: [{ desc: 'Pasta', kcal: 720, prot: 42, carb: 88, grassi: 19, foto: null }] }, acqua: 1500, creatina: true } },
  peso: [{ data: '2026-10-16', kg: 56.1 }],
  obiettivi: { kcalMin: 3000, kcalMax: 3300, prot: 120, carb: 400, grassi: 85 },
  diario: [{ data: '2026-10-17', settimana: 1, peso: 56.1, panca: '40 kg × 8', squat: '', rematore: '', note: 'inizio' }],
};

test('importazione dal sito', () => {
  assert.ok(eVecchioStato(vecchio));
  const { impostazioni, records, blob } = daVecchioStato(vecchio, [{ id: '99', data: '2026-10-17', img: 'data:image/jpeg;base64,AAAA', mini: 'data:image/jpeg;base64,BBBB' }]);
  assert.equal(impostazioni.schede.A.righe[0].ex, 'Chest press');
  assert.equal(impostazioni.schede.A.nome, 'Upper A');
  const by = k => records.filter(r => r.kind === k);
  assert.equal(by('sessione').length, 1);
  assert.equal(by('sessione')[0].data.voci[0].eq, 'bil');
  assert.equal(by('sessione')[0].data.voci[0].sets[1].kg, null);
  assert.equal(by('cibo')[0].data.giorno, '2026-10-17');
  assert.equal(by('giorno')[0].data.acquaMl, 1500);
  assert.equal(by('peso')[0].id, '2026-10-16');
  assert.equal(by('diario').length, 1);
  assert.equal(by('esercizio')[0].id, 'ex-pullover');
  assert.equal(by('foto').length, 1);
  assert.equal(blob.length, 2);
  // stessi id a ogni importazione: niente doppioni
  assert.deepEqual(daVecchioStato(vecchio).records.map(r => r.id), daVecchioStato(vecchio).records.map(r => r.id).slice());
  assert.equal(daVecchioStato({ sedute: [], schede: {} }).records.length, 0);
});

test('pesi iniziali: 56,1 e 54,7 senza doppioni', () => {
  assert.deepEqual(pesiIniziali([], '2026-10-12'), [{ giorno: '2026-10-12', kg: 56.1 }, { giorno: '2026-10-23', kg: 54.7 }]);
  assert.deepEqual(pesiIniziali([{ giorno: '2026-10-16', kg: 56.1 }], '2026-10-12'), [{ giorno: '2026-10-23', kg: 54.7 }]);
  assert.deepEqual(pesiIniziali([{ giorno: '2026-10-16', kg: 56.1 }, { giorno: '2026-10-23', kg: 55 }], '2026-10-12'), []);
});

// ---------- unione dei dati sincronizzati ----------

import { applicaRemoti, uguali, vinceRemoto } from '../core/sync-merge.js';

test('sincronizzazione: vince il più recente, i doppioni identici non contano', () => {
  const m = new Map();
  m.set('peso/1', { kind: 'peso', id: '1', data: { giorno: '1', kg: 55 }, updated: 10, deleted: false, dirty: false });
  // identico (con chiavi in altro ordine, come le restituisce il database): non cambia niente
  assert.equal(applicaRemoti(m, [{ kind: 'peso', id: '1', data: { kg: 55, giorno: '1' }, updated: 10, deleted: false }]).length, 0);
  // più vecchio: non vince
  assert.equal(applicaRemoti(m, [{ kind: 'peso', id: '1', data: { kg: 50 }, updated: 9 }]).length, 0);
  // più nuovo: vince
  assert.equal(applicaRemoti(m, [{ kind: 'peso', id: '1', data: { kg: 56 }, updated: 11 }]).length, 1);
  assert.equal(m.get('peso/1').data.kg, 56);
  // stesso istante ma contenuto diverso e locale già inviato (record "deboli" di due telefoni): vince il server
  m.set('impostazioni/impostazioni', { kind: 'impostazioni', id: 'impostazioni', data: { tema: 'auto' }, updated: 1, deleted: false, dirty: false });
  assert.equal(applicaRemoti(m, [{ kind: 'impostazioni', id: 'impostazioni', data: { tema: 'scuro' }, updated: 1 }]).length, 1);
  // stesso istante con modifiche locali non inviate: tengo le mie
  assert.equal(vinceRemoto({ updated: 5, dirty: true }, { updated: 5 }), false);
  // lapide
  applicaRemoti(m, [{ kind: 'peso', id: '1', data: null, updated: 20, deleted: true }]);
  assert.equal(m.get('peso/1').deleted, true);
  assert.ok(uguali({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
  assert.ok(!uguali({ a: [1, 2] }, { a: [2, 1] }));
});
