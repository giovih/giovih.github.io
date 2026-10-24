// Altro → Salvataggio online: progetto Supabase, accesso, stato della sincronizzazione.
// Indirizzo e chiave pubblica del progetto si incollano qui: non sono scritti nel codice dell'app.

import { html, useState, useEffect } from '../lib/preact.js';
import * as C from '../data/cloud.js';
import * as SY from '../data/sync.js';
import { List, ListRow, SectionLabel, SectionFoot, Button, Segmented } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { plural } from '../core/format.js';

/** Testo breve sullo stato della sincronizzazione ("Sincronizzato 5 min fa"). */
export function statoSync(st = SY.stato()) {
  if (st.fase === 'offline') return { testo: 'Senza rete: invio appena torna' };
  if (st.fase === 'errore') return { testo: st.errore || 'Errore di sincronizzazione' };
  if (st.fase === 'invio' || st.fase === 'ricezione') return { testo: 'Sincronizzo…' };
  if (st.daInviare > 0) return { testo: `${plural(st.daInviare, 'modifica', 'modifiche')} da inviare` };
  if (!st.ultimo) return { testo: 'Pronto' };
  const min = Math.round((Date.now() - new Date(st.ultimo)) / 60000);
  return { testo: min < 1 ? 'Sincronizzato ora' : min < 60 ? `Sincronizzato ${min} min fa` : `Sincronizzato alle ${new Date(st.ultimo).toTimeString().slice(0, 5)}` };
}

export function PaginaAccount({ apri }) {
  const [cloud, setCloud] = useState(C.stato());
  const [sync, setSync] = useState(SY.stato());
  const [modifica, setModifica] = useState(false);
  useEffect(() => C.ascolta(setCloud), []);
  useEffect(() => SY.ascolta(setSync), []);

  return html`
    <div class="card account-testa">
      <span class="at-icona"><${Icon} name=${cloud.collegato ? 'cloudCheck' : 'cloud'} size=${30} /></span>
      <div class="t-title3 center">${cloud.collegato ? 'Dati al sicuro' : 'Salvataggio online'}</div>
      <p class="t-sub secondary center">${cloud.collegato
        ? 'Allenamenti, cibo, peso e foto sono anche nel tuo spazio online. Se cambi telefono accedi e torna tutto.'
        : 'Con un account gratuito su Supabase i dati (anche le foto) restano al sicuro: se cambi telefono o reinstalli l\'app accedi e torna tutto. Serve anche per le notifiche ad app chiusa e per l\'AI.'}</p>
    </div>
    ${cloud.collegato ? html`<${Collegato} cloud=${cloud} sync=${sync} apri=${apri} />`
      : !cloud.configurato || modifica ? html`<${Progetto} apri=${apri} onFatto=${() => setModifica(false)} />`
      : html`<${Accesso} cloud=${cloud} onCambiaProgetto=${() => setModifica(true)} />`}`;
}

/* ---------- 1. progetto ---------- */

function Progetto({ apri, onFatto }) {
  const cfg = C.configurazione();
  const [url, setUrl] = useState(cfg.url);
  const [chiave, setChiave] = useState(cfg.chiave);
  const valido = url.trim().length > 6 && chiave.trim().length > 20;
  const salva = () => {
    C.salvaConfigurazione(url, chiave);
    aptico('successo');
    toast('Progetto salvato', 'checkCircle');
    onFatto();
  };
  return html`
    <${List}>
      <${ListRow} icon="sliders" tile="#5856d6" title="Prepara il server" sub="Passo passo, con il codice da copiare" chevron onClick=${() => apri('prepara')} />
    <//>
    <${SectionLabel}>Il tuo progetto Supabase<//>
    <div class="card modulo">
      <label class="campo-diario">
        <span class="field-label">Indirizzo del progetto (Project URL)</span>
        <input class="field" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"
          placeholder="https://abcdefgh.supabase.co" value=${url} onInput=${e => setUrl(e.currentTarget.value)} />
      </label>
      <label class="campo-diario mt-12">
        <span class="field-label">Chiave pubblica (anon o publishable)</span>
        <input class="field" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="sb_publishable_… oppure eyJ…"
          value=${chiave} onInput=${e => setChiave(e.currentTarget.value)} />
      </label>
      <div class="mt-16"><${Button} block disabled=${!valido} onClick=${salva}>Salva<//></div>
    </div>
    <${SectionFoot}>Le trovi su supabase.com, nel tuo progetto: Project Settings, API. La chiave pubblica si può usare nell'app;
      la chiave dell'AI invece resta solo sul server.<//>`;
}

/* ---------- 2. accesso ---------- */

function Accesso({ cloud, onCambiaProgetto }) {
  const [modo, setModo] = useState('accedi');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const [msg, setMsg] = useState(null);
  const ok = /.+@.+\..+/.test(email.trim()) && password.length >= (modo === 'crea' ? 8 : 1);

  const invia = async () => {
    setLavoro(true); setMsg(null);
    try {
      if (modo === 'accedi') {
        await C.accedi(email, password);
        aptico('successo');
        toast('Account collegato', 'cloudCheck');
      } else {
        const r = await C.registrati(email, password);
        if (r.confermaEmail) setMsg({ tipo: 'info', testo: 'Ti ho mandato un\'email: apri il link da questo telefono e l\'app si riapre già collegata.' });
        else { aptico('successo'); toast('Account creato', 'cloudCheck'); }
      }
    } catch (e) {
      setMsg({ tipo: 'errore', testo: e.message || 'Qualcosa non ha funzionato, riprova.' });
    } finally { setLavoro(false); }
  };
  const recupera = async () => {
    if (!/.+@.+\..+/.test(email.trim())) { setMsg({ tipo: 'errore', testo: 'Scrivi prima la tua email.' }); return; }
    try { await C.recuperaPassword(email); setMsg({ tipo: 'info', testo: 'Se l\'email è giusta ti arriva un link per cambiare la password.' }); }
    catch (e) { setMsg({ tipo: 'errore', testo: e.message }); }
  };

  return html`
    <div class="mt-16"><${Segmented} label="Accedi o crea un account" value=${modo} onChange=${v => { setModo(v); setMsg(null); }}
      options=${[{ value: 'accedi', label: 'Accedi' }, { value: 'crea', label: 'Crea account' }]} /></div>
    <div class="card modulo mt-12">
      <label class="campo-diario">
        <span class="field-label">Email</span>
        <input class="field" type="email" inputmode="email" autocomplete="email" autocapitalize="off" value=${email} onInput=${e => setEmail(e.currentTarget.value)} />
      </label>
      <label class="campo-diario mt-12">
        <span class="field-label">Password${modo === 'crea' ? ' (almeno 8 caratteri)' : ''}</span>
        <input class="field" type="password" autocomplete=${modo === 'crea' ? 'new-password' : 'current-password'} value=${password}
          onInput=${e => setPassword(e.currentTarget.value)} onKeyDown=${e => e.key === 'Enter' && ok && invia()} />
      </label>
      ${msg && html`<p class=${'pesa-msg' + (msg.tipo === 'errore' ? ' errore' : '')} role=${msg.tipo === 'errore' ? 'alert' : 'status'}>${msg.testo}</p>`}
      <div class="mt-16"><${Button} block disabled=${!ok || lavoro} onClick=${invia}>${lavoro ? 'Attendo…' : modo === 'accedi' ? 'Accedi' : 'Crea account'}<//></div>
      ${modo === 'accedi' && html`<div class="center mt-8"><button type="button" class="btn btn-plain btn-small" onClick=${recupera}>Password dimenticata?</button></div>`}
    </div>
    <${SectionFoot}>Progetto: ${cloud.url.replace(/^https:\/\//, '')}. <button type="button" class="link" onClick=${onCambiaProgetto}>Cambia</button><//>`;
}

/* ---------- 3. collegato ---------- */

function Collegato({ cloud, sync, apri }) {
  const [lavoro, setLavoro] = useState(false);
  const s = statoSync(sync);
  const ora = async () => {
    setLavoro(true);
    try { await SY.sincronizzaOra(); aptico('successo'); } catch (e) { toast(e.message || 'Non riesco a sincronizzare', 'info'); } finally { setLavoro(false); }
  };
  const esci = async () => { await C.esci(); aptico(); toast('Sei uscito: i dati restano su questo telefono', 'cloud'); };
  return html`
    <${List}>
      <${ListRow} icon="person" tile="#007aff" title=${cloud.email || 'Account'} sub=${s.testo} />
      <button type="button" class="row" disabled=${lavoro} onClick=${ora}>
        <span class="row-main"><span class="row-title accent">${lavoro ? 'Sincronizzo…' : 'Sincronizza ora'}</span></span>
        <${Icon} name="sync" size=${18} class=${'accent' + (lavoro ? ' gira' : '')} />
      </button>
    <//>
    <${SectionFoot}>La sincronizzazione è automatica: quando c'è rete l'app manda le modifiche e riceve quelle degli altri dispositivi.<//>
    <${List}>
      <${ListRow} icon="bell" tile="#ff3b30" title="Notifiche" chevron onClick=${() => apri('notifiche')} />
    <//>
    <div class="center mt-24"><button type="button" class="btn btn-plain danger" onClick=${esci}>Esci dall'account</button></div>`;
}
