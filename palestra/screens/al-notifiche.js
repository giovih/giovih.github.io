// Altro → Notifiche: permesso, prova, e ogni promemoria acceso o spento con il suo orario.

import { html, useState, useEffect } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as P from '../data/push.js';
import { List, SectionLabel, SectionFoot, Button, RigaInterruttore, RigaScelta, RigaOra, Toggle, TimeInput } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { GIORNI, cap, formatRelativeDay, isoDay } from '../core/dates.js';

const TIPI = ['allenamento', 'pesata', 'colazione', 'spuntino', 'pranzo', 'merenda', 'cena', 'notte', 'creatina', 'acqua'];

/** Testo breve per la riga in Altro. */
export function riassuntoNotifiche(imp) {
  const n = imp.notifiche;
  const accese = TIPI.filter(t => n[t]?.on).length + (n.recupero ? 1 : 0);
  return accese ? `${accese} attive` : 'Spente';
}

/** Riga di un promemoria: nome, orario e interruttore. */
function RigaPromemoria({ title, sub, on, ora, onOn, onOra }) {
  return html`<div class=${'row riga-promemoria' + (on ? '' : ' spenta')}>
    <span class="row-main"><span class="row-title">${title}</span>${sub && html`<span class="row-sub">${sub}</span>`}</span>
    ${ora != null && html`<${TimeInput} value=${ora} onChange=${onOra} label=${`Orario: ${title}`} />`}
    <${Toggle} checked=${on} onChange=${onOn} label=${title} />
  </div>`;
}

export function PaginaNotifiche({ vai }) {
  const imp = S.impostazioni();
  const n = imp.notifiche;
  const [st, setSt] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  const aggiorna = () => P.stato().then(setSt).catch(() => {});
  useEffect(() => { aggiorna(); return P.ascolta(aggiorna); }, []);

  const set = fn => { S.salvaImpostazioni(i => { fn(i.notifiche); return i; }); P.programmaPromemoria(); };
  const attiva = async () => {
    setLavoro(true);
    try {
      const r = await P.attiva();
      aptico('successo');
      toast(r.soloLocali ? 'Notifiche permesse' : 'Notifiche attive', 'bell');
    } catch (e) {
      toast(e.message || 'Non riesco ad attivarle', 'info');
    } finally { setLavoro(false); aggiorna(); }
  };
  const prova = async () => {
    try {
      const dove = await P.prova();
      toast(dove === 'server' ? 'Arriva tra pochi secondi' : 'Notifica inviata', 'bell');
    } catch (e) { toast(e.message || 'Non riesco a mandarla', 'info'); }
  };

  const giorniPesata = [1, 2, 3, 4, 5, 6, 7].map(d => ({ value: d, label: cap(GIORNI[d]) }));
  const anticipi = [30, 45, 60, 90, 120].map(m => ({ value: m, label: m % 60 ? `${m} min prima` : m === 60 ? '1 ora prima' : `${m / 60} ore prima` }));
  const prossimi = P.prossimiPromemoria(2).slice(0, 6);

  return html`
    <${Stato} st=${st} lavoro=${lavoro} onAttiva=${attiva} onProva=${prova} vai=${vai} />

    <${SectionLabel}>Allenamento<//>
    <${List}>
      <${RigaInterruttore} title="Fine del recupero" sub="Suona anche a telefono bloccato" checked=${n.recupero} onChange=${v => set(x => { x.recupero = v; })} />
      <${RigaInterruttore} title="Promemoria allenamento" sub="Nei giorni di palestra" checked=${n.allenamento.on} onChange=${v => set(x => { x.allenamento.on = v; })} />
      ${n.allenamento.on && html`<${RigaScelta} title="Quando" value=${+n.allenamento.anticipo} options=${anticipi}
        onChange=${v => set(x => { x.allenamento.anticipo = v; })} />`}
      <${RigaInterruttore} title="Pesata settimanale" checked=${n.pesata.on} onChange=${v => set(x => { x.pesata.on = v; })} />
      ${n.pesata.on && html`<${RigaScelta} title="Giorno" value=${+n.pesata.giorno} options=${giorniPesata} onChange=${v => set(x => { x.pesata.giorno = v; })} />
        <${RigaOra} title="Ora" value=${n.pesata.ora} onChange=${v => set(x => { x.pesata.ora = v; })} />`}
    <//>

    <${SectionLabel}>Pasti<//>
    <${List}>
      <${RigaPromemoria} title="Colazione" on=${n.colazione.on} ora=${n.colazione.ora}
        onOn=${v => set(x => { x.colazione.on = v; })} onOra=${v => set(x => { x.colazione.ora = v; })} />
      <${RigaPromemoria} title="Spuntino a scuola" on=${n.spuntino.on} ora=${n.spuntino.ora}
        onOn=${v => set(x => { x.spuntino.on = v; })} onOra=${v => set(x => { x.spuntino.ora = v; })} />
      <${RigaPromemoria} title="Pranzo" sub=${n.pranzo.auto ? 'Nei giorni di riposo' : null}
        on=${n.pranzo.on} ora=${n.pranzo.ora}
        onOn=${v => set(x => { x.pranzo.on = v; })} onOra=${v => set(x => { x.pranzo.ora = v; })} />
      ${n.pranzo.on && html`<${RigaScelta} title="Pre-allenamento" sub="Nei giorni di palestra"
        value=${n.pranzo.auto ? +n.pranzo.anticipo : 0}
        options=${[{ value: 60, label: '1 ora prima' }, { value: 75, label: '1 ora e 15 prima' }, { value: 90, label: '1 ora e mezza prima' }, { value: 0, label: 'Sempre all\'orario sopra' }]}
        onChange=${v => set(x => { x.pranzo.auto = v > 0; if (v) x.pranzo.anticipo = v; })} />`}
      <${RigaPromemoria} title="Merenda" sub=${n.merenda.auto ? 'Nei giorni di riposo' : null}
        on=${n.merenda.on} ora=${n.merenda.ora}
        onOn=${v => set(x => { x.merenda.on = v; })} onOra=${v => set(x => { x.merenda.ora = v; })} />
      ${n.merenda.on && html`<${RigaScelta} title="Post-allenamento" sub="Dall'inizio dell'allenamento"
        value=${n.merenda.auto ? +n.merenda.dopo : 0}
        options=${[{ value: 90, label: 'Dopo 1 ora e mezza' }, { value: 105, label: 'Dopo 1 ora e 45' }, { value: 120, label: 'Dopo 2 ore' }, { value: 135, label: 'Dopo 2 ore e 15' }, { value: 0, label: 'Sempre all\'orario sopra' }]}
        onChange=${v => set(x => { x.merenda.auto = v > 0; if (v) x.merenda.dopo = v; })} />`}
      <${RigaPromemoria} title="Cena" on=${n.cena.on} ora=${n.cena.ora}
        onOn=${v => set(x => { x.cena.on = v; })} onOra=${v => set(x => { x.cena.ora = v; })} />
      <${RigaPromemoria} title="Prima di dormire" on=${n.notte.on} ora=${n.notte.ora}
        onOn=${v => set(x => { x.notte.on = v; })} onOra=${v => set(x => { x.notte.ora = v; })} />
    <//>
    <${SectionFoot}>Il pranzo arriva prima della palestra e la merenda quando torni, in base all'orario dell'allenamento.<//>

    <${SectionLabel}>Creatina e acqua<//>
    <${List}>
      <${RigaPromemoria} title="Creatina" sub="Tutti i giorni, anche di riposo" on=${n.creatina.on} ora=${n.creatina.ora}
        onOn=${v => set(x => { x.creatina.on = v; })} onOra=${v => set(x => { x.creatina.ora = v; })} />
      <${RigaInterruttore} title="Acqua" sub=${`${n.acqua.ore.length} volte al giorno`} checked=${n.acqua.on} onChange=${v => set(x => { x.acqua.on = v; })} />
      ${n.acqua.on && n.acqua.ore.map((o, j) => html`<div class="row" key=${'acqua' + j}>
        <span class="row-main"><span class="row-title">${j + 1}° bicchiere</span></span>
        ${n.acqua.ore.length > 1 && html`<button type="button" class="icon-btn plain" aria-label="Togli questo orario"
          onClick=${() => set(x => { x.acqua.ore.splice(j, 1); })}><${Icon} name="minus" size=${16} /></button>`}
        <${TimeInput} value=${o} onChange=${v => set(x => { x.acqua.ore[j] = v; x.acqua.ore.sort(); })} label=${`Acqua ${j + 1}`} />
      </div>`)}
      ${n.acqua.on && n.acqua.ore.length < 8 && html`<button type="button" class="row" onClick=${() => set(x => { x.acqua.ore.push('21:00'); x.acqua.ore.sort(); })}>
        <span class="row-main"><span class="row-title accent">Aggiungi un orario</span></span>
      </button>`}
    <//>
    <${SectionFoot}>Se hai già segnato la creatina o hai bevuto abbastanza, il promemoria di quel giorno non arriva.<//>

    ${prossimi.length > 0 && html`<${SectionLabel}>Prossimi promemoria<//>
      <${List}>${prossimi.map(p => {
        const d = new Date(p.invio);
        return html`<div class="row" key=${p.tag}>
          <span class="row-main"><span class="row-title">${p.titolo}</span><span class="row-sub">${p.testo}</span></span>
          <span class="row-detail num">${formatRelativeDay(isoDay(d))} ${d.toTimeString().slice(0, 5)}</span>
        </div>`;
      })}<//>`}`;
}

function Stato({ st, lavoro, onAttiva, onProva, vai }) {
  if (!st) return null;
  let icona = 'bell', titolo, testo, azione = null;
  if (!st.supportate && st.iOS && !st.installata) {
    icona = 'info';
    titolo = 'Prima aggiungi l\'app alla schermata Home';
    testo = 'Su iPhone le notifiche funzionano solo dall\'app installata: in Safari tocca Condividi, poi "Aggiungi alla schermata Home", e apri Palestra da lì.';
  } else if (!st.supportate) {
    icona = 'info';
    titolo = 'Notifiche non disponibili';
    testo = 'Questo browser non supporta le notifiche web. Su iPhone serve iOS 16.4 o successivo.';
  } else if (st.permesso === 'denied') {
    icona = 'warning';
    titolo = 'Notifiche bloccate';
    testo = 'Le hai rifiutate. Per riattivarle: Impostazioni dell\'iPhone, Notifiche, Palestra, Consenti notifiche.';
  } else if (st.permesso !== 'granted') {
    titolo = 'Notifiche spente';
    testo = 'Recupero finito, allenamento, pasti, creatina e acqua: ogni promemoria si può spegnere qui sotto.';
    azione = html`<${Button} block icon="bell" disabled=${lavoro} onClick=${onAttiva}>${lavoro ? 'Attendo…' : 'Attiva le notifiche'}<//>`;
  } else if (!st.collegato) {
    titolo = 'Manca il salvataggio online';
    testo = 'Le notifiche sono permesse, ma per riceverle ad app chiusa serve il tuo spazio online: è lui che le manda all\'ora giusta.';
    azione = html`<div class="duo">
      <${Button} kind="tinted" icon="cloud" onClick=${() => vai('altro', { sotto: 'account' })}>Collega<//>
      <${Button} kind="secondary" onClick=${onProva}>Prova<//>
    </div>`;
  } else if (!st.iscritto) {
    titolo = 'Quasi fatto';
    testo = 'Manca l\'ultimo passaggio per ricevere le notifiche su questo telefono.';
    azione = html`<${Button} block icon="bell" disabled=${lavoro} onClick=${onAttiva}>${lavoro ? 'Attendo…' : 'Completa l\'attivazione'}<//>`;
  } else {
    icona = 'checkCircle';
    titolo = 'Notifiche attive';
    testo = st.ultimaProgrammazione ? 'I promemoria dei prossimi 14 giorni sono pronti sul server.' : 'Arrivano anche con l\'app chiusa.';
    azione = html`<${Button} kind="secondary" block onClick=${onProva}>Manda una notifica di prova<//>`;
  }
  return html`<div class="card stato-notifiche">
    <div class="sn-top">
      <span class="co-icon"><${Icon} name=${icona} size=${18} /></span>
      <div class="grow"><div class="co-title">${titolo}</div><div class="co-text">${testo}</div></div>
    </div>
    ${azione && html`<div class="mt-12">${azione}</div>`}
  </div>`;
}
