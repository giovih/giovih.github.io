// Importazione dei dati della versione precedente (sito) e backup nel formato nuovo.
// Gli identificativi sono deterministici: importare due volte lo stesso file non crea doppioni.

import { impostazioniIniziali, normalizzaImpostazioni, PESO_PARTENZA } from './settings.js';
import { attrezzoDi, SCHEDE } from './scheda.js';
import { normalizza } from './foods.js';
import { parseDay, isoDay, addDaysIso } from './dates.js';
import { OBIETTIVI_BASE } from './nutrition.js';

const num = v => {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
};
const giornoValido = s => typeof s === 'string' && parseDay(s) ? s.slice(0, 10) : null;
export const slug = s => normalizza(s).replace(/ /g, '-') || 'x';

/** È un salvataggio della versione precedente (sito)? */
export const eVecchioStato = x => !!x && typeof x === 'object' && Array.isArray(x.sedute) && typeof x.schede === 'object';

/** È un backup della versione nuova? */
export const eBackupNuovo = x => !!x && x.formato === 'palestra-backup' && Array.isArray(x.records);

function voceDaVecchia(v) {
  return {
    ex: String(v.ex || 'Esercizio'),
    eq: attrezzoDi(v.ex),
    serie: +v.serie || (v.sets || []).length || 3,
    min: +v.min || 8, max: +v.max || +v.min || 10,
    recMin: +v.recMin || 90, recMax: +v.recMax || +v.recMin || 90,
    ss: v.ss ?? null, drop: !!v.drop,
    pulita: v.pulita !== false, nota: '',
    sets: (v.sets || []).map(x => ({ kg: num(x.kg), reps: num(x.reps), fatto: !!x.fatto })),
  };
}

function sedutaDaVecchia(s, attiva = false) {
  const def = SCHEDE[s.codice] || {};
  return {
    data: s.data,
    fine: attiva ? null : (s.fine || s.data),
    codice: s.codice || 'A',
    nome: s.nome || def.nome || 'Allenamento',
    tono: def.tono || 'ambra',
    settimana: +s.settimana || 1,
    ciclo: +s.ciclo || 1,
    scarico: !!s.scarico,
    voci: (s.voci || []).map(voceDaVecchia),
  };
}

/**
 * Converte lo stato della versione precedente (localStorage "palestra-v1" o file di backup del sito).
 * @param {object} S stato vecchio
 * @param {{id:string, data:string, img:string, mini:string}[]} fotoVecchie foto (IndexedDB "palestra-foto")
 * @returns {{impostazioni: object, records: {kind:string, id:string, data:object}[], blob: {key:string, dataUrl:string}[]}}
 */
export function daVecchioStato(S, fotoVecchie = []) {
  const records = [];
  const blob = [];
  const add = (kind, id, data) => records.push({ kind, id, data });

  // Impostazioni
  const imp = impostazioniIniziali();
  if (giornoValido(S.inizio)) imp.inizioProgramma = S.inizio;
  if (S.calendario && typeof S.calendario === 'object') {
    for (let d = 1; d <= 7; d++) imp.calendario[d] = S.calendario[d] ?? S.calendario[String(d)] ?? null;
  }
  if (S.schede && typeof S.schede === 'object') {
    for (const [cod, sc] of Object.entries(S.schede)) {
      if (imp.schede[cod] && Array.isArray(sc?.righe) && sc.righe.length) {
        imp.schede[cod].righe = sc.righe.map(r => ({
          ex: String(r.ex), serie: +r.serie || 3, min: +r.min || 8, max: +r.max || +r.min || 10,
          recMin: +r.recMin || 90, recMax: +r.recMax || +r.recMin || 90, ss: r.ss ?? null, drop: !!r.drop,
        }));
      }
    }
  }
  const o = S.obiettivi || {};
  imp.obiettivi = {
    ...imp.obiettivi,
    kcalMin: +o.kcalMin || OBIETTIVI_BASE.kcalMin,
    kcalMax: +o.kcalMax || OBIETTIVI_BASE.kcalMax,
    proteine: +o.prot || OBIETTIVI_BASE.proteine,
    carboidrati: +o.carb || OBIETTIVI_BASE.carboidrati,
    grassi: +o.grassi || OBIETTIVI_BASE.grassi,
  };
  const impostazioni = normalizzaImpostazioni(imp);

  // Esercizi creati
  for (const e of S.esercizi || []) {
    if (e?.nome) add('esercizio', 'ex-' + slug(e.nome), { nome: e.nome, gruppo: e.gruppo || 'petto', eq: e.eq || 'mac' });
  }

  // Allenamenti (finiti e quello in corso)
  for (const s of S.sedute || []) if (s?.data) add('sessione', 'v1-' + s.id, sedutaDaVecchia(s));
  if (S.attiva?.data) add('sessione', 'v1-' + S.attiva.id, sedutaDaVecchia(S.attiva, true));

  // Cibo, acqua, creatina
  for (const [giorno, g] of Object.entries(S.cibo || {})) {
    if (!giornoValido(giorno) || !g) continue;
    for (const [pasto, lista] of Object.entries(g.pasti || {})) {
      (lista || []).forEach((x, i) => add('cibo', `v1-${giorno}-${pasto}-${i}`, {
        giorno, pasto, nome: x.desc || 'Pasto', descrizione: '',
        kcal: Math.round(+x.kcal || 0), prot: +x.prot || 0, carb: +x.carb || 0, grassi: +x.grassi || 0,
        foto: typeof x.foto === 'string' && x.foto.startsWith('data:image') ? x.foto : null,
        fonte: 'manuale', ora: null,
      }));
    }
    if ((+g.acqua || 0) > 0 || g.creatina) add('giorno', giorno, { acquaMl: +g.acqua || 0, creatina: !!g.creatina, nota: '' });
  }

  // Peso
  for (const p of S.peso || []) {
    const giorno = giornoValido(p?.data);
    const kg = num(p?.kg);
    if (giorno && kg > 0) add('peso', giorno, { giorno, kg });
  }

  // Diario
  (S.diario || []).forEach((e, i) => {
    if (!e) return;
    add('diario', `v1-diario-${e.data || i}-${i}`, {
      giorno: giornoValido(e.data) || isoDay(), settimana: +e.settimana || 1, peso: num(e.peso),
      panca: e.panca || '', squat: e.squat || '', rematore: e.rematore || '', note: e.note || '',
    });
  });

  // Foto di progresso
  for (const f of fotoVecchie || []) {
    if (!f?.id || !f.img) continue;
    const id = 'v1-foto-' + f.id;
    add('foto', id, { giorno: giornoValido(f.data) || isoDay(), nota: '' });
    blob.push({ key: `foto/${id}`, dataUrl: f.img });
    if (f.mini) blob.push({ key: `foto/${id}_t`, dataUrl: f.mini });
  }

  return { impostazioni, records, blob };
}

/**
 * Pesi da avere sempre: 56,1 kg (partenza) e 54,7 kg il 23/10/2026.
 * Non sovrascrive pesi già registrati in quei giorni.
 * @param {{giorno:string, kg:number}[]} pesi esistenti
 * @param {string} inizio giorno di inizio programma
 */
export function pesiIniziali(pesi, inizio) {
  const out = [];
  const giorni = new Set(pesi.map(p => p.giorno));
  if (!pesi.some(p => Math.abs(p.kg - PESO_PARTENZA) < 0.01)) {
    const primo = pesi.map(p => p.giorno).sort()[0];
    let g = primo && primo < inizio ? addDaysIso(primo, -1) : inizio;
    while (giorni.has(g)) g = addDaysIso(g, -1);
    out.push({ giorno: g, kg: PESO_PARTENZA });
    giorni.add(g);
  }
  if (!giorni.has('2026-10-23')) out.push({ giorno: '2026-10-23', kg: 54.7 });
  return out;
}
