// Promemoria programmati: allenamento, pasti, pesata, creatina, acqua.
// Il telefono calcola gli orari dei prossimi giorni; il server (Supabase) li invia come notifiche push.
// Testi brevi e senza emoji.

import { isoDay, addDays, atTime, weekdayIt, timeToMinutes, minutesToTime, GIORNI } from './dates.js';
import { oraPalestra, sedutaDelGiorno } from './settings.js';
import { fmtLitri } from './format.js';

const MIN = 60000;

/** Testo "tra 1 ora" / "tra 45 minuti". */
function tra(min) {
  if (min % 60 === 0) return min === 60 ? 'tra un\'ora' : `tra ${min / 60} ore`;
  return `tra ${min} minuti`;
}

/**
 * Calcola i promemoria dei prossimi giorni.
 * @param {object} imp impostazioni normalizzate
 * @param {{ora?: Date, giorni?: number, fatti?: {creatina?: Record<string,boolean>, acquaMl?: Record<string,number>, allenamento?: Record<string,boolean>}}} opz
 * @returns {{tag:string, tipo:'promemoria', categoria:string, invio:string, scade:string, titolo:string, testo:string, url:string}[]}
 */
export function calcolaPromemoria(imp, opz = {}) {
  const ora = opz.ora || new Date();
  const giorni = opz.giorni ?? 14;
  const fatti = opz.fatti || {};
  const n = imp?.notifiche || {};
  const out = [];
  const acquaObiettivo = imp?.obiettivi?.acquaMl || 2500;

  const add = (categoria, tag, quando, titolo, testo, url = './') => {
    if (!(quando instanceof Date) || isNaN(quando) || quando <= ora) return;
    out.push({
      tag, tipo: 'promemoria', categoria,
      invio: quando.toISOString(),
      scade: new Date(quando.getTime() + 30 * MIN).toISOString(),
      titolo, testo, url,
    });
  };

  for (let i = 0; i < giorni; i++) {
    const d = addDays(new Date(ora.getFullYear(), ora.getMonth(), ora.getDate()), i);
    const giorno = isoDay(d);
    const gs = weekdayIt(d);
    const cod = sedutaDelGiorno(imp, gs);
    const scheda = cod ? imp.schede?.[cod] : null;
    const palestra = oraPalestra(imp, gs);
    const allenato = !!fatti.allenamento?.[giorno];

    // Allenamento: nei giorni di palestra, di default un'ora prima.
    if (n.allenamento?.on && scheda && !allenato) {
      const anticipo = Math.max(5, +n.allenamento.anticipo || 60);
      add('allenamento', `allenamento:${giorno}`, atTime(giorno, minutesToTime(timeToMinutes(palestra) - anticipo)),
        `Allenamento ${tra(anticipo)}`, `Oggi alle ${palestra}: ${scheda.nome}, ${scheda.sotto.toLowerCase()}.`, './#oggi');
    }

    // Pasti.
    const pasti = [
      ['colazione', 'Colazione', 'È ora di fare colazione.'],
      ['spuntino', 'Spuntino a scuola', 'Non saltare lo spuntino.'],
      ['pranzo', scheda ? 'Pranzo pre-allenamento' : 'Pranzo', scheda ? `Mangia ora: alle ${palestra} hai ${scheda.nome}.` : 'È ora di pranzo.'],
      ['merenda', scheda ? 'Merenda post-allenamento' : 'Merenda', scheda ? 'Appena torni a casa: proteine e carboidrati.' : 'È ora della merenda.'],
      ['cena', 'Cena', 'È ora di cena.'],
      ['notte', 'Prima di dormire', 'Uno spuntino prima di andare a letto.'],
    ];
    for (const [k, titolo, testo] of pasti) {
      const cfg = n[k];
      if (!cfg?.on) continue;
      let orario = cfg.ora;
      if (k === 'pranzo' && cfg.auto && scheda) orario = minutesToTime(timeToMinutes(palestra) - (+cfg.anticipo || 90));
      if (k === 'merenda' && cfg.auto && scheda) orario = minutesToTime(timeToMinutes(palestra) + (+cfg.dopo || 105));
      add('pasti', `pasto-${k}:${giorno}`, atTime(giorno, orario), titolo, testo, './#cibo');
    }

    // Creatina: tutti i giorni, anche di riposo, se non l'hai già segnata.
    if (n.creatina?.on && !fatti.creatina?.[giorno]) {
      add('creatina', `creatina:${giorno}`, atTime(giorno, n.creatina.ora || '07:30'),
        'Creatina', '5 g di creatina, anche nei giorni di riposo.', './#oggi');
    }

    // Acqua: solo se non hai già raggiunto l'obiettivo.
    if (n.acqua?.on && (fatti.acquaMl?.[giorno] || 0) < acquaObiettivo) {
      (n.acqua.ore || []).forEach((o, j) => add('acqua', `acqua:${giorno}:${j}`, atTime(giorno, o),
        'Acqua', `Bevi un bicchiere d'acqua. Obiettivo: ${fmtLitri(acquaObiettivo)} al giorno.`, './#oggi'));
    }

    // Pesata settimanale.
    if (n.pesata?.on && gs === (+n.pesata.giorno || 1)) {
      add('pesata', `pesata:${giorno}`, atTime(giorno, n.pesata.ora || '07:00'),
        'Pesata settimanale', 'Pesati a digiuno, dopo il bagno, e segna il peso.', './#progressi');
    }
  }
  return out.sort((a, b) => a.invio.localeCompare(b.invio));
}

/** Notifica di fine recupero. */
export function notificaRecupero(fine, prossimo) {
  const t = fine instanceof Date ? fine : new Date(fine);
  return {
    tag: 'recupero', tipo: 'recupero', categoria: 'recupero',
    invio: t.toISOString(),
    scade: new Date(t.getTime() + 2 * MIN).toISOString(),
    titolo: 'Recupero finito',
    testo: prossimo ? `Prossima serie: ${prossimo}.` : 'Via con la prossima serie.',
    url: './#allenamento',
  };
}

/** Descrizione breve di un promemoria per le impostazioni ("Lunedì alle 07:00"). */
export const descriviGiornoOra = (giornoSett, ora) => `${GIORNI[giornoSett][0].toUpperCase()}${GIORNI[giornoSett].slice(1)} alle ${ora}`;
