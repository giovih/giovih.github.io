// Altro → Salvataggio online → Prepara il server: i passaggi per creare il progetto Supabase dal telefono,
// con i pulsanti per copiare il codice del database e delle due funzioni (niente file da cercare su GitHub).

import { html, useState, useEffect } from '../lib/preact.js';
import { List, ListRow, SectionLabel, SectionFoot } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';

const GITHUB = 'https://github.com/giovih/giovih.github.io/blob/main/';
const FILE = {
  sql: 'supabase/setup.sql',
  ai: 'supabase/functions/ai/index.ts',
  push: 'supabase/functions/push/index.ts',
};

/** Scarica i file dal sito appena si apre la pagina: su iPhone la copia deve partire subito dal tocco. */
function useFile(percorso) {
  const [testo, setTesto] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch(new URL('../' + percorso, location.href), { cache: 'no-store' })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(t => vivo && setTesto(t), () => vivo && setTesto(false));
    return () => { vivo = false; };
  }, [percorso]);
  return testo;
}

async function copia(testo, cosa) {
  try {
    await navigator.clipboard.writeText(testo);
    aptico('successo');
    toast(`${cosa} copiato`, 'checkCircle');
  } catch {
    toast('Non riesco a copiare: tieni premuto e scegli Copia', 'info');
  }
}

function RigaCopia({ titolo, testo, file, cosa }) {
  if (testo === false && file) {
    return html`<a class="row" href=${GITHUB + file} target="_blank" rel="noopener">
      <span class="row-main"><span class="row-title">${titolo}</span><span class="row-sub">Senza rete: aprilo su GitHub e copialo da lì</span></span>
      <${Icon} name="arrowUpRight" size=${17} class="accent" />
    </a>`;
  }
  const pronto = typeof testo === 'string';
  return html`<${ListRow} title=${titolo} sub=${pronto ? (file ? `${Math.round(testo.length / 1000)} mila caratteri` : testo) : 'Carico…'}
    label=${'Copia: ' + titolo} onClick=${pronto ? () => copia(testo, cosa) : null}
    right=${html`<${Icon} name="copy" size=${19} class=${pronto ? 'accent' : 'tertiary'} />`} />`;
}

const Passi = ({ passi }) => html`<ol class="passi">${passi.map(p => html`<li>${p}</li>`)}</ol>`;

export function PaginaPrepara() {
  const sql = useFile(FILE.sql);
  const ai = useFile(FILE.ai);
  const push = useFile(FILE.push);
  const sito = new URL('./', location.href).href;

  return html`
    <div class="card info-testa">
      <span class="at-icona"><${Icon} name="cloud" size=${28} /></span>
      <p class="t-sub secondary center">Si fa una volta sola, in circa 20 minuti. Serve per il salvataggio online, le notifiche ad app chiusa e l'AI.
        Va benissimo farlo insieme a un genitore.</p>
    </div>

    <${SectionLabel}>1. Crea il progetto<//>
    <div class="card"><${Passi} passi=${[
      'Vai su supabase.com, premi Start your project e accedi con GitHub.',
      'New project: nome palestra, premi Generate per la password del database e salvala. Regione Central EU (Frankfurt), piano Free.',
      'Premi Create new project e aspetta un paio di minuti.',
    ]} /><//>

    <${SectionLabel}>2. Prepara il database<//>
    <${List}><${RigaCopia} titolo="Copia il codice del database" testo=${sql} file=${FILE.sql} cosa="Codice del database" /><//>
    <div class="card mt-12"><${Passi} passi=${[
      'Su Supabase apri SQL Editor, poi New query.',
      'Incolla tutto e premi Run. Deve finire senza errori rossi. Si può rifare quando vuoi: non cancella niente.',
    ]} /><//>

    <${SectionLabel}>3. Crea le due funzioni del server<//>
    <${List}>
      <${RigaCopia} titolo="Copia la funzione ai" testo=${ai} file=${FILE.ai} cosa="Funzione ai" />
      <${RigaCopia} titolo="Copia la funzione push" testo=${push} file=${FILE.push} cosa="Funzione push" />
    <//>
    <div class="card mt-12"><${Passi} passi=${[
      'Apri Edge Functions, poi Deploy a new function, poi Via Editor.',
      'Nome ai: cancella il codice di esempio, incolla la funzione ai e premi Deploy function.',
      'Rifai lo stesso con il nome push e la funzione push.',
      'Per tutte e due: apri la funzione, Details, spegni Enforce JWT verification e salva. Le funzioni controllano già da sole chi le chiama.',
    ]} /><//>

    <${SectionLabel}>4. La chiave dell'AI, solo sul server<//>
    <div class="card"><${Passi} passi=${[
      'Serve un account su console.anthropic.com: le regole chiedono un adulto, quindi lo crea un genitore. Lì: API Keys, Create Key, e un po\' di credito in Billing.',
      'Su Supabase: Edge Functions, Secrets, Add new secret. Nome ANTHROPIC_API_KEY, valore la chiave (inizia con sk-ant-).',
    ]} /><//>
    <${SectionFoot}>La chiave non va mai scritta nell'app né su GitHub: la usa solo la funzione ai. Al massimo 80 richieste al giorno.<//>

    <${SectionLabel}>5. Indirizzo dell'app<//>
    <${List}>
      <${RigaCopia} titolo="Site URL" testo=${sito} cosa="Indirizzo" />
      <${RigaCopia} titolo="Redirect URL" testo=${sito + '**'} cosa="Indirizzo" />
    <//>
    <${SectionFoot}>Su Supabase apri Authentication, URL Configuration: incolla il primo in Site URL e salva, poi aggiungi il secondo con Add URL.<//>

    <${SectionLabel}>6. Collega l'app<//>
    <div class="card"><${Passi} passi=${[
      'Su Supabase apri Project Settings, API Keys: copia Project URL e la chiave Publishable (nei progetti vecchi si chiama anon public).',
      'Torna indietro, incolla indirizzo e chiave e premi Salva. Poi Crea account con email e password.',
      'Apri il link dell\'email di conferma, torna nell\'app e premi Accedi.',
      'Alla fine, su Supabase: Authentication, Sign In / Providers, spegni Allow new users to sign up. Così nessun altro può creare account.',
    ]} /><//>
    <${SectionFoot}>Il piano gratuito mette in pausa il progetto dopo circa una settimana senza uso: entra su supabase.com e premi Restore project.
      Nel frattempo l'app funziona lo stesso e sincronizza dopo.<//>`;
}
