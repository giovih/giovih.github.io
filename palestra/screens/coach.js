// Scheda "Coach": spunti automatici della settimana (sempre, anche senza account) e chat con l'AI
// che conosce i tuoi dati. La chiave dell'AI resta sul server (funzione Supabase "ai"), mai sul telefono.

import { html, useState, useEffect, useRef } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import * as C from '../data/cloud.js';
import { chiediCoach } from '../data/ai.js';
import { Page, IconButton, Button } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, apriMenu } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { useOggi, useTastiera } from './comuni.js';
import { riassuntoDati, spunti, DOMANDE } from '../core/coach.js';

const MAX_MESSAGGI = 60;

/** Tutti i dati che servono al Coach, presi dall'archivio. */
function datiCoach(oggi) {
  return {
    oggi,
    imp: S.impostazioni(),
    sessioni: A.sessioni(),
    cibi: S.lista('cibo'),
    giorni: S.lista('giorno'),
    pesi: A.pesi(),
    diario: A.diario(),
    esercizi: A.esercizi(),
  };
}

const leggiChat = () => S.leggi('coach', 'chat')?.messaggi || [];
const salvaChat = messaggi => S.salva('coach', 'chat', { messaggi: messaggi.slice(-MAX_MESSAGGI) });

export function Coach({ hidden, vai }) {
  const oggi = useOggi();
  const [cloud, setCloud] = useState(C.stato());
  useEffect(() => C.ascolta(setCloud), []);
  const messaggi = leggiChat();
  const [testo, setTesto] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState(null);
  const kb = useTastiera();
  const fine = useRef(null);
  const campo = useRef(null);

  // scorro in fondo quando arriva un messaggio
  const inFondo = (liscio = true) => requestAnimationFrame(() => fine.current?.scrollIntoView({ block: 'end', behavior: liscio ? 'smooth' : 'auto' }));
  useEffect(() => { if (!hidden && messaggi.length) inFondo(false); }, [hidden]);
  useEffect(() => { if (!hidden && kb) inFondo(); }, [kb]);

  const chiedi = async lista => {
    setAttesa(true);
    setErrore(null);
    inFondo();
    try {
      const risposta = await chiediCoach(lista, riassuntoDati(datiCoach(oggi)));
      salvaChat([...lista, { ruolo: 'coach', testo: risposta, ora: new Date().toISOString() }]);
      aptico('leggero');
    } catch (e) {
      setErrore(e?.message || 'Non riesco a rispondere adesso.');
    } finally {
      setAttesa(false);
      inFondo();
    }
  };

  const invia = t => {
    const q = (t ?? testo).trim();
    if (!q || attesa) return;
    aptico();
    const lista = [...messaggi, { ruolo: 'io', testo: q.slice(0, 2000), ora: new Date().toISOString() }];
    salvaChat(lista);
    setTesto('');
    if (campo.current) campo.current.style.height = '';
    chiedi(lista);
  };

  const menu = ancora => apriMenu(ancora, [
    { label: 'Nuova chat', icona: 'pencil', azione: () => { S.salva('coach', 'chat', { messaggi: [] }); setErrore(null); } },
    { label: 'Cosa sa il Coach', icona: 'info', azione: () => apriDatiCoach(oggi) },
  ]);

  const ultimo = messaggi.at(-1);
  const aspettaRisposta = !attesa && ultimo?.ruolo === 'io';

  return html`<${Page} id="coach" hidden=${hidden} title="Coach"
      actions=${html`<${IconButton} icon="ellipsis" label="Altre azioni" onClick=${e => menu(e.currentTarget)} />`}>
    <${Spunti} oggi=${oggi} vai=${vai} />

    <div class="section-title"><h2>Chiedi al Coach</h2></div>
    <div class="chat" aria-live="polite">
      ${!messaggi.length && html`<div class="chat-intro">
        <p class="t-sub secondary">Fai una domanda su allenamenti, cibo o peso: il Coach guarda i dati dell'app e risponde in modo semplice.</p>
        <div class="domande">${DOMANDE.map(q => html`<button type="button" class="domanda"
          disabled=${!cloud.collegato} onClick=${() => invia(q)}>${q}</button>`)}</div>
      </div>`}
      ${messaggi.map((m, i) => html`<${Bolla} key=${i} m=${m} />`)}
      ${attesa && html`<div class="bolla coach scrive" aria-label="Il Coach sta scrivendo"><i></i><i></i><i></i></div>`}
      ${(errore || aspettaRisposta) && html`<div class="chat-errore">
        <${Icon} name="info" size=${16} />
        <span class="grow">${errore || 'La risposta non è arrivata.'}</span>
        <button type="button" class="btn btn-plain btn-small" onClick=${() => chiedi(messaggi)}>Riprova</button>
      </div>`}
      <div ref=${fine} class="chat-fine"></div>
    </div>

    ${cloud.collegato
      ? html`<div class="scrivi" style=${kb ? `bottom:${kb}px` : null}>
          <textarea ref=${campo} rows="1" maxlength="2000" placeholder="Scrivi al Coach" value=${testo} aria-label="Messaggio per il Coach"
            onInput=${e => { setTesto(e.currentTarget.value); e.currentTarget.style.height = ''; e.currentTarget.style.height = Math.min(120, e.currentTarget.scrollHeight) + 'px'; }}
            onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); invia(); } }}></textarea>
          <button type="button" class="invia" disabled=${!testo.trim() || attesa} onClick=${() => invia()} aria-label="Invia">
            <${Icon} name="arrowUp" size=${18} strokeWidth=${2.6} />
          </button>
        </div>`
      : html`<div class="card coach-account">
          <div class="ca-top">
            <span class="co-icon"><${Icon} name="lock" size=${18} /></span>
            <div class="grow">
              <div class="co-title">Collega l'account per usare la chat</div>
              <div class="co-text">Il Coach risponde con l'intelligenza artificiale attraverso il tuo spazio online gratuito.
                La chiave dell'AI resta lì, mai sul telefono. Gli spunti qui sopra funzionano anche senza.</div>
            </div>
          </div>
          <div class="mt-12"><${Button} block kind="tinted" icon="cloud" onClick=${() => vai('altro', { sotto: 'account' })}>Collega l'account<//></div>
        </div>`}
  <//>`;
}

/* ---------- spunti della settimana ---------- */

const TINTE = { bene: 'var(--accent)', consiglio: 'var(--tono-ambra)', info: 'var(--label-2)' };

function Spunti({ oggi, vai }) {
  const [tutti, setTutti] = useState(false);
  const lista = spunti(datiCoach(oggi));
  if (!lista.length) {
    return html`<div class="card spunti-vuoti"><p class="t-sub secondary">Allenati, pesati e registra il cibo per qualche giorno:
      qui compariranno i consigli sulla tua settimana.</p></div>`;
  }
  const mostra = tutti ? lista : lista.slice(0, 4);
  return html`
    <div class="section-label">Questa settimana</div>
    <div class="list spunti">
      ${mostra.map(s => {
        const tag = s.vai ? 'button' : 'div';
        return html`<${tag} type=${s.vai ? 'button' : null} key=${s.id} class="row has-icon spunto"
          onClick=${s.vai ? () => { aptico(); vai(...s.vai); } : null}>
          <span class="row-icon tinta" style=${`--tile:${TINTE[s.tono]}`}><${Icon} name=${s.icona} /></span>
          <span class="row-main">
            <span class="row-title">${s.titolo}</span>
            <span class="row-sub">${s.testo}</span>
          </span>
          ${s.vai && html`<${Icon} name="chevronRight" class="chev" size=${14} />`}
        </${tag}>`;
      })}
    </div>
    ${lista.length > 4 && html`<div class="center"><button type="button" class="btn btn-plain" onClick=${() => setTutti(!tutti)}>
      ${tutti ? 'Mostra meno' : `Mostra tutti (${lista.length})`}</button></div>`}`;
}

/* ---------- messaggi ---------- */

function Bolla({ m }) {
  return html`<div class=${'bolla ' + (m.ruolo === 'io' ? 'io' : 'coach')}>
    ${m.ruolo === 'io' ? m.testo : html`<${Testo} testo=${m.testo} />`}
  </div>`;
}

/** Un po' di formattazione sicura (senza HTML): paragrafi, elenchi, grassetto. */
function Testo({ testo }) {
  const blocchi = [];
  let lista = null;
  for (const riga of String(testo || '').split('\n')) {
    const r = riga.trimEnd();
    const punto = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(r);
    if (punto) {
      if (!lista) { lista = { tipo: /^\s*\d/.test(r) ? 'ol' : 'ul', voci: [] }; blocchi.push(lista); }
      lista.voci.push(punto[1]);
      continue;
    }
    lista = null;
    if (!r.trim()) { blocchi.push(null); continue; }
    blocchi.push({ tipo: 'p', testo: r.replace(/^#{1,6}\s+/, ''), titolo: /^#{1,6}\s+/.test(r) });
  }
  const inline = t => t.split(/(\*\*[^*]+\*\*)/g).map(p => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? html`<b>${p.slice(2, -2)}</b>` : p));
  const out = [];
  let para = [];
  const chiudiPara = () => { if (para.length) { out.push(html`<p>${para.flatMap((t, i) => (i ? [html`<br />`, ...inline(t)] : inline(t)))}</p>`); para = []; } };
  for (const b of blocchi) {
    if (!b) { chiudiPara(); continue; }
    if (b.tipo === 'p') { if (b.titolo) { chiudiPara(); out.push(html`<p><b>${b.testo}</b></p>`); } else para.push(b.testo); continue; }
    chiudiPara();
    const Tag = b.tipo;
    out.push(html`<${Tag}>${b.voci.map(v => html`<li>${inline(v)}</li>`)}</${Tag}>`);
  }
  chiudiPara();
  return out;
}

/** Mostra esattamente il testo che il Coach riceve insieme alla domanda. */
function apriDatiCoach(oggi) {
  const testo = riassuntoDati(datiCoach(oggi));
  apriFoglio(() => html`<div>
    <p class="t-sub secondary">Insieme alla tua domanda il Coach riceve questo riassunto dei dati dell'app. Passa dal tuo spazio
      online (Supabase) e arriva all'AI di Anthropic solo per rispondere.</p>
    <pre class="dati-coach">${testo}</pre>
  </div>`, { titolo: 'Cosa sa il Coach', alto: true });
}

