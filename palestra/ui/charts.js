// Grafici del design system.
// - GraficoTempo: linea nel tempo (peso, forza) con fascia obiettivo, mirino e fumetto al tocco.
// - BarreOrizzontali: valori per categoria (serie per muscolo) con fascia consigliata.
// - AnelliGiorno: due mini anelli (calorie fuori, proteine dentro) per le celle dell'agenda.
//
// Regole seguite: linea da 2 px, punti da 8 px con un anello del colore della card, griglia sottilissima,
// etichetta solo sull'ultimo valore, testi sempre nei colori del testo (mai in quello della serie),
// fumetto anche da tastiera (frecce) e annunciato a VoiceOver. Mai errori: con un valore si vede il punto.

import { html, useState, useRef, useLayoutEffect, useEffect } from '../lib/preact.js';
import { daysBetween, addDaysIso } from '../core/dates.js';
import { scalaY, ticksGiorni } from '../core/stats.js';
import { aptico } from './haptics.js';

let contatoreId = 0;

/** Larghezza del contenitore, aggiornata quando cambia (anche quando la pagina torna visibile). */
function useLarghezza(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => setW(el.clientWidth);
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

const segno = x => (x < 0 ? -1 : 1);

/**
 * Curva morbida che passa per tutti i punti senza "rimbalzi" oltre i valori veri
 * (interpolazione monotona, la stessa di d3.curveMonotoneX).
 * @param {[number, number][]} p punti in pixel, ordinati per x
 */
export function percorsoMonotono(p) {
  const n = p.length;
  if (!n) return '';
  const f = v => Math.round(v * 10) / 10;
  if (n === 1) return `M${f(p[0][0])},${f(p[0][1])}`;
  if (n === 2) return `M${f(p[0][0])},${f(p[0][1])}L${f(p[1][0])},${f(p[1][1])}`;
  const t = new Array(n);
  for (let i = 1; i < n - 1; i++) {
    const h0 = p[i][0] - p[i - 1][0], h1 = p[i + 1][0] - p[i][0];
    const s0 = h0 ? (p[i][1] - p[i - 1][1]) / h0 : 0;
    const s1 = h1 ? (p[i + 1][1] - p[i][1]) / h1 : 0;
    const q = h0 + h1 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    t[i] = (segno(s0) + segno(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(q)) || 0;
  }
  const bordo = (i, j, ti) => {
    const h = p[j][0] - p[i][0];
    return h ? (3 * (p[j][1] - p[i][1]) / h - ti) / 2 : ti;
  };
  t[0] = bordo(0, 1, t[1]);
  t[n - 1] = bordo(n - 2, n - 1, t[n - 2]);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1][0] - p[i][0]) / 3;
    d += `C${f(p[i][0] + dx)},${f(p[i][1] + dx * t[i])} ${f(p[i + 1][0] - dx)},${f(p[i + 1][1] - dx * t[i + 1])} ${f(p[i + 1][0])},${f(p[i + 1][1])}`;
  }
  return d;
}

/** Valore della fascia obiettivo in un giorno (interpolazione lineare dalla partenza). */
function fasciaIn(banda, g) {
  const tot = daysBetween(banda.da.giorno, banda.a.giorno);
  const k = tot > 0 ? Math.max(0, daysBetween(banda.da.giorno, g)) / tot : 1;
  return { min: banda.da.y + (banda.a.min - banda.da.y) * k, max: banda.da.y + (banda.a.max - banda.da.y) * k };
}

/**
 * Linea nel tempo.
 * @param {object} p
 * @param {{giorno:string, y:number, cavo?:boolean}[]} p.punti  dal più vecchio (cavo = punto vuoto, es. scarico)
 * @param {[string, string]} p.dominio  primo e ultimo giorno dell'asse
 * @param {{da:{giorno:string,y:number}, a:{giorno:string,min:number,max:number}}} [p.banda]  fascia obiettivo
 * @param {(y:number)=>string} p.fmtY  numeri dell'asse e dell'ultimo valore
 * @param {(punto, i)=>{valore:string, data:string, righe?:{testo:string, chiave?:string}[]}} p.fumetto
 * @param {string} p.etichetta  descrizione per VoiceOver
 * @param {{tipo:'linea'|'fascia', testo:string}[]} [p.legenda]
 */
export function GraficoTempo({
  punti = [], dominio, banda = null, fmtY = v => String(v), fumetto, etichetta,
  altezza = 196, minSpan = 1, area = false, daZero = false, legenda = null, fondo = 'var(--card)',
  colore = 'var(--accent)', vuoto = 'Ancora nessun dato',
}) {
  const box = useRef(null);
  const tip = useRef(null);
  const W = useLarghezza(box);
  const [sel, setSel] = useState(null);
  const [tipBox, setTipBox] = useState({ w: 140, h: 48 });
  const timer = useRef(0);
  const [id] = useState(() => 'ch' + ++contatoreId);
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    const el = tip.current;
    if (el && (el.offsetWidth !== tipBox.w || el.offsetHeight !== tipBox.h)) setTipBox({ w: el.offsetWidth, h: el.offsetHeight });
  }, [sel, W]);

  // dominio: con un solo giorno allargo di 3 giorni per parte, così il punto sta al centro
  let [g0, g1] = dominio || [punti[0]?.giorno, punti.at(-1)?.giorno];
  if (!g0 || !g1) return html`<div class="chart vuoto" style=${`height:${altezza}px`}><span>${vuoto}</span></div>`;
  if (g1 < g0) [g0, g1] = [g1, g0];
  if (g0 === g1) { g0 = addDaysIso(g0, -3); g1 = addDaysIso(g1, 3); }
  const span = Math.max(1, daysBetween(g0, g1));

  const visibili = punti.filter(q => q.giorno >= g0 && q.giorno <= g1);
  // per la continuità della linea prendo anche il punto subito prima e subito dopo il dominio
  const iPrima = punti.findLastIndex(q => q.giorno < g0);
  const iDopo = punti.findIndex(q => q.giorno > g1);
  const perLinea = [...(iPrima >= 0 ? [punti[iPrima]] : []), ...visibili, ...(iDopo >= 0 ? [punti[iDopo]] : [])];

  // fascia obiettivo dentro il dominio
  let fascia = null;
  if (banda && banda.a.giorno > g0 && banda.da.giorno < g1) {
    const inizio = banda.da.giorno > g0 ? banda.da.giorno : g0;
    const fine = banda.a.giorno < g1 ? banda.a.giorno : g1;
    fascia = { inizio, fine, v0: fasciaIn(banda, inizio), v1: fasciaIn(banda, fine) };
  }

  const valori = visibili.map(q => q.y);
  if (!valori.length && perLinea.length) valori.push(...perLinea.map(q => q.y));
  if (fascia) valori.push(fascia.v0.min, fascia.v0.max, fascia.v1.min, fascia.v1.max);
  const sc = scalaY(valori, { minSpan, maxTicks: 4, daZero });

  const padR = 38, L = 2, T = 12, H = altezza, B = H - 24;
  const R = Math.max(L + 40, W - padR);
  const xDi = g => L + (daysBetween(g0, g) / span) * (R - L);
  const yDi = v => B - ((v - sc.min) / (sc.max - sc.min || 1)) * (B - T);
  const pxLinea = perLinea.map(q => [xDi(q.giorno), yDi(q.y)]);
  const pxVis = visibili.map(q => [xDi(q.giorno), yDi(q.y)]);
  const dLinea = perLinea.length > 1 ? percorsoMonotono(pxLinea) : '';
  // i pallini di ogni valore solo se c'è spazio (almeno 16 px tra un punto e l'altro), sennò solo l'ultimo
  const conPunti = visibili.length <= 1 || (R - L) / visibili.length >= 16;
  const ultimo = visibili.length ? visibili.length - 1 : -1;
  const tickX = ticksGiorni(g0, g1, Math.max(2, Math.min(5, Math.floor((R - L) / 70))));

  // tocco e trascinamento: il mirino va sul punto più vicino
  const scegli = clientX => {
    if (!visibili.length || !box.current) return;
    const x = clientX - box.current.getBoundingClientRect().left;
    let best = 0, dist = Infinity;
    pxVis.forEach((q, i) => { const d = Math.abs(q[0] - x); if (d < dist) { dist = d; best = i; } });
    if (best !== sel) { setSel(best); if (sel != null) aptico('leggero'); }
  };
  const giu = e => { clearTimeout(timer.current); scegli(e.clientX); };
  const muovi = e => { if (e.pointerType === 'mouse' || e.buttons || e.pressure) scegli(e.clientX); };
  const su = e => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSel(null), e.pointerType === 'mouse' ? 0 : 2200);
  };
  const tasto = e => {
    if (!visibili.length) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const i = sel == null ? ultimo : Math.max(0, Math.min(ultimo, sel + (e.key === 'ArrowLeft' ? -1 : 1)));
      setSel(i);
    } else if (e.key === 'Escape') setSel(null);
  };

  const info = sel != null && visibili[sel] ? fumetto?.(visibili[sel], sel) : null;
  const selX = sel != null && pxVis[sel] ? pxVis[sel][0] : 0;
  const selY = sel != null && pxVis[sel] ? pxVis[sel][1] : 0;
  // fumetto sopra il punto scelto; se non c'è spazio, sotto
  const tipLeft = Math.max(0, Math.min(Math.max(0, W - tipBox.w), selX - tipBox.w / 2));
  const tipTop = selY - tipBox.h - 14 >= -6 ? selY - tipBox.h - 14 : selY + 14;

  // fascia: poligono dalla partenza (o dal bordo) alla fine
  const dFascia = fascia
    ? `M${xDi(fascia.inizio)},${yDi(fascia.v0.max)}L${xDi(fascia.fine)},${yDi(fascia.v1.max)}L${xDi(fascia.fine)},${yDi(fascia.v1.min)}L${xDi(fascia.inizio)},${yDi(fascia.v0.min)}Z`
    : '';
  const dArea = area && dLinea && pxLinea.length > 1
    ? `${dLinea}L${pxLinea.at(-1)[0]},${B}L${pxLinea[0][0]},${B}Z` : '';

  // etichetta dell'ultimo valore: sopra il punto (sotto se non c'è spazio).
  // Vicino al bordo destro il testo finisce sul punto e nascondo il numero dell'asse che toccherebbe.
  let ultimoTesto = null;
  if (ultimo >= 0 && sel == null) {
    const [x, y] = pxVis[ultimo];
    const anchor = x > R - 24 ? 'end' : x < L + 24 ? 'start' : 'middle';
    const dx = anchor === 'end' ? 2 : anchor === 'start' ? -2 : 0;
    ultimoTesto = { x: x + dx, y: y - T > 22 ? y - 11 : y + 21, anchor, vicinoAsse: x > R - 48 };
  }
  const tickNascosto = t => !!ultimoTesto?.vicinoAsse && Math.abs(yDi(t) + 4 - ultimoTesto.y) < 14;
  const etichettaUltimo = ultimoTesto && html`<text class="ch-ultimo num" x=${ultimoTesto.x} y=${ultimoTesto.y}
    text-anchor=${ultimoTesto.anchor} style=${`stroke:${fondo}`}>${fmtY(visibili[ultimo].y)}</text>`;

  return html`<div class="chart-wrap">
    <div ref=${box} class=${'chart' + (sel != null ? ' attivo' : '')} style=${`height:${H}px`}
      tabindex="0" role="img" aria-label=${etichetta} onKeyDown=${tasto} onBlur=${() => setSel(null)}>
      ${W > 0 && html`<svg width=${W} height=${H} viewBox=${`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id=${id + '-clip'}><rect x=${L} y=${0} width=${R - L} height=${B + 1} /></clipPath>
          ${area && html`<linearGradient id=${id + '-area'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color=${colore} stop-opacity="0.16" />
            <stop offset="1" stop-color=${colore} stop-opacity="0" />
          </linearGradient>`}
        </defs>
        ${sc.ticks.map(t => {
          const y = Math.round(yDi(t)) + 0.5;
          return html`<line class="ch-griglia" x1=${L} x2=${R} y1=${y} y2=${y} />
            ${!tickNascosto(t) && html`<text class="ch-asse num" x=${R + 6} y=${y + 4}>${fmtY(t)}</text>`}`;
        })}
        ${tickX.map((t, i) => {
          const x = xDi(t.giorno);
          if (x < L - 1 || x > R + 1) return null;
          const anchor = x < L + 18 ? 'start' : x > R - 18 ? 'end' : 'middle';
          return html`<text class="ch-asse" x=${x} y=${B + 17} text-anchor=${anchor} key=${i}>${t.etichetta}</text>`;
        })}
        <g clip-path=${`url(#${id}-clip)`}>
          ${dFascia && html`<path class="ch-fascia" d=${dFascia} />`}
          ${dArea && html`<path d=${dArea} fill=${`url(#${id}-area)`} class="ch-area" />`}
          ${dLinea && html`<path key=${g0 + g1 + perLinea.length} class="ch-linea" d=${dLinea} pathLength="1" style=${`stroke:${colore}`} />`}
        </g>
        ${sel != null && html`<line class="ch-mirino" x1=${selX} x2=${selX} y1=${T - 6} y2=${B} />`}
        ${pxVis.map((q, i) => {
          const scelto = i === sel;
          if (!scelto && !conPunti && i !== ultimo) return null;
          const cavo = visibili[i].cavo;
          return html`<circle class=${'ch-punto' + (scelto ? ' scelto' : '')} cx=${q[0]} cy=${q[1]} r=${scelto ? 5.5 : 4}
            style=${`fill:${cavo ? fondo : colore};stroke:${cavo ? colore : fondo};stroke-width:${cavo ? 2 : scelto ? 2.5 : 2}`} />`;
        })}
        ${etichettaUltimo}
        <rect class="ch-tocco" x="0" y="0" width=${W} height=${H}
          onPointerDown=${giu} onPointerMove=${muovi} onPointerUp=${su} onPointerCancel=${su} onPointerLeave=${su} />
      </svg>`}
      ${info && html`<div ref=${tip} class="ch-fumetto" style=${`left:${tipLeft}px;top:${tipTop}px`}>
        <b class="num">${info.valore}</b>
        <span>${info.data}</span>
        ${(info.righe || []).map(r => html`<span class="ch-riga">${r.chiave && html`<i class=${'ch-chiave ' + r.chiave}></i>`}${r.testo}</span>`)}
      </div>`}
      <div class="sr-only" aria-live="polite">${info ? [info.valore, info.data, ...(info.righe || []).map(r => r.testo)].join(', ') : ''}</div>
    </div>
    ${legenda && legenda.length > 0 && html`<div class="ch-legenda">
      ${legenda.map(l => html`<span><i class=${'ch-chiave ' + l.tipo} style=${l.tipo === 'linea' ? `background:${colore}` : null}></i>${l.testo}</span>`)}
    </div>`}
  </div>`;
}

/**
 * Barre orizzontali: una riga per categoria, valore in fondo alla barra.
 * @param {{chiave:string, etichetta:string, valore:number}[]} righe
 * @param {{min:number, max:number}} [fascia]  intervallo consigliato (velo grigio dietro le barre)
 */
export function BarreOrizzontali({ righe, fascia = null, max, etichetta, fmt = v => String(v) }) {
  const top = Math.max(max || 0, ...righe.map(r => r.valore), fascia ? fascia.max * 1.1 : 0, 1);
  const pc = v => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;
  // la fascia consigliata è un'unica striscia verticale dietro tutte le righe
  return html`<div class="hbars" role="table" aria-label=${etichetta}
    style=${fascia ? `--fa:${fascia.min / top};--fb:${fascia.max / top}` : null}>
    ${fascia && html`<span class="hb-fascia" aria-hidden="true"></span>`}
    ${righe.map(r => html`<div class="hb-row" role="row" key=${r.chiave}>
      <span class="hb-lab ellipsis" role="rowheader">${r.etichetta}</span>
      <span class="hb-track" aria-hidden="true">
        ${r.valore > 0 && html`<i style=${`width:${pc(r.valore)}`}></i>`}
      </span>
      <span class=${'hb-val num' + (r.valore ? '' : ' zero')} role="cell">${fmt(r.valore)}</span>
    </div>`)}
  </div>`;
}

/**
 * Due anelli concentrici piccoli: calorie (fuori) e proteine (dentro), da 0 a 1.
 * Il contenuto (il numero del giorno) va al centro.
 */
export function AnelliGiorno({ kcal = 0, prot = 0, size = 30, traccia = true, children }) {
  const s1 = 3, s2 = 3, gap = 1;
  const r1 = (size - s1) / 2, r2 = r1 - s1 / 2 - gap - s2 / 2;
  const c = size / 2;
  const arco = (r, v, cls, w) => v > 0.001 && html`<circle class=${cls} cx=${c} cy=${c} r=${r} fill="none" stroke-width=${w}
    pathLength="100" stroke-dasharray=${`${Math.min(1, v) * 100} 100`} stroke-linecap="round" transform=${`rotate(-90 ${c} ${c})`} />`;
  return html`<span class="anelli-giorno" style=${`width:${size}px;height:${size}px`}>
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`} aria-hidden="true">
      ${traccia && html`<circle class="ag-traccia" cx=${c} cy=${c} r=${r1} fill="none" stroke-width=${s1} />
        <circle class="ag-traccia" cx=${c} cy=${c} r=${r2} fill="none" stroke-width=${s2} />`}
      ${arco(r1, kcal, 'ag-kcal', s1)}
      ${arco(r2, prot, 'ag-prot', s2)}
    </svg>
    <span class="ag-centro">${children}</span>
  </span>`;
}
