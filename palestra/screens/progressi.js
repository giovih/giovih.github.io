// Scheda "Progressi": quattro sezioni (Corpo, Allenamenti, Agenda, Diario) sotto un controllo a segmenti.

import { html, useState, useEffect } from '../lib/preact.js';
import { Page, Segmented } from '../ui/kit.js';
import { pref, setPref } from './comuni.js';
import { Corpo, apriPesa } from './pr-corpo.js';
import { Allenamenti } from './pr-allenamenti.js';
import { Agenda } from './pr-agenda.js';
import { Diario, apriVoce } from './pr-diario.js';

const VISTE = [
  { value: 'corpo', label: 'Corpo' },
  { value: 'allenamenti', label: 'Allenamenti' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'diario', label: 'Diario' },
];

export function Progressi({ hidden, vai }) {
  const [vista, setVistaStato] = useState(() => {
    const v = pref('vistaProgressi', 'corpo');
    return VISTE.some(x => x.value === v) ? v : 'corpo';
  });
  const setVista = v => {
    setVistaStato(v);
    setPref('vistaProgressi', v);
    document.getElementById('pagina-progressi')?.scrollTo({ top: 0 });
  };

  // da Oggi si arriva direttamente a una sezione (es. "pesa" apre il foglio del peso)
  useEffect(() => {
    const f = e => {
      const { scheda, sotto } = e.detail || {};
      if (scheda !== 'progressi' || !sotto) return;
      if (sotto === 'pesa') { setVista('corpo'); setTimeout(() => apriPesa(), 280); return; }
      if (sotto === 'compila-diario') { setVista('diario'); setTimeout(() => apriVoce(null), 280); return; }
      if (VISTE.some(x => x.value === sotto)) setVista(sotto);
    };
    addEventListener('vai-sotto', f);
    return () => removeEventListener('vai-sotto', f);
  }, []);

  return html`<${Page} id="progressi" hidden=${hidden} title="Progressi">
    <div class="pr-seg"><${Segmented} options=${VISTE} value=${vista} onChange=${setVista} label="Sezione dei progressi" /></div>
    <div class="pr-vista" key=${vista}>
      ${vista === 'corpo' && html`<${Corpo} vai=${vai} />`}
      ${vista === 'allenamenti' && html`<${Allenamenti} vai=${vai} />`}
      ${vista === 'agenda' && html`<${Agenda} vai=${vai} />`}
      ${vista === 'diario' && html`<${Diario} vai=${vai} />`}
    </div>
  <//>`;
}
