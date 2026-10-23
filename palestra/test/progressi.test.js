// Test dei calcoli della sezione Progressi (grafici, agenda, serie per muscolo).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { forzaStimata, puntiEsercizio } from '../core/progression.js';
import { ancoraObiettivo, lineaObiettivo, ritmoPeso, pesoAtteso } from '../core/nutrition.js';
import { seriePerGruppo, migliorePeriodo, datiAgenda, riassuntoMese, grigliaMese, scalaY, ticksGiorni } from '../core/stats.js';
import { impostazioniIniziali } from '../core/settings.js';
import { monthDays } from '../core/dates.js';

const seduta = (id, data, voci, extra = {}) => ({ id, data, fine: data, voci, ...extra });
const voce = (ex, sets, extra = {}) => ({ ex, sets: sets.map(([kg, reps, fatto = true]) => ({ kg, reps, fatto })), ...extra });
const pesi = arr => arr.map(([giorno, kg]) => ({ giorno, kg }));

// ---------- forza stimata e punti degli esercizi ----------

test('forza stimata (Epley)', () => {
  assert.equal(forzaStimata(60, 1), 60);
  assert.equal(forzaStimata(60, 10), 80);
  assert.equal(forzaStimata(0, 10), 0);       // corpo libero senza zavorra
  assert.equal(forzaStimata(50, 0), 0);
});

test('punti di un esercizio: forza, volume e serie migliore', () => {
  const sed = [
    seduta('1', '2026-10-12T16:00:00Z', [voce('Panca piana', [[40, 8], [40, 7]])]),
    seduta('2', '2026-10-19T16:00:00Z', [voce('Panca piana', [[42.5, 6], [40, 8]])]),
  ];
  const p = puntiEsercizio(sed, 'Panca piana');
  assert.equal(p.length, 2);
  assert.equal(p[0].volume, 600);
  assert.equal(p[0].forza, 50.5);             // 40 × (1 + 8/30) = 50,67 → 50,5
  assert.deepEqual(p[1].top, { kg: 42.5, reps: 6 });
  assert.equal(p[1].kg, 42.5);
  assert.equal(p[1].reps, 14);
});

// ---------- peso: fascia obiettivo e ritmo ----------

test('fascia obiettivo: dalla prima pesata o dall\'ultimo cambio di calorie', () => {
  const p = pesi([['2026-10-12', 56.1], ['2026-10-23', 54.7], ['2026-10-30', 55.0]]);
  assert.deepEqual(ancoraObiettivo(p), { giorno: '2026-10-12', kg: 56.1 });
  assert.deepEqual(ancoraObiettivo(p, '2026-10-24'), { giorno: '2026-10-23', kg: 54.7 });
  assert.deepEqual(ancoraObiettivo(p, '2026-10-01'), { giorno: '2026-10-12', kg: 56.1 }); // cambio prima di ogni pesata
  assert.equal(ancoraObiettivo([]), null);
  const l = lineaObiettivo(p, '2026-11-06', '2026-10-24');
  assert.equal(l.da.kg, 54.7);
  assert.equal(l.a.min.toFixed(2), '55.20');  // 2 settimane × 0,25
  assert.equal(l.a.max.toFixed(2), '55.70');
  assert.equal(pesoAtteso(p, '2026-10-23', '2026-10-24').min, 54.7);
});

test('ritmo del peso in kg a settimana', () => {
  assert.equal(ritmoPeso([], '2026-10-23'), null);
  assert.equal(ritmoPeso(pesi([['2026-10-20', 55], ['2026-10-23', 55.3]]), '2026-10-23'), null); // meno di 6 giorni
  const r = ritmoPeso(pesi([['2026-10-02', 55], ['2026-10-09', 55.3], ['2026-10-16', 55.6], ['2026-10-23', 55.9]]), '2026-10-23');
  assert.equal(r.toFixed(2), '0.30');
  const giu = ritmoPeso(pesi([['2026-10-12', 56.1], ['2026-10-23', 54.7]]), '2026-10-23');
  assert.ok(giu < 0);
  // pesate rare (più di 4 settimane tra le due): usa comunque le ultime due
  const rare = ritmoPeso(pesi([['2026-08-01', 54], ['2026-10-23', 56]]), '2026-10-23');
  assert.ok(rare > 0 && rare < 0.2);
});

// ---------- serie per muscolo ----------

test('serie per gruppo muscolare nel periodo', () => {
  const sed = [
    seduta('1', '2026-10-19T16:00:00', [voce('Panca piana', [[40, 8], [40, 8], [40, 0, false]], { gruppo: 'petto' }), voce('Curl', [[10, 10]])]),
    seduta('2', '2026-10-21T16:00:00', [voce('Croci ai cavi', [[10, 12], [10, 12]], { gruppo: 'petto' })]),
    seduta('3', '2026-10-10T16:00:00', [voce('Squat', [[50, 8]], { gruppo: 'quadricipiti' })]), // fuori periodo
    { id: '4', data: '2026-10-22T16:00:00', fine: null, voci: [voce('Panca piana', [[40, 8]], { gruppo: 'petto' })] }, // in corso
  ];
  const r = seriePerGruppo(sed, '2026-10-17', '2026-10-23', nome => (nome === 'Curl' ? 'bicipiti' : 'altro'));
  assert.deepEqual(r, [{ gruppo: 'petto', serie: 4 }, { gruppo: 'bicipiti', serie: 1 }]);
  assert.deepEqual(seriePerGruppo([], '2026-10-17', '2026-10-23'), []);
});

test('serie migliore recente per il diario', () => {
  const sed = [
    seduta('1', '2026-08-01T16:00:00', [voce('Panca piana', [[50, 8]])]),
    seduta('2', '2026-10-20T16:00:00', [voce('Panca piana', [[45, 8], [45, 9]])]),
  ];
  assert.deepEqual(migliorePeriodo(sed, 'Panca piana', '2026-10-23'), { kg: 45, reps: 9, data: '2026-10-20T16:00:00' });
  assert.equal(migliorePeriodo(sed, 'Panca piana', '2026-12-31').kg, 50); // niente di recente: la migliore di sempre
  assert.equal(migliorePeriodo(sed, 'Squat', '2026-10-23'), null);
});

// ---------- agenda ----------

test('agenda del mese: sedute, peso, cibo, note', () => {
  const imp = impostazioniIniziali();
  const giorni = monthDays(2026, 9); // ottobre
  const sed = [
    seduta('1', '2026-10-19T16:00:00', [voce('Panca piana', [[40, 8], [40, 8]])], { codice: 'A' }),
    { id: '2', data: '2026-10-23T16:00:00', fine: null, voci: [] }, // in corso: non conta
  ];
  const cibi = [
    { giorno: '2026-10-19', kcal: 1000.4, prot: 40.2 },
    { giorno: '2026-10-19', kcal: 1500, prot: 60 },
    { giorno: '2026-11-01', kcal: 900, prot: 10 }, // altro mese
  ];
  const a = datiAgenda({
    giorni, sessioni: sed, pesi: pesi([['2026-10-12', 56.1], ['2026-10-23', 54.7]]), cibi,
    giorniRec: [{ id: '2026-10-19', nota: 'stanco', acquaMl: 2000, creatina: true }], imp, oggi: '2026-10-23',
  });
  const g19 = a.get('2026-10-19');
  assert.equal(g19.sedute.length, 1);
  assert.equal(g19.sedute[0].stat.serie, 2);
  assert.equal(g19.prevista, 'A');             // lunedì
  assert.equal(g19.kcal, 2500);
  assert.equal(g19.prot, 100);
  assert.equal(g19.nCibi, 2);
  assert.equal(g19.nota, 'stanco');
  assert.equal(g19.creatina, true);
  assert.equal(a.get('2026-10-23').peso, 54.7);
  assert.equal(a.get('2026-10-23').pesoPrima, 56.1);
  assert.equal(a.get('2026-10-23').sedute.length, 0);
  assert.equal(a.get('2026-10-20').prevista, null); // martedì: riposo
  assert.equal(a.get('2026-10-30').futuro, true);
  const r = riassuntoMese(a);
  assert.deepEqual(r, { allenamenti: 1, pesate: 2, giorniCibo: 1, kcalMedia: 2500, protMedia: 100 });
});

test('griglia del mese parte di lunedì', () => {
  const g = grigliaMese(2026, 9); // 1 ottobre 2026 è giovedì
  assert.equal(g.length % 7, 0);
  assert.deepEqual(g.slice(0, 4), [null, null, null, '2026-10-01']);
  assert.equal(g.filter(Boolean).length, 31);
  assert.equal(grigliaMese(2027, 1).filter(Boolean).length, 28); // febbraio
});

// ---------- scale dei grafici ----------

test('scala verticale con numeri tondi', () => {
  const s = scalaY([54.7, 56.1, 56.9]);
  assert.equal(s.passo, 1);
  assert.deepEqual(s.ticks, [54, 55, 56, 57]);
  const uno = scalaY([56.1], { minSpan: 1.5 });  // un solo valore: niente errori, una fascia attorno
  assert.ok(uno.min < 56.1 && uno.max > 56.1);
  assert.ok(uno.ticks.length >= 2);
  const zero = scalaY([], {});
  assert.ok(zero.ticks.length >= 2);
  const kg = scalaY([40, 62.5], { maxTicks: 4 });
  assert.ok(kg.ticks.length <= 4);
  assert.ok(kg.min <= 40 && kg.max >= 62.5);
  assert.equal(scalaY([12, 18], { daZero: true }).min, 0);
});

test('date sull\'asse orizzontale', () => {
  const s = ticksGiorni('2026-10-12', '2026-11-09', 5);
  assert.ok(s.length >= 2 && s.length <= 5);
  assert.equal(s[0].giorno, '2026-10-12');     // lunedì
  assert.equal(s[0].etichetta, '12 ott');
  const corti = ticksGiorni('2026-10-20', '2026-10-23', 5);
  assert.equal(corti.length, 4);                // ogni giorno
  const lunghi = ticksGiorni('2026-10-12', '2027-04-12', 5);
  assert.ok(lunghi.length >= 2 && lunghi.length <= 5);
  assert.ok(lunghi.some(t => t.etichetta.includes('27')));  // cambio d'anno
  assert.deepEqual(ticksGiorni('2026-10-23', '2026-10-23', 5).map(t => t.giorno), ['2026-10-23']);
});
