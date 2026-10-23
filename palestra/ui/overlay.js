// Fogli (sheet), menu e messaggi brevi (toast) sopra l'interfaccia.

import { html, useEffect, useRef, useState } from '../lib/preact.js';
import { Icon } from './icons.js';
import { aptico } from './haptics.js';

let livelli = [];          // { id, tipo: 'sheet'|'menu', render, opz, stato: 'apre'|'aperto'|'chiude' }
let ascoltatori = new Set();
let contatore = 0;
const aggiorna = () => { for (const f of ascoltatori) f([...livelli]); };

/**
 * Apre un foglio dal basso. render(chiudi) restituisce il contenuto.
 * opz: { titolo, sinistra, destra, piede, alto (tutto schermo), chiudibile }
 * Restituisce la funzione per chiuderlo.
 */
export function apriFoglio(render, opz = {}) {
  const id = ++contatore;
  livelli.push({ id, tipo: 'sheet', render, opz, stato: 'apre' });
  aggiorna();
  return () => chiudi(id);
}

/** Menu contestuale vicino a un elemento. voci: [{ label, icona, azione, pericolo }] */
export function apriMenu(ancora, voci) {
  const id = ++contatore;
  const r = ancora?.getBoundingClientRect?.() || { left: innerWidth - 16, right: innerWidth - 16, top: 80, bottom: 80 };
  livelli.push({ id, tipo: 'menu', voci, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, stato: 'apre' });
  aggiorna();
  return () => chiudi(id);
}

export function chiudi(id) {
  const l = livelli.find(x => x.id === id);
  if (!l || l.stato === 'chiude') return;
  l.stato = 'chiude';
  aggiorna();
  setTimeout(() => { livelli = livelli.filter(x => x.id !== id); aggiorna(); }, 420);
}

export function chiudiTutto() { for (const l of livelli) chiudi(l.id); }
export const ciSonoFogli = () => livelli.some(l => l.stato !== 'chiude');

/* ---------- toast ---------- */

let toastStato = null;
let toastAscolt = new Set();
let toastTimer = null;
export function toast(testo, icona = 'checkCircle') {
  toastStato = { testo, icona, k: Date.now() };
  for (const f of toastAscolt) f(toastStato);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastStato = null; for (const f of toastAscolt) f(null); }, 2400);
}

function Toast() {
  const [t, setT] = useState(null);
  const [ultimo, setUltimo] = useState(null);
  useEffect(() => { const f = x => { setT(x); if (x) setUltimo(x); }; toastAscolt.add(f); return () => toastAscolt.delete(f); }, []);
  const v = t || ultimo;
  return html`<div class=${'toast' + (t ? ' on' : '')} role="status" aria-live="polite">
    ${v && html`<${Icon} name=${v.icona === 'checkCircle' ? 'check' : v.icona} size=${18} /> <span>${v.testo}</span>`}
  </div>`;
}

/* ---------- foglio ---------- */

function Foglio({ l }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  const drag = useRef(null);
  const chiudiQui = () => chiudi(l.id);

  useEffect(() => { const t = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => { if (l.stato === 'chiude') setOn(false); }, [l.stato]);
  // chiusura con il tasto Esc (tastiera esterna)
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && livelli.at(-1)?.id === l.id) chiudiQui(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  // trascina verso il basso per chiudere
  const giu = e => {
    if (l.opz.chiudibile === false) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    ref.current.classList.add('dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const muovi = e => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    ref.current.style.transform = `translateY(${d.dy}px)`;
  };
  const su = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    ref.current.classList.remove('dragging');
    ref.current.style.transform = '';
    const v = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > 140 || (d.dy > 40 && v > 0.6)) chiudiQui();
  };

  const o = l.opz;
  return html`
    <div class=${'scrim' + (on ? ' on' : '')} onClick=${() => o.chiudibile !== false && chiudiQui()}></div>
    <section ref=${ref} class=${'sheet' + (on ? ' on' : '') + (o.alto ? ' full' : '')} role="dialog" aria-modal="true" aria-label=${o.titolo || 'Finestra'}>
      <div onPointerDown=${giu} onPointerMove=${muovi} onPointerUp=${su} onPointerCancel=${su} style="touch-action:none">
        <div class="grabber"></div>
        ${(o.titolo || o.sinistra || o.destra !== null) && html`<div class="sheet-head">
          ${o.sinistra ? o.sinistra(chiudiQui) : null}
          ${o.titolo && html`<div class="sh-title ellipsis">${o.titolo}</div>`}
          <span class="spacer"></span>
          ${o.destra === undefined
            ? html`<button class="icon-btn" style="color:var(--label-2)" onClick=${chiudiQui} aria-label="Chiudi"><${Icon} name="xmark" size=${18} strokeWidth=${2.2} /></button>`
            : o.destra && o.destra(chiudiQui)}
        </div>`}
      </div>
      <div class="sheet-body">${l.render(chiudiQui)}</div>
      ${o.piede && html`<div class="sheet-foot">${o.piede(chiudiQui)}</div>`}
    </section>`;
}

/* ---------- menu ---------- */

function Menu({ l }) {
  const [on, setOn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); }, []);
  useEffect(() => { if (l.stato === 'chiude') setOn(false); }, [l.stato]);
  const W = 260;
  const r = l.rect;
  const sotto = r.bottom + 8 + l.voci.length * 46 < innerHeight - 40;
  const left = Math.max(12, Math.min(innerWidth - W - 12, r.right - W));
  const style = `width:${W}px;left:${left}px;` + (sotto ? `top:${r.bottom + 6}px;` : `bottom:${innerHeight - r.top + 6}px;`)
    + `transform-origin:${r.right - left - 10}px ${sotto ? 'top' : 'bottom'};`;
  return html`
    <div class="menu-layer" onClick=${() => chiudi(l.id)}></div>
    <div class=${'menu' + (on ? ' on' : '')} style=${style} role="menu">
      ${l.voci.map(v => v === '-' ? html`<div class="menu-sep"></div>` : html`
        <button role="menuitem" class=${v.pericolo ? 'danger' : ''} onClick=${() => { aptico(); chiudi(l.id); setTimeout(() => v.azione?.(), 10); }}>
          <span>${v.label}</span>${v.icona && html`<${Icon} name=${v.icona} size=${19} />`}
        </button>`)}
    </div>`;
}

/** Radice dei livelli: va messa una volta nell'app. */
export function Livelli() {
  const [ls, setLs] = useState(livelli);
  useEffect(() => { ascoltatori.add(setLs); return () => ascoltatori.delete(setLs); }, []);
  return html`${ls.map(l => l.tipo === 'sheet' ? html`<${Foglio} key=${l.id} l=${l} />` : html`<${Menu} key=${l.id} l=${l} />`)}<${Toast} />`;
}
