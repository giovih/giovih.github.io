// Progressi → Agenda: il mese a colpo d'occhio.
// In ogni giorno: due anelli (calorie fuori, proteine dentro), la lettera della seduta fatta,
// il peso se ti sei pesato e un puntino se c'è una nota. Tocco un giorno e sotto vedo il dettaglio.

import { html, useState, useRef, useEffect } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import { IconButton, Button } from '../ui/kit.js';
import { AnelliGiorno } from '../ui/charts.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { useOggi, coloreTono } from './comuni.js';
import { apriPesa } from './pr-corpo.js';
import { apriSeduta } from './pr-allenamenti.js';
import { datiAgenda, riassuntoMese, grigliaMese } from '../core/stats.js';
import { fmtKg1, fmtInt, fmtDelta, fmtMinutes, fmtLitri, plural } from '../core/format.js';
import { parseDay, formatDayLong, cap, MESI, GIORNI_INIZIALI, daysBetween } from '../core/dates.js';

const lettera = s => s.codice || (s.nome || '?')[0].toUpperCase();

export function Agenda({ vai }) {
  const oggi = useOggi();
  const [mese, setMese] = useState(() => { const d = parseDay(oggi); return { a: d.getFullYear(), m: d.getMonth() }; });
  const [scelto, setScelto] = useState(oggi);
  const imp = S.impostazioni();
  const o = imp.obiettivi;

  const celle = grigliaMese(mese.a, mese.m);
  const giorni = celle.filter(Boolean);
  const agenda = datiAgenda({
    giorni, sessioni: A.sessioni(), pesi: A.pesi(), cibi: S.lista('cibo'), giorniRec: S.lista('giorno'), imp, oggi,
  });
  const r = riassuntoMese(agenda);
  const dOggi = parseDay(oggi);
  const eQuesto = mese.a === dOggi.getFullYear() && mese.m === dOggi.getMonth();
  const maxAvanti = (mese.a - dOggi.getFullYear()) * 12 + mese.m - dOggi.getMonth() >= 2;

  const cambia = n => {
    aptico();
    setMese(x => {
      const d = new Date(x.a, x.m + n, 1);
      const nuovo = { a: d.getFullYear(), m: d.getMonth() };
      const qui = nuovo.a === dOggi.getFullYear() && nuovo.m === dOggi.getMonth();
      setScelto(qui ? oggi : `${nuovo.a}-${String(nuovo.m + 1).padStart(2, '0')}-01`);
      return nuovo;
    });
  };
  const tornaOggi = () => { aptico(); setMese({ a: dOggi.getFullYear(), m: dOggi.getMonth() }); setScelto(oggi); };

  // scorrere a destra o sinistra sulla griglia cambia mese
  const swipe = useRef(null);
  const giu = e => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const su = e => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      if (dx < 0 && !maxAvanti) cambia(1);
      else if (dx > 0) cambia(-1);
    }
  };

  const dScelto = agenda.get(scelto);

  return html`
    <div class="card agenda">
      <div class="ag-testa">
        <div class="t-title3 grow">${cap(MESI[mese.m])} ${mese.a}</div>
        ${!eQuesto && html`<button type="button" class="btn btn-plain btn-small" onClick=${tornaOggi}>Oggi</button>`}
        <${IconButton} icon="chevronLeft" label="Mese precedente" onClick=${() => cambia(-1)} />
        <${IconButton} icon="chevronRight" label="Mese successivo" onClick=${() => cambia(1)}
          style=${maxAvanti ? 'opacity:.3;pointer-events:none' : null} />
      </div>
      <div class="ag-riassunto t-foot secondary num">${[
        plural(r.allenamenti, 'allenamento', 'allenamenti'),
        r.pesate ? plural(r.pesate, 'pesata', 'pesate') : null,
        r.giorniCibo ? `${fmtInt(r.kcalMedia)} kcal al giorno` : null,
      ].filter(Boolean).join(' · ')}</div>
      <div class="ag-griglia" role="grid" aria-label=${`${cap(MESI[mese.m])} ${mese.a}`}
        onPointerDown=${giu} onPointerUp=${su} onPointerCancel=${() => { swipe.current = null; }}>
        ${GIORNI_INIZIALI.slice(1).map((g, i) => html`<span class="ag-sett" aria-hidden="true" key=${'s' + i}>${g}</span>`)}
        ${celle.map((g, i) => g
          ? html`<${Cella} key=${g} d=${agenda.get(g)} oggi=${oggi} o=${o} scelto=${g === scelto}
              onScegli=${() => { aptico('leggero'); setScelto(g); }} />`
          : html`<span class="ag-cella vuota" key=${'v' + i}></span>`)}
      </div>
      <div class="ag-legenda" aria-hidden="true">
        <span><${AnelliGiorno} kcal=${0.75} prot=${0.6} size=${16} /> Calorie e proteine</span>
        <span><i class="ag-pill" style="--tono:var(--accent)">A</i> Seduta</span>
        <span><b class="num">54,7</b> Peso</span>
        <span><i class="ag-punto"></i> Nota</span>
      </div>
    </div>
    ${dScelto && html`<${Dettaglio} d=${dScelto} oggi=${oggi} o=${o} imp=${imp} vai=${vai} />`}`;
}

function Cella({ d, oggi, o, scelto, onScegli }) {
  const g = d.giorno;
  const n = parseDay(g).getDate();
  const fatta = d.sedute[0]?.s;
  const kcal = o.kcalMin ? d.kcal / o.kcalMin : 0;
  const prot = o.proteine ? d.prot / o.proteine : 0;
  // la seduta in programma si vede solo da oggi in avanti (nel passato conta solo quella fatta)
  const prevista = !fatta && (d.futuro || g === oggi) ? d.prevista : null;
  const descr = [
    cap(formatDayLong(parseDay(g))),
    fatta ? `${fatta.nome} fatta` : d.allenato ? 'allenamento fatto' : prevista ? `${prevista} in programma` : null,
    d.peso != null ? `peso ${fmtKg1(d.peso)} chili` : null,
    d.nCibi ? `${d.kcal} calorie, ${d.prot} grammi di proteine` : null,
    d.nota ? 'con una nota' : null,
  ].filter(Boolean).join(', ');
  return html`<button type="button" role="gridcell" aria-selected=${scelto ? 'true' : 'false'} aria-label=${descr}
    class=${'ag-cella' + (scelto ? ' scelta' : '') + (g === oggi ? ' oggi' : '') + (d.futuro ? ' futura' : '')} onClick=${onScegli}>
    <${AnelliGiorno} kcal=${kcal} prot=${prot} size=${32} traccia=${d.nCibi > 0}><span class="ag-n">${n}</span><//>
    <span class="ag-sotto">
      ${fatta ? html`<i class="ag-pill" style=${`--tono:${coloreTono(fatta.tono)}`}>${lettera(fatta)}${d.sedute.length > 1 ? '+' : ''}</i>`
        : d.allenato ? html`<i class="ag-pill segnato"><${Icon} name="checkBold" size=${9} /></i>`
        : prevista ? html`<i class="ag-pill prevista">${prevista}</i>` : null}
    </span>
    <span class="ag-peso num">${d.peso != null ? fmtKg1(d.peso) : ''}</span>
    ${d.nota && html`<i class="ag-punto"></i>`}
  </button>`;
}

/* ---------- dettaglio del giorno ---------- */

function Riga({ icona, tinta, titolo, sotto, destra, onClick, label }) {
  const tag = onClick ? 'button' : 'div';
  return html`<${tag} type=${onClick ? 'button' : null} class="row has-icon" aria-label=${label}
    onClick=${onClick ? () => { aptico(); onClick(); } : null}>
    <span class="row-icon tinta" style=${`--tile:${tinta}`}><${Icon} name=${icona} /></span>
    <span class="row-main">
      <span class="row-title">${titolo}</span>
      ${sotto && html`<span class="row-sub">${sotto}</span>`}
    </span>
    ${destra && html`<span class="row-detail num">${destra}</span>`}
    ${onClick && html`<${Icon} name="chevronRight" class="chev" size=${14} />`}
  </${tag}>`;
}

function Dettaglio({ d, oggi, o, imp, vai }) {
  const g = d.giorno;
  const diff = daysBetween(oggi, g);
  const titolo = diff === 0 ? 'Oggi' : diff === -1 ? 'Ieri' : diff === 1 ? 'Domani' : cap(formatDayLong(parseDay(g)));
  const passato = !d.futuro;
  const nomePrevista = d.prevista ? imp.schede[d.prevista]?.nome || d.prevista : null;
  const righe = [];

  // allenamento
  for (const { s, stat } of d.sedute) {
    righe.push(html`<${Riga} icona="dumbbell" tinta=${coloreTono(s.tono)} titolo=${s.nome}
      sotto=${`${fmtMinutes(stat.durata)} · ${plural(stat.serie, 'serie', 'serie')} · ${fmtInt(stat.volume)} kg`}
      onClick=${() => apriSeduta(s.id)} />`);
  }
  if (!d.sedute.length && d.allenato) {
    righe.push(html`<${Riga} icona="dumbbell" tinta="var(--accent)" titolo="Allenamento fatto"
      sotto="Segnato a mano. Tocca per toglierlo" onClick=${() => A.segnaAllenamento(g, false)} />`);
  } else if (!d.sedute.length) {
    if (passato && diff !== 0) {
      righe.push(html`<${Riga} icona="plus" tinta="var(--accent)" titolo="Segna come allenamento fatto"
        sotto="Per gli allenamenti che non hai registrato nell'app" onClick=${() => A.segnaAllenamento(g, true)} />`);
    }
    if (nomePrevista) {
      righe.push(html`<${Riga} icona="dumbbell" tinta="var(--label-3)" titolo=${nomePrevista}
        sotto=${d.futuro ? 'In programma' : diff === 0 ? 'In programma oggi' : 'Non fatta'}
        onClick=${diff === 0 ? () => vai('oggi') : null} />`);
    } else {
      righe.push(html`<${Riga} icona="moonZ" tinta="var(--label-3)" titolo="Riposo" sotto="Nessuna seduta in programma" />`);
    }
  }

  if (passato) {
    // peso
    righe.push(d.peso != null
      ? html`<${Riga} icona="scale" tinta="var(--accent)" titolo=${`${fmtKg1(d.peso)} kg`}
          sotto=${d.pesoPrima != null ? `${fmtDelta(d.peso - d.pesoPrima)} kg dalla pesata prima` : 'Prima pesata'}
          onClick=${() => apriPesa(g)} />`
      : html`<${Riga} icona="scale" tinta="var(--label-3)" titolo="Nessuna pesata" sotto="Tocca per aggiungerla" onClick=${() => apriPesa(g)} />`);
    // cibo
    righe.push(d.nCibi
      ? html`<${Riga} icona="forkKnife" tinta="var(--accent)" titolo=${`${fmtInt(d.kcal)} kcal · ${fmtInt(d.prot)} g proteine`}
          sotto=${`Obiettivo ${fmtInt(o.kcalMin)} kcal e ${o.proteine} g di proteine`}
          onClick=${() => vai('cibo', { sotto: g })} />`
      : html`<${Riga} icona="forkKnife" tinta="var(--label-3)" titolo="Niente registrato" sotto="Tocca per aprire il cibo di quel giorno"
          onClick=${() => vai('cibo', { sotto: g })} />`);
    // acqua e creatina
    if (d.acquaMl || d.creatina) {
      righe.push(html`<${Riga} icona="dropFill" tinta="var(--acqua)"
        titolo=${[d.acquaMl ? `${fmtLitri(d.acquaMl)} d'acqua` : null, d.creatina ? 'creatina presa' : null].filter(Boolean).join(' · ')} />`);
    }
  }
  // nota
  righe.push(d.nota
    ? html`<${Riga} icona="note" tinta="var(--tono-sabbia)" titolo="Nota" sotto=${d.nota} onClick=${() => apriNotaGiorno(g)} />`
    : html`<${Riga} icona="note" tinta="var(--label-3)" titolo="Aggiungi una nota" sotto="Come ti sei sentito, sonno, scuola…" onClick=${() => apriNotaGiorno(g)} />`);

  return html`
    <div class="section-title"><h2>${titolo}</h2>${Math.abs(diff) <= 1 && html`<span class="t-foot secondary">${cap(formatDayLong(parseDay(g)))}</span>`}</div>
    <div class="list ag-dettaglio">${righe}</div>`;
}

/* ---------- nota del giorno ---------- */

export function apriNotaGiorno(g) {
  apriFoglio(chiudi => html`<${NotaGiorno} g=${g} chiudi=${chiudi} />`, { titolo: cap(formatDayLong(parseDay(g))) });
}

function NotaGiorno({ g, chiudi }) {
  const [testo, setTesto] = useState(() => A.giorno(g).nota || '');
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 350); }, []);
  const salva = () => {
    A.impostaNotaGiorno(g, testo.trim());
    aptico('successo');
    toast(testo.trim() ? 'Nota salvata' : 'Nota eliminata', 'note');
    chiudi();
  };
  return html`<div>
    <textarea ref=${ref} class="field" rows="5" maxlength="1000" placeholder="Come ti sei sentito, quanto hai dormito, cosa è cambiato…"
      value=${testo} onInput=${e => setTesto(e.currentTarget.value)} aria-label="Nota del giorno"></textarea>
    <div class="mt-16"><${Button} block onClick=${salva}>Salva<//></div>
  </div>`;
}
