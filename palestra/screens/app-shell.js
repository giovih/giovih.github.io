// Struttura dell'app: le 5 schede, l'allenamento a tutto schermo e i livelli (fogli, menu, avvisi).

import { html, useState, useEffect, useCallback } from '../lib/preact.js';
import * as S from '../data/store.js';
import { sessioneAttiva } from '../data/actions.js';
import { Icon } from '../ui/icons.js';
import { Livelli } from '../ui/overlay.js';
import { aptico, sbloccaAudio } from '../ui/haptics.js';
import { applicaTema } from './comuni.js';
import { Oggi } from './oggi.js';
import { Cibo } from './cibo.js';
import { Progressi } from './progressi.js';
import { Coach } from './coach.js';
import { Altro } from './altro.js';
import { Allenamento } from './allenamento.js';

const SCHEDE = [
  { id: 'oggi', nome: 'Oggi', icona: 'house', iconaOn: 'houseFill' },
  { id: 'cibo', nome: 'Cibo', icona: 'forkKnife', iconaOn: 'forkKnifeFill' },
  { id: 'progressi', nome: 'Progressi', icona: 'chart', iconaOn: 'chartFill' },
  { id: 'coach', nome: 'Coach', icona: 'sparkles', iconaOn: 'sparklesFill' },
  { id: 'altro', nome: 'Altro', icona: 'gear', iconaOn: 'gearFill' },
];

function schedaDaHash() {
  const h = (location.hash || '').replace('#', '').split('/')[0];
  return SCHEDE.some(s => s.id === h) ? h : null;
}

function TabBar({ attiva, onScegli }) {
  return html`<nav class="tabbar" role="tablist" aria-label="Sezioni">
    ${SCHEDE.map(s => html`<button type="button" role="tab" aria-selected=${s.id === attiva ? 'true' : 'false'}
      onClick=${() => onScegli(s.id)}>
      <${Icon} name=${s.id === attiva ? s.iconaOn : s.icona} size=${26} />
      <span>${s.nome}</span>
    </button>`)}
  </nav>`;
}

export function AppShell() {
  const [, setVer] = useState(0);
  useEffect(() => S.ascolta(setVer), []);

  const [scheda, setScheda] = useState(() => schedaDaHash() || 'oggi');
  const [allenamento, setAllenamento] = useState(() => (location.hash.startsWith('#allenamento') && !!sessioneAttiva()));
  // ogni scheda ricorda la sua posizione di scorrimento
  const [scroll] = useState(() => ({}));

  const imp = S.impostazioni();
  useEffect(() => applicaTema(imp.tema), [imp.tema]);
  useEffect(() => {
    if (imp.tema !== 'auto') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const f = () => applicaTema('auto');
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, [imp.tema]);

  const vai = useCallback((id, opz = {}) => {
    if (id === 'allenamento') { setAllenamento(true); return; }
    const p = document.getElementById('pagina-' + scheda);
    if (p) scroll[scheda] = p.scrollTop;
    setScheda(id);
    if (opz.sotto) window.dispatchEvent(new CustomEvent('vai-sotto', { detail: { scheda: id, sotto: opz.sotto } }));
    history.replaceState(null, '', '#' + id);
  }, [scheda]);

  // ripristino lo scorrimento della scheda
  useEffect(() => {
    const p = document.getElementById('pagina-' + scheda);
    if (p) p.scrollTop = scroll[scheda] || 0;
  }, [scheda]);

  // toccare di nuovo la scheda attiva torna in cima
  const scegli = id => {
    aptico();
    if (id === scheda) {
      const p = document.getElementById('pagina-' + id);
      p?.scrollTo({ top: 0, behavior: 'smooth' });
      window.dispatchEvent(new CustomEvent('torna-radice', { detail: id }));
      return;
    }
    vai(id);
  };

  // tocco su una notifica → apro la sezione giusta
  useEffect(() => {
    const apri = url => {
      const h = new URL(url, location.href).hash.replace('#', '');
      if (h === 'allenamento' && sessioneAttiva()) setAllenamento(true);
      else if (SCHEDE.some(s => s.id === h)) setScheda(h);
    };
    const m = e => { if (e.data?.tipo === 'apri') apri(e.data.url); };
    navigator.serviceWorker?.addEventListener('message', m);
    const hc = () => apri(location.href);
    addEventListener('hashchange', hc);
    return () => { navigator.serviceWorker?.removeEventListener('message', m); removeEventListener('hashchange', hc); };
  }, []);

  // il primo tocco sblocca l'audio del timer
  useEffect(() => {
    const f = () => sbloccaAudio();
    addEventListener('pointerdown', f, { passive: true });
    return () => removeEventListener('pointerdown', f);
  }, []);

  const att = sessioneAttiva();

  return html`<div class="app">
    <${Oggi} hidden=${scheda !== 'oggi'} vai=${vai} />
    <${Cibo} hidden=${scheda !== 'cibo'} vai=${vai} />
    <${Progressi} hidden=${scheda !== 'progressi'} vai=${vai} />
    <${Coach} hidden=${scheda !== 'coach'} vai=${vai} />
    <${Altro} hidden=${scheda !== 'altro'} vai=${vai} />
    <${TabBar} attiva=${scheda} onScegli=${scegli} />
    <${Allenamento} aperto=${allenamento} sessione=${att} onChiudi=${() => setAllenamento(false)} vai=${vai} />
    <${Livelli} />
  </div>`;
}
