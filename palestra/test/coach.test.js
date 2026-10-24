// Test del Coach: riassunto per l'AI e spunti automatici.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { riassuntoDati, spunti, DOMANDE } from '../core/coach.js';
import { impostazioniIniziali } from '../core/settings.js';

const seduta = (id, data, voci, extra = {}) => ({ id, data, fine: data, voci, ...extra });
const voce = (ex, sets, extra = {}) => ({ ex, sets: sets.map(([kg, reps, fatto = true]) => ({ kg, reps, fatto })), ...extra });
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const imp = impostazioniIniziali();
const oggi = '2026-10-23';

const dati = {
  oggi, imp,
  sessioni: [
    seduta('1', '2026-10-19T16:00:00', [voce('Panca piana', [[40, 8], [40, 8], [40, 8], [40, 8]], { nota: 'facile' })], { nome: 'Upper A', codice: 'A' }),
    seduta('2', '2026-10-21T16:00:00', [voce('Lat machine presa larga', [[35, 10], [35, 9]])], { nome: 'Upper B', codice: 'B' }),
  ],
  cibi: [
    { giorno: '2026-10-22', pasto: 'pranzo', nome: 'Pasta al tonno', kcal: 1100, prot: 45, carb: 150, grassi: 25 },
    { giorno: '2026-10-21', pasto: 'cena', nome: 'Pollo e riso', kcal: 1000, prot: 40, carb: 120, grassi: 20 },
    { giorno: '2026-10-20', pasto: 'colazione', nome: 'Latte e cereali', kcal: 700, prot: 25, carb: 100, grassi: 15 },
  ],
  giorni: [{ id: '2026-10-22', acquaMl: 2000, creatina: true, nota: 'dormito poco' }],
  pesi: [{ giorno: '2026-10-12', kg: 56.1 }, { giorno: '2026-10-23', kg: 54.7 }],
  diario: [{ giorno: '2026-10-12', settimana: 1, peso: 56.1, panca: '40 kg x 8', squat: '', rematore: '', note: 'inizio' }],
  esercizi: [],
};

test('riassunto per il Coach: contiene i dati importanti, senza emoji', () => {
  const r = riassuntoDati(dati);
  assert.match(r, /venerdì 23 ottobre 2026/);
  assert.match(r, /Settimana 2 del programma/);
  assert.match(r, /Panca piana 40x8, 40x8, 40x8, 40x8 \[nota: facile\]/);
  assert.match(r, /Pasta al tonno \(1100 kcal\)/);
  assert.match(r, /2026-10-23 54,7 kg/);
  assert.match(r, /Aggiungi 250 kcal/);             // consiglio: il peso è sceso
  assert.match(r, /dormito poco/);
  assert.match(r, /PROSSIMA VOLTA/);
  assert.ok(!emoji.test(r));
  assert.ok(r.length < 24000);
});

test('riassunto con l\'app vuota: niente errori', () => {
  const r = riassuntoDati({ oggi, imp });
  assert.match(r, /nessuno/);
  assert.match(r, /nessuna pesata/);
});

test('spunti della settimana: peso, cibo, creatina; mai "mangia meno"', () => {
  const sp = spunti(dati);
  const ids = sp.map(x => x.id);
  assert.equal(ids[0], 'peso');                       // il peso scende: è il consiglio più importante
  assert.ok(ids.includes('kcal'));                     // 3 giorni registrati: calorie sotto l'obiettivo
  assert.equal(sp.find(x => x.id === 'kcal').tono, 'consiglio');
  assert.ok(ids.includes('prot'));
  assert.ok(ids.includes('registra'));                 // solo 3 giorni su 7
  assert.ok(ids.includes('creatina'));
  for (const x of sp) {
    assert.ok(!/mangia(re)? meno|dimagr|perdere peso|riduci le calorie/i.test(x.titolo + ' ' + x.testo), x.testo);
    assert.ok(!emoji.test(x.titolo + x.testo));
  }
});

test('spunti: un esercizio pronto a salire di peso', () => {
  const sp = spunti(dati);
  const sali = sp.find(x => x.id === 'sali');
  assert.ok(sali && sali.testo.includes('Panca piana'));   // 4x8 = massimo dell'intervallo 6-8
});

test('spunti con l\'app vuota: niente errori', () => {
  const sp = spunti({ oggi, imp });
  assert.ok(Array.isArray(sp));
  assert.ok(DOMANDE.length >= 4);
});
