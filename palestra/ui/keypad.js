// Tastierino numerico grande, pensato per l'uso con una mano in palestra.
// Sostituisce la tastiera di iOS per kg e ripetizioni: tasti grandi, − / + e "Avanti".

import { html, useState, useEffect } from '../lib/preact.js';
import { Icon } from './icons.js';
import { aptico } from './haptics.js';
import { fmtNum } from '../core/format.js';

let stato = null; // { chiave, titolo, testo, decimali, passo, nuovo, onCambia, onAvanti, onChiudi, etichettaAvanti }
const ascoltatori = new Set();
const avvisa = () => { for (const f of ascoltatori) f(stato); };

const daNumero = v => (v == null || v === '' ? '' : fmtNum(v).replace(/\./g, ''));
const inNumero = t => {
  if (t === '' || t === ',') return null;
  const n = parseFloat(t.replace(',', '.'));
  return isFinite(n) ? n : null;
};

/**
 * Apre il tastierino su un campo.
 * opz: { chiave, titolo, valore, decimali, passo, onCambia(n|null), onAvanti(), onChiudi(), etichettaAvanti }
 */
export function apriTastierino(opz) {
  stato = { ...opz, testo: daNumero(opz.valore), nuovo: true };
  avvisa();
}
export function chiudiTastierino() {
  const s = stato;
  stato = null;
  avvisa();
  s?.onChiudi?.();
}
export const campoAttivo = () => stato?.chiave || null;
export const ascoltaTastierino = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };

function scrivi(testo) {
  if (!stato) return;
  stato = { ...stato, testo, nuovo: false };
  avvisa();
  stato.onCambia?.(inNumero(testo));
}

function tasto(k) {
  if (!stato) return;
  aptico();
  let t = stato.nuovo ? '' : stato.testo;
  if (k === 'del') t = t.slice(0, -1);
  else if (k === ',') { if (!stato.decimali || t.includes(',')) return; t = (t || '0') + ','; }
  else {
    if (t === '0') t = '';
    const [, dec] = t.split(',');
    if (dec != null && dec.length >= 2) return;
    if (t.replace(',', '').length >= 5) return;
    t += k;
  }
  scrivi(t);
}

function passo(segno) {
  if (!stato) return;
  aptico();
  const n = inNumero(stato.nuovo ? stato.testo : stato.testo) ?? 0;
  const v = Math.max(0, Math.round((n + segno * (stato.passo || 1)) * 100) / 100);
  scrivi(daNumero(v));
}

/** Testo da mostrare nel campo mentre si scrive. */
export function testoCampo(chiave) {
  return stato && stato.chiave === chiave ? stato.testo : null;
}

/** Il tastierino: va messo una volta nella schermata dell'allenamento. */
export function Tastierino() {
  const [s, setS] = useState(stato);
  useEffect(() => ascoltaTastierino(setS), []);
  const aperto = !!s;
  const k = (t, label) => html`<button type="button" class="kp-key" onClick=${() => tasto(t)} aria-label=${label || t}>${t === 'del' ? html`<${Icon} name="backspace" />` : t}</button>`;
  return html`<div class=${'keypad' + (aperto ? ' on' : '')} aria-hidden=${aperto ? null : 'true'} role="group" aria-label="Tastierino numerico">
    <div class="kp-top">
      <div class="kp-title">${s?.titolo || ''}</div>
      <button type="button" class="btn btn-plain strong" onClick=${chiudiTastierino}>Fine</button>
    </div>
    <div class="kp-grid">
      ${k('1')}${k('2')}${k('3')}
      <button type="button" class="kp-key fn" onClick=${() => passo(-1)} aria-label=${'Meno ' + (s?.passo || 1)}>−${fmtNum(s?.passo || 1)}</button>
      ${k('4')}${k('5')}${k('6')}
      <button type="button" class="kp-key fn" onClick=${() => passo(1)} aria-label=${'Più ' + (s?.passo || 1)}>+${fmtNum(s?.passo || 1)}</button>
      ${k('7')}${k('8')}${k('9')}
      <button type="button" class="kp-key next" onClick=${() => { aptico(); const f = s?.onAvanti; if (f) f(); else chiudiTastierino(); }}>
        ${s?.etichettaAvanti || 'Avanti'}
      </button>
      ${s?.decimali ? k(',', 'virgola') : html`<span></span>`}${k('0')}${k('del', 'Cancella')}
    </div>
  </div>`;
}
