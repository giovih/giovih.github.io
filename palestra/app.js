// Avvio dell'app.

import { html, render } from './lib/preact.js';
import * as S from './data/store.js';
import * as C from './data/cloud.js';
import { AppShell } from './screens/app-shell.js';
import { applicaTema } from './screens/comuni.js';

async function avvia() {
  try {
    await S.avvia();
  } catch (e) {
    console.error(e);
  }
  applicaTema(S.impostazioni().tema);
  // link di conferma dell'email: l'app si apre già collegata (in Altro)
  try { C.leggiTokenDaIndirizzo(); } catch (e) { console.error(e); }
  render(html`<${AppShell} />`, document.getElementById('app'));
  requestAnimationFrame(() => document.getElementById('avvio')?.remove());
  registraServiceWorker();
  // niente zoom con due dita (Safari a volte ignora user-scalable=no)
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  // per i test automatici: ?debug espone archivio, azioni e cloud
  if (location.search.includes('debug')) {
    Promise.all([import('./data/actions.js'), import('./data/sync.js'), import('./data/push.js')])
      .then(([A, SY, P]) => { window.__p = { S, A, C, SY, P }; });
  }
  import('./data/sync.js').then(m => m.avviaSync()).catch(e => console.error(e));
  import('./data/push.js').then(P => avviaNotifiche(P)).catch(e => console.error(e));
}

/** Notifiche: timer di recupero sul server e promemoria aggiornati quando cambiano dati o impostazioni. */
function avviaNotifiche(P) {
  P.collegaRecupero();
  S.ascolta(() => P.programmaPromemoria());
  // quando colleghi l'account (o rientri) e le notifiche sono già permesse, iscrivo questo telefono
  let eraCollegato = false;
  const iscrivi = () => {
    const ora = C.collegato();
    if (ora && !eraCollegato && P.permesso() === 'granted') P.iscrivi().then(() => P.programmaPromemoria(true)).catch(e => console.warn('push', e));
    eraCollegato = ora;
  };
  C.ascolta(iscrivi);
  iscrivi();
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
