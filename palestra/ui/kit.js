// Componenti riutilizzabili del design system.

import { html, useState, useEffect, useRef, useLayoutEffect } from '../lib/preact.js';
import { Icon } from './icons.js';
import { aptico } from './haptics.js';

const cx = (...c) => c.filter(Boolean).join(' ');

/** Titolo grande in stile iOS, con didascalia sopra e azioni a destra. */
export function LargeTitle({ caption, title, actions }) {
  return html`<header class="large-title">
    <div class="lt-text">
      ${caption && html`<div class="lt-caption">${caption}</div>`}
      <h1>${title}</h1>
    </div>
    ${actions && html`<div class="lt-actions">${actions}</div>`}
  </header>`;
}

/** Pagina di una scheda: titolo grande che diventa barra compatta scorrendo. */
export function Page({ id, hidden, title, caption, actions, compactRight, children }) {
  const ref = useRef(null);
  const [compatta, setCompatta] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => setCompatta(el.scrollTop > 44);
    el.addEventListener('scroll', f, { passive: true });
    return () => el.removeEventListener('scroll', f);
  }, []);
  return html`
    <main ref=${ref} class="page" id=${'pagina-' + id} hidden=${hidden} aria-hidden=${hidden ? 'true' : null}>
      <div class="page-inner">
        <${LargeTitle} caption=${caption} title=${title} actions=${actions} />
        ${children}
      </div>
    </main>
    ${!hidden && html`<div class=${cx('nav-compact', compatta && 'on')} aria-hidden="true">
      ${title}
      ${compactRight && html`<div class="nc-right">${compactRight}</div>`}
    </div>`}`;
}

/** Barra con "indietro" per le pagine interne. */
export function NavBar({ title, back = 'Indietro', onBack, right }) {
  return html`<div class="nav-bar">
    <button class="back-btn" onClick=${onBack} aria-label=${'Torna a ' + back}><${Icon} name="chevronLeft" />${back}</button>
    <div class="nb-title ellipsis">${title}</div>
    <span class="spacer"></span>
    ${right}
  </div>`;
}

export function Card({ children, class: cls, onClick, tono, label, style }) {
  const tag = onClick ? 'button' : 'div';
  return html`<${tag} class=${cx('card', onClick && 'tappable', tono && 'tono-' + tono, cls)} style=${style}
    onClick=${onClick} aria-label=${label} type=${onClick ? 'button' : null}>${children}</${tag}>`;
}

export function Section({ title, action, onAction, children, class: cls }) {
  return html`<section class=${cls}>
    <div class="section-title"><h2>${title}</h2>${action && html`<button class="st-action" onClick=${onAction}>${action}</button>`}</div>
    ${children}
  </section>`;
}

/** Bottone. kind: primary | secondary | tinted | plain | danger. */
export function Button({ kind = 'primary', small, block, icon, children, onClick, disabled, label, class: cls, type = 'button' }) {
  return html`<button type=${type} class=${cx('btn', 'btn-' + kind, small && 'btn-small', block && 'btn-block', cls)}
    disabled=${disabled} aria-label=${label} onClick=${e => { aptico(); onClick?.(e); }}>
    ${icon && html`<${Icon} name=${icon} />`}${children}
  </button>`;
}
export const PrimaryButton = p => Button({ ...p, kind: 'primary' });

export function IconButton({ icon, onClick, label, class: cls, size = 20, style }) {
  return html`<button type="button" class=${cx('icon-btn', cls)} style=${style} onClick=${e => { aptico(); onClick?.(e); }} aria-label=${label}>
    <${Icon} name=${icon} size=${size} />
  </button>`;
}

export function Chip({ icon, children, kind, tono }) {
  return html`<span class=${cx('chip', kind, tono && 'tono tono-' + tono)}>${icon && html`<${Icon} name=${icon} size=${14} />`}${children}</span>`;
}

/** Statistica: etichetta piccola, valore grande con unità. */
export function StatTile({ label, icon, value, unit, foot, small, color, class: cls }) {
  return html`<div class=${cx('stat', small && 'small', cls)}>
    <div class="stat-label" style=${color ? `color:${color}` : null}>${icon && html`<${Icon} name=${icon} size=${14} />`}${label}</div>
    <div class="stat-value">${value}${unit && html`<small>${unit}</small>`}</div>
    ${foot && html`<div class="stat-foot">${foot}</div>`}
  </div>`;
}

/** Anello di avanzamento (0-1). */
export function ProgressRing({ value = 0, size = 64, stroke = 8, color = 'var(--accent)', children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  // l'anello parte vuoto e si riempie con una molla
  const [mostrato, setMostrato] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setMostrato(v)); return () => cancelAnimationFrame(t); }, [v]);
  return html`<div class="ring" style=${`width:${size}px;height:${size}px`} role="img" aria-label=${label}>
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
      <circle class="ring-track" cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke-width=${stroke} />
      <circle class="ring-value" cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${color} stroke-width=${stroke}
        stroke-linecap="round" stroke-dasharray=${c} stroke-dashoffset=${c * (1 - mostrato)}
        style=${mostrato <= 0.001 ? 'opacity:0' : null} />
    </svg>
    ${children && html`<div class="ring-center">${children}</div>`}
  </div>`;
}

export function Bar({ value = 0, color, label }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return html`<div class="bar" role="progressbar" aria-label=${label} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(v * 100)}>
    <i style=${`width:${v * 100}%;${color ? `--c:${color}` : ''}`}></i>
  </div>`;
}

/** Controllo a segmenti in stile iOS. */
export function Segmented({ options, value, onChange, label }) {
  const i = Math.max(0, options.findIndex(o => o.value === value));
  const n = options.length;
  return html`<div class="segmented" role="group" aria-label=${label}>
    <span class="seg-ind" style=${`width:calc((100% - 4px) / ${n});transform:translateX(${i * 100}%)`}></span>
    ${options.map(o => html`<button type="button" aria-pressed=${o.value === value ? 'true' : 'false'}
      onClick=${() => { if (o.value !== value) { aptico(); onChange(o.value); } }}>${o.label}</button>`)}
  </div>`;
}

/** Interruttore iOS. */
export function Toggle({ checked, onChange, label, small }) {
  return html`<span class=${cx('toggle', small && 'small')}>
    <input type="checkbox" role="switch" checked=${!!checked} aria-label=${label}
      onChange=${e => { aptico(); onChange(e.currentTarget.checked); }} />
    <span class="tg-track"></span><span class="tg-knob"></span>
  </span>`;
}

/** Riga di una lista (stile Impostazioni). */
export function ListRow({ icon, tile, title, sub, detail, chevron, onClick, right, danger, label, class: cls }) {
  const tag = onClick ? 'button' : 'div';
  return html`<${tag} type=${onClick ? 'button' : null} class=${cx('row', icon && 'has-icon', cls)}
    onClick=${onClick ? e => { aptico(); onClick(e); } : null} aria-label=${label}>
    ${icon && html`<span class="row-icon" style=${tile ? `--tile:${tile}` : null}><${Icon} name=${icon} /></span>`}
    <span class="row-main">
      <span class="row-title" style=${danger ? 'color:var(--danger)' : null}>${title}</span>
      ${sub && html`<span class="row-sub">${sub}</span>`}
    </span>
    ${detail != null && detail !== '' && html`<span class="row-detail ellipsis">${detail}</span>`}
    ${right}
    ${chevron && html`<${Icon} name="chevronRight" class="chev" size=${14} />`}
  </${tag}>`;
}

export function List({ children, class: cls }) {
  return html`<div class=${cx('list', cls)}>${children}</div>`;
}

export function SectionLabel({ children }) { return html`<div class="section-label">${children}</div>`; }
export function SectionFoot({ children }) { return html`<div class="section-foot">${children}</div>`; }

/** Stato vuoto: mai un messaggio di errore, sempre una frase chiara e un'azione. */
export function EmptyState({ icon = 'sparkles', title, text, action, onAction, actionIcon }) {
  return html`<div class="empty">
    <div class="em-icon"><${Icon} name=${icon} /></div>
    <h3>${title}</h3>
    ${text && html`<p>${text}</p>`}
    ${action && html`<${Button} kind="tinted" small icon=${actionIcon} onClick=${onAction}>${action}<//>`}
  </div>`;
}

export function Callout({ icon = 'info', title, text, tono, kind, onClick, right }) {
  const tag = onClick ? 'button' : 'div';
  return html`<${tag} type=${onClick ? 'button' : null} class=${cx('callout', tono && 'tono tono-' + tono, kind)} onClick=${onClick}
    style=${onClick ? 'width:100%;text-align:left' : null}>
    <span class="co-icon"><${Icon} name=${icon} /></span>
    <span class="grow">
      ${title && html`<div class="co-title">${title}</div>`}
      ${text && html`<div class="co-text">${text}</div>`}
    </span>
    ${right}
  </${tag}>`;
}

/** Stepper − / +. */
export function Stepper({ onMinus, onPlus, label }) {
  return html`<span class="stepper" role="group" aria-label=${label}>
    <button type="button" onClick=${() => { aptico(); onMinus(); }} aria-label="Meno"><${Icon} name="minus" size=${16} /></button>
    <span class="divider"></span>
    <button type="button" onClick=${() => { aptico(); onPlus(); }} aria-label="Più"><${Icon} name="plus" size=${16} /></button>
  </span>`;
}

/** Campo orario (HH:MM). */
export function TimeInput({ value, onChange, label }) {
  return html`<input class="time-input" type="time" value=${value} aria-label=${label}
    onChange=${e => e.currentTarget.value && onChange(e.currentTarget.value)} />`;
}

/** Numero che cambia con un piccolo effetto. */
export function AnimatedNumber({ value, format = v => v }) {
  const [k, setK] = useState(0);
  const prev = useRef(value);
  useLayoutEffect(() => { if (prev.current !== value) { prev.current = value; setK(x => x + 1); } }, [value]);
  return html`<span key=${k} class=${k ? 'pop' : ''} style="display:inline-block">${format(value)}</span>`;
}
