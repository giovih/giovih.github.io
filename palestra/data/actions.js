// Operazioni dell'app (usate dalle schermate). Tutto passa dall'archivio locale:
// funziona senza internet e viene sincronizzato quando c'è rete.

import * as S from './store.js';
import { uuid } from './store.js';
import { isoDay, addDaysIso, weekdayIt, parseDay } from '../core/dates.js';
import { settimanaProgramma } from '../core/cycle.js';
import { storico, suggerisci, statistiche, recordBattuti } from '../core/progression.js';
import { attrezzoDi, gruppoDi, trovaEsercizio } from '../core/scheda.js';
import { sedutaDelGiorno } from '../core/settings.js';
import { totali } from '../core/nutrition.js';
import { slug } from '../core/migrate.js';

/* =====================================================================
   Letture
   ===================================================================== */

export const esercizi = () => S.lista('esercizio');

export function sessioni() {
  return [...S.lista('sessione')].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}
export const sessioneAttiva = () => sessioni().find(s => !s.fine) || null;
export const sessioniDelGiorno = giorno => sessioni().filter(s => s.fine && isoDay(new Date(s.data)) === giorno);

export function settimana(giorno = isoDay()) {
  return settimanaProgramma(S.impostazioni().inizioProgramma, giorno);
}

/** Seduta prevista per un giorno (codice) o null se riposo. */
export function sedutaPrevista(giorno = isoDay()) {
  return sedutaDelGiorno(S.impostazioni(), weekdayIt(parseDay(giorno)));
}

export function cibiDelGiorno(giorno) {
  return S.lista('cibo').filter(c => c.giorno === giorno).sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));
}
export const totaliGiorno = giorno => totali(cibiDelGiorno(giorno));

export function giorno(g) {
  return { acquaMl: 0, creatina: false, nota: '', ...(S.leggi('giorno', g) || {}), id: g };
}

export function pesi() {
  return S.lista('peso').map(p => ({ giorno: p.giorno || p.id, kg: +p.kg })).filter(p => p.kg > 0)
    .sort((a, b) => a.giorno.localeCompare(b.giorno));
}
export const pesoAttuale = () => pesi().at(-1) || null;

export const diario = () => [...S.lista('diario')].sort((a, b) => (b.giorno || '').localeCompare(a.giorno || ''));
export const foto = () => [...S.lista('foto')].sort((a, b) => (a.giorno || '').localeCompare(b.giorno || '') || (a.id || '').localeCompare(b.id || ''));
export const preferiti = () => [...S.lista('preferito')].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

/** Cibi usati di recente (unici per nome), dal più recente. */
export function recenti(max = 25) {
  const visti = new Set(), out = [];
  const tutti = [...S.lista('cibo')].sort((a, b) => (b.ora || b.giorno || '').localeCompare(a.ora || a.giorno || ''));
  for (const c of tutti) {
    const k = (c.nome || '').toLowerCase();
    if (!k || visti.has(k)) continue;
    visti.add(k);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/* =====================================================================
   Allenamento
   ===================================================================== */

/** Recupero da usare per il timer: media dell'intervallo, arrotondata a 15 s. */
export const recuperoSecondi = v => Math.round(((+v.recMin || 90) + (+v.recMax || +v.recMin || 90)) / 2 / 15) * 15;

function creaVoce(r, sedute, scarico, pers) {
  const eq = attrezzoDi(r.ex, pers);
  const sug = suggerisci(r, storico(sedute, r.ex), eq, scarico);
  return {
    ex: r.ex, eq, gruppo: gruppoDi(r.ex, pers),
    serie: r.serie, min: r.min, max: r.max, recMin: r.recMin, recMax: r.recMax,
    ss: r.ss ?? null, drop: !!r.drop,
    pulita: true, nota: '',
    sugKg: sug.kg, sugReps: sug.reps, msg: sug.msg, tipo: sug.tipo,
    sets: sug.reps.map(() => ({ kg: null, reps: null, fatto: false })),
  };
}

/** Inizia un allenamento. Restituisce l'id. */
export function avviaAllenamento(codice) {
  const att = sessioneAttiva();
  if (att) return att.id;
  const imp = S.impostazioni();
  const sc = imp.schede[codice];
  if (!sc) return null;
  const w = settimana();
  const sedute = sessioni();
  const pers = esercizi();
  const id = uuid();
  S.salva('sessione', id, {
    data: new Date().toISOString(), fine: null, codice, nome: sc.nome, tono: sc.tono,
    settimana: w.n, ciclo: w.ciclo, scarico: w.scarico,
    voci: sc.righe.map(r => creaVoce(r, sedute, w.scarico, pers)),
  });
  return id;
}

const modSessione = (id, fn) => S.modifica('sessione', id, s => { fn(s); return s; });

/** Valore mostrato in una serie: quello scritto o il suggerimento. */
export function valoriSerie(v, i) {
  const x = v.sets[i] || {};
  const sugReps = v.sugReps?.[i] ?? v.sugReps?.at?.(-1) ?? v.min;
  return {
    kg: x.kg ?? v.sugKg ?? null,
    reps: x.reps ?? sugReps ?? null,
    kgSuggerito: x.kg == null,
    repsSuggerito: x.reps == null,
  };
}

export function aggiornaSerie(id, vi, si, patch) {
  modSessione(id, s => { Object.assign(s.voci[vi].sets[si], patch); });
}

/**
 * Spunta (o toglie la spunta) a una serie. Se i campi sono vuoti usa i valori suggeriti.
 * @returns {{fatto:boolean, recupero:number|null, prossimo:string|null, serveKg:boolean}}
 */
export function spuntaSerie(id, vi, si) {
  const s = S.leggi('sessione', id);
  const v = s?.voci[vi];
  if (!v) return { fatto: false, recupero: null, prossimo: null, serveKg: false };
  const x = v.sets[si];
  if (x.fatto) {
    aggiornaSerie(id, vi, si, { fatto: false });
    return { fatto: false, recupero: null, prossimo: null, serveKg: false };
  }
  const val = valoriSerie(v, si);
  if (val.kg == null && v.eq !== 'cl') return { fatto: false, recupero: null, prossimo: null, serveKg: true };
  aggiornaSerie(id, vi, si, { kg: val.kg ?? 0, reps: val.reps ?? v.min, fatto: true });

  // Superserie: si passa subito all'esercizio collegato, il recupero arriva a fine coppia.
  const succ = s.voci[vi + 1];
  if (v.ss != null && succ && succ.ss === v.ss) {
    return { fatto: true, recupero: null, prossimo: succ.ex, serveKg: false };
  }
  const dopo = s.voci[vi];
  const restanti = dopo.sets.some((y, j) => j !== si && !y.fatto);
  let prossimo = null;
  if (v.ss != null && s.voci[vi - 1]?.ss === v.ss && restanti) prossimo = s.voci[vi - 1].ex;
  else if (restanti) prossimo = v.ex;
  else prossimo = s.voci.slice(vi + 1).find(w => w.sets.some(y => !y.fatto))?.ex || null;
  return { fatto: true, recupero: recuperoSecondi(v), prossimo, serveKg: false };
}

export function aggiungiSerie(id, vi) {
  modSessione(id, s => { s.voci[vi].sets.push({ kg: null, reps: null, fatto: false }); });
}
export function rimuoviSerie(id, vi) {
  modSessione(id, s => {
    const sets = s.voci[vi].sets;
    if (sets.length > 1) sets.pop();
  });
}
export function impostaNota(id, vi, nota) { modSessione(id, s => { s.voci[vi].nota = nota; }); }
export function impostaPulita(id, vi, pulita) { modSessione(id, s => { s.voci[vi].pulita = pulita; }); }

/** Sostituisce un esercizio (attrezzo occupato) mantenendo serie, ripetizioni e recupero. */
export function sostituisciEsercizio(id, vi, nome, ancheScheda = false) {
  const s0 = S.leggi('sessione', id);
  const vecchio = s0?.voci[vi]?.ex;
  if (!vecchio) return;
  const pers = esercizi();
  const sedute = sessioni();
  modSessione(id, s => {
    const v = s.voci[vi];
    const eq = attrezzoDi(nome, pers);
    const sug = suggerisci({ serie: v.sets.length, min: v.min, max: v.max }, storico(sedute, nome), eq, s.scarico);
    Object.assign(v, { ex: nome, eq, gruppo: gruppoDi(nome, pers), sugKg: sug.kg, sugReps: sug.reps, msg: sug.msg, tipo: sug.tipo });
    v.sets = v.sets.map(x => (x.fatto ? x : { kg: null, reps: null, fatto: false }));
  });
  if (ancheScheda && s0.codice) {
    S.salvaImpostazioni(imp => {
      const r = imp.schede[s0.codice]?.righe.find(r => r.ex === vecchio);
      if (r) r.ex = nome;
      return imp;
    });
  }
}

/** Crea un esercizio personalizzato. */
export function creaEsercizio(nome, gruppo, eq) {
  const n = nome.trim();
  if (!n) return null;
  if (trovaEsercizio(n, esercizi())) return n;
  S.salva('esercizio', 'ex-' + slug(n), { nome: n, gruppo, eq });
  return n;
}

/** Fine allenamento: toglie le serie non fatte. Restituisce il riepilogo, o null se non c'era niente. */
export function terminaAllenamento(id) {
  const s = S.leggi('sessione', id);
  if (!s) return null;
  const fatte = s.voci.some(v => v.sets.some(x => x.fatto));
  if (!fatte) { S.elimina('sessione', id); return null; }
  const fine = new Date().toISOString();
  const finita = modSessione(id, x => {
    x.fine = fine;
    for (const v of x.voci) v.sets = v.sets.filter(y => y.fatto);
  });
  return riepilogo(finita);
}

export function annullaAllenamento(id) { S.elimina('sessione', id); }

/** Riepilogo di un allenamento finito: statistiche, record e cosa fare la prossima volta. */
export function riepilogo(s) {
  const sedute = sessioni();
  const imp = S.impostazioni();
  const sc = imp.schede[s.codice];
  const pers = esercizi();
  const prossima = (sc?.righe || s.voci).map(r => {
    const eq = attrezzoDi(r.ex, pers);
    const sug = suggerisci({ serie: r.serie, min: r.min, max: r.max }, storico(sedute, r.ex), eq, false);
    return { ex: r.ex, kg: sug.kg, reps: sug.reps, tipo: sug.tipo, msg: sug.msg, eq };
  });
  return { sessione: s, stat: statistiche(s), record: recordBattuti(sedute, s), prossima };
}

/* =====================================================================
   Cibo, acqua, creatina
   ===================================================================== */

export function aggiungiCibo(giornoIso, pasto, item) {
  const id = uuid();
  S.salva('cibo', id, {
    giorno: giornoIso, pasto,
    nome: item.nome || 'Alimento', descrizione: item.descrizione || '',
    kcal: Math.round(+item.kcal || 0), prot: r1(item.prot), carb: r1(item.carb), grassi: r1(item.grassi),
    quantita: item.quantita ?? null, unita: item.unita || null,
    per100: item.per100 || null, porzioni: +item.porzioni > 0 ? +item.porzioni : null, base: item.base || null,
    fonte: item.fonte || 'manuale', rif: item.rif || null, barcode: item.barcode || null,
    foto: item.foto || null, ora: new Date().toISOString(),
  });
  return id;
}
const r1 = v => Math.round((+v || 0) * 10) / 10;

export function modificaCibo(id, patch) { S.modifica('cibo', id, c => ({ ...c, ...patch })); }
export function eliminaCibo(id) { S.elimina('cibo', id); }

/** Copia un pasto da un altro giorno. Restituisce quanti cibi ha copiato. */
export function copiaPasto(daGiorno, aGiorno, pasto) {
  const lista = cibiDelGiorno(daGiorno).filter(c => c.pasto === pasto);
  for (const c of lista) {
    const { id, ora, giorno: _g, ...resto } = c;
    aggiungiCibo(aGiorno, pasto, resto);
  }
  return lista.length;
}
export const pastoDiIeri = (oggiIso, pasto) => cibiDelGiorno(addDaysIso(oggiIso, -1)).filter(c => c.pasto === pasto);

export const chiavePreferito = item => 'fav-' + slug(item.rif || item.barcode || item.nome || 'x');
export const ePreferito = item => !!S.leggi('preferito', chiavePreferito(item));
export function preferito(item, si) {
  const id = chiavePreferito(item);
  if (!si) return S.elimina('preferito', id);
  const { id: _id, giorno: _g, ora: _o, pasto: _p, ...dati } = item;
  S.salva('preferito', id, dati);
}

export function impostaAcqua(g, ml) {
  S.modifica('giorno', g, d => ({ ...d, acquaMl: Math.max(0, Math.min(8000, Math.round(ml))) }), giorno(g));
}
export const aggiungiAcqua = (g, delta) => impostaAcqua(g, giorno(g).acquaMl + delta);
export function impostaCreatina(g, si) { S.modifica('giorno', g, d => ({ ...d, creatina: !!si }), giorno(g)); }
export function impostaNotaGiorno(g, nota) { S.modifica('giorno', g, d => ({ ...d, nota }), giorno(g)); }

/* =====================================================================
   Peso, diario, foto
   ===================================================================== */

export function registraPeso(g, kg) {
  if (!(kg > 20 && kg < 250)) return false;
  S.salva('peso', g, { giorno: g, kg: Math.round(kg * 10) / 10 });
  return true;
}
export function eliminaPeso(g) { S.elimina('peso', g); }

export function salvaDiario(id, dati) { S.salva('diario', id || uuid(), dati); }
export function eliminaDiario(id) { S.elimina('diario', id); }

/** Ridimensiona un'immagine e restituisce un Blob JPEG. */
export function ridimensiona(file, lato, qualita = 0.85) {
  return new Promise((ok, ko) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, lato / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? ok({ blob: b, w, h }) : ko(new Error('Immagine non valida'))), 'image/jpeg', qualita);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Immagine non valida')); };
    img.src = url;
  });
}

export const blobInDataUrl = blob => new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });

/** Aggiunge una foto di progresso (resta sul telefono e, se c'è l'account, va nello spazio privato online). */
export async function aggiungiFoto(file, g = isoDay()) {
  const id = uuid();
  const grande = await ridimensiona(file, 1600, 0.85);
  const mini = await ridimensiona(file, 420, 0.8);
  await S.salvaBlob(`foto/${id}`, grande.blob);
  await S.salvaBlob(`foto/${id}_t`, mini.blob);
  S.salva('foto', id, { giorno: g, w: grande.w, h: grande.h, nota: '' });
  return id;
}
export async function eliminaFoto(id) {
  S.elimina('foto', id);
  await S.eliminaBlob(`foto/${id}`);
  await S.eliminaBlob(`foto/${id}_t`);
}
