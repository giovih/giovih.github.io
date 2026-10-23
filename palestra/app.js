// Avvio dell'app.

import { html, render } from './lib/preact.js';
import * as S from './data/store.js';
import { AppShell } from './screens/app-shell.js';
import { applicaTema } from './screens/comuni.js';

async function avvia() {
  try {
    await S.avvia();
  } catch (e) {
    console.error(e);
  }
  applicaTema(S.impostazioni().tema);
  render(html`<${AppShell} />`, document.getElementById('app'));
  requestAnimationFrame(() => document.getElementById('avvio')?.remove());
  registraServiceWorker();
  // per i test automatici: ?debug espone archivio e azioni
  if (location.search.includes('debug')) {
    import('./data/actions.js').then(A => { window.__p = { S, A }; });
  }
  import('./data/sync.js').then(m => m.avviaSync()).catch(e => console.error(e));
}

function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker', e));
  // Nuova versione installata: ricarico solo se non c'è un allenamento in corso.
  let ricaricato = false;
  const avevaVersione = !!navigator.serviceWorker.controller; // al primo avvio non serve ricaricare
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (ricaricato || !avevaVersione) return;
    const inCorso = S.lista('sessione').some(s => !s.fine);
    if (!inCorso) { ricaricato = true; location.reload(); }
  });
}

avvia();
