// Altro → Scheda e calendario, editor di una scheda, orari della palestra.
// Le modifiche valgono dal prossimo allenamento: lo storico resta com'è.

import { html, useState } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import { List, SectionLabel, SectionFoot, Button, Chip, RigaScelta, RigaNumero, RigaInterruttore, RigaOra, EmptyState } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { coloreTono } from './comuni.js';
import { SCHEDE, ORDINE_SCHEDE, CALENDARIO_BASE, CALENDARIO_ALT, CATALOGO, GRUPPI, ATTREZZI, durataStimata, gruppoDi } from '../core/scheda.js';
import { fmtRest, fmtSetsReps } from '../core/format.js';
import { GIORNI, cap } from '../core/dates.js';
import { normalizza } from '../core/foods.js';

const uguali = (a, b) => [1, 2, 3, 4, 5, 6, 7].every(d => (a[d] || null) === (b[d] || null));

/* =====================================================================
   Scheda e calendario
   ===================================================================== */

export function PaginaSchede({ apri }) {
  const imp = S.impostazioni();
  const opzioni = [
    ...['A', 'B', 'G', 'C'].map(c => ({ value: c, label: imp.schede[c].nome })),
    { value: 'riposo', label: 'Riposo' },
  ];
  const imposta = (d, v) => S.salvaImpostazioni(i => { i.calendario[d] = v === 'riposo' ? null : v; return i; });
  const preset = cal => { aptico('successo'); S.salvaImpostazioni(i => ({ ...i, calendario: { ...cal } })); };
  const base = uguali(imp.calendario, CALENDARIO_BASE), alt = uguali(imp.calendario, CALENDARIO_ALT);
  const conteggio = {};
  for (let d = 1; d <= 7; d++) if (imp.calendario[d]) conteggio[imp.calendario[d]] = (conteggio[imp.calendario[d]] || 0) + 1;
  const mancanti = ['A', 'B', 'G', 'C'].filter(c => !conteggio[c]).map(c => imp.schede[c].nome);
  const doppie = Object.entries(conteggio).filter(([, n]) => n > 1).map(([c]) => imp.schede[c].nome);

  return html`
    <${SectionLabel}>Calendario<//>
    <${List}>
      ${[1, 2, 3, 4, 5, 6, 7].map(d => html`<${RigaScelta} key=${d} title=${cap(GIORNI[d])}
        value=${imp.calendario[d] || 'riposo'} options=${opzioni} onChange=${v => imposta(d, v)} />`)}
    <//>
    <div class="preset-cal">
      <button type="button" class=${'scelta' + (base ? ' on' : '')} onClick=${() => preset(CALENDARIO_BASE)}>Lun, mer, ven, sab</button>
      <button type="button" class=${'scelta' + (alt ? ' on' : '')} onClick=${() => preset(CALENDARIO_ALT)}>Lun, mer, ven, dom</button>
    </div>
    ${(mancanti.length > 0 || doppie.length > 0) && html`<div class="callout warning mt-12">
      <span class="co-icon"><${Icon} name="warning" /></span>
      <span class="grow"><span class="co-text">${[
        mancanti.length ? `Manca ${mancanti.join(', ')}.` : null,
        doppie.length ? `${doppie.join(', ')} è in calendario più di una volta.` : null,
      ].filter(Boolean).join(' ')} Ogni seduta va fatta una volta a settimana.</span></span>
    </div>`}
    <${SectionFoot}>Le quattro sedute, ognuna una volta a settimana, con un giorno di riposo tra due sedute uguali.<//>

    <${SectionLabel}>Sedute<//>
    <${List}>
      ${ORDINE_SCHEDE.map(cod => {
        const sc = imp.schede[cod];
        const off = cod === 'F' && !imp.avambracci.attivo;
        return html`<button type="button" key=${cod} class="row riga-scheda" onClick=${() => { aptico(); apri('scheda', { cod }); }}>
          <span class="pallino-tono" style=${`--tono:${coloreTono(sc.tono)}`} aria-hidden="true"></span>
          <span class="row-main">
            <span class="row-title">${sc.nome}</span>
            <span class="row-sub">${sc.righe.length} esercizi · circa ${durataStimata(sc)} min${off ? ' · spenta' : ''}</span>
          </span>
          <${Icon} name="chevronRight" class="chev" size=${14} />
        </button>`;
      })}
    <//>
    <${SectionFoot}>Tocca una seduta per cambiare esercizi, serie, ripetizioni e recuperi.<//>`;
}

/* =====================================================================
   Una scheda
   ===================================================================== */

const RECUPERI = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const fmtRec = s => (s >= 120 ? (s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`) : `${s} s`);

export function PaginaScheda({ voce }) {
  const cod = voce.cod;
  const imp = S.impostazioni();
  const sc = imp.schede[cod];
  if (!sc) return html`<${EmptyState} icon="list" title="Scheda non trovata" />`;
  const modificata = JSON.stringify(sc.righe) !== JSON.stringify(SCHEDE[cod].righe);
  const pers = A.esercizi();

  const aggiungi = () => apriCatalogo({
    titolo: 'Aggiungi esercizio',
    onScegli: nome => {
      S.salvaImpostazioni(i => { i.schede[cod].righe.push({ ex: nome, serie: 3, min: 8, max: 12, recMin: 90, recMax: 90, ss: null, drop: false }); return i; });
      toast(`${nome} aggiunto`, 'plus');
    },
  });
  const ripristina = () => apriFoglio(chiudi => html`<div>
    <p class="t-sub">Torna la scheda originale di ${sc.nome}: esercizi, serie, ripetizioni e recuperi. Lo storico degli allenamenti non cambia.</p>
    <div class="mt-16"><${Button} kind="danger" block onClick=${() => {
      S.salvaImpostazioni(i => { i.schede[cod].righe = JSON.parse(JSON.stringify(SCHEDE[cod].righe)); return i; });
      aptico('successo'); chiudi(); toast('Scheda ripristinata', 'reset');
    }}>Ripristina<//></div>
  </div>`, { titolo: 'Ripristina la scheda' });

  return html`
    <div class="card scheda-testa" style=${`--tono:${coloreTono(sc.tono)}`}>
      <span class="pallino-tono"></span>
      <div class="grow">
        <div class="t-title3">${sc.nome}</div>
        <div class="t-foot secondary">${sc.sotto} · circa ${durataStimata(sc)} min</div>
      </div>
    </div>
    <${SectionLabel}>Esercizi<//>
    <${List}>
      ${sc.righe.map((r, i) => {
        const conSucc = r.ss != null && sc.righe[i + 1]?.ss === r.ss;
        const conPrec = r.ss != null && sc.righe[i - 1]?.ss === r.ss;
        return html`<button type="button" key=${i + r.ex} class="row riga-esercizio" onClick=${() => { aptico(); apriRiga(cod, i); }}>
          <span class="re-n num">${i + 1}</span>
          <span class="row-main">
            <span class="row-title">${r.ex}</span>
            <span class="row-sub num">${fmtSetsReps(r.serie, r.min, r.max)} · recupero ${fmtRest(r.recMin, r.recMax)}${gruppoDi(r.ex, pers) ? ` · ${GRUPPI[gruppoDi(r.ex, pers)].toLowerCase()}` : ''}</span>
          </span>
          ${(conSucc || conPrec) && html`<${Chip} kind="accent">SS<//>`}
          ${r.drop && html`<${Chip}>Drop<//>`}
          <${Icon} name="chevronRight" class="chev" size=${14} />
        </button>`;
      })}
      <button type="button" class="row" onClick=${() => { aptico(); aggiungi(); }}>
        <span class="re-n accent"><${Icon} name="plus" size=${16} /></span>
        <span class="row-main"><span class="row-title accent">Aggiungi esercizio</span></span>
      </button>
    <//>
    <${SectionFoot}>Le modifiche valgono dal prossimo allenamento. SS = superserie: due esercizi di fila, recupero alla fine della coppia.<//>
    ${modificata && html`<div class="center mt-16"><button type="button" class="btn btn-plain danger" onClick=${ripristina}>Ripristina la scheda originale</button></div>`}`;
}

/** Foglio per modificare un esercizio della scheda. */
function apriRiga(cod, indice) {
  apriFoglio(chiudi => html`<${EditorRiga} cod=${cod} indice=${indice} chiudi=${chiudi} />`, { titolo: 'Esercizio', alto: true });
}

function EditorRiga({ cod, indice, chiudi }) {
  const [i, setI] = useState(indice);
  const imp = S.impostazioni();
  const righe = imp.schede[cod].righe;
  const r = righe[i];
  if (!r) return html`<${EmptyState} icon="list" title="Esercizio tolto" />`;
  const modifica = fn => S.salvaImpostazioni(x => { fn(x.schede[cod].righe); return x; });
  const set = patch => modifica(rr => { Object.assign(rr[i], patch); });
  const conSucc = r.ss != null && righe[i + 1]?.ss === r.ss;
  const succ = righe[i + 1];

  const superserie = on => modifica(rr => {
    if (on && rr[i + 1]) {
      const id = Math.max(0, ...rr.map(x => +x.ss || 0)) + 1;
      // se il successivo era in coppia con un altro, la sciolgo
      const vecchio = rr[i + 1].ss;
      if (vecchio != null) rr.forEach(x => { if (x.ss === vecchio) x.ss = null; });
      if (rr[i].ss != null) { const mio = rr[i].ss; rr.forEach(x => { if (x.ss === mio) x.ss = null; }); }
      rr[i].ss = id; rr[i + 1].ss = id;
    } else if (!on && r.ss != null) {
      const mio = rr[i].ss;
      rr.forEach(x => { if (x.ss === mio) x.ss = null; });
    }
  });
  const sposta = d => {
    const j = i + d;
    if (j < 0 || j >= righe.length) return;
    aptico();
    modifica(rr => {
      [rr[i], rr[j]] = [rr[j], rr[i]];
      // spostando si sciolgono le superserie che non sono più vicine
      rr.forEach((x, k) => { if (x.ss != null && rr[k - 1]?.ss !== x.ss && rr[k + 1]?.ss !== x.ss) x.ss = null; });
    });
    setI(j);
  };
  const togli = () => {
    modifica(rr => {
      const mio = rr[i].ss;
      rr.splice(i, 1);
      if (mio != null) rr.forEach(x => { if (x.ss === mio) x.ss = null; });
    });
    aptico();
    chiudi();
    toast(`${r.ex} tolto dalla scheda`, 'trash');
  };
  const cambia = () => apriCatalogo({
    titolo: 'Cambia esercizio', gruppo: gruppoDi(r.ex, A.esercizi()),
    onScegli: nome => { set({ ex: nome }); toast(`Ora c'è ${nome}`, 'swap'); },
  });

  const opzRec = RECUPERI.map(s => ({ value: s, label: fmtRec(s) }));
  return html`<div class="editor-riga">
    <button type="button" class="card er-nome" onClick=${() => { aptico(); cambia(); }}>
      <span class="grow">
        <span class="t-cap secondary">Esercizio ${i + 1} di ${righe.length}</span>
        <span class="t-title3">${r.ex}</span>
      </span>
      <span class="t-sub accent">Cambia</span>
    </button>
    <div class="list mt-16">
      <${RigaNumero} title="Serie" value=${r.serie} min=${1} max=${8} onChange=${v => set({ serie: v })} />
    </div>
    <${SectionLabel}>Ripetizioni per serie<//>
    <div class="list">
      <${RigaNumero} title="Da" value=${r.min} min=${1} max=${50} onChange=${v => set({ min: v, max: Math.max(v, r.max) })} />
      <${RigaNumero} title="A" value=${r.max} min=${r.min} max=${50} onChange=${v => set({ max: v })} />
    </div>
    <${SectionFoot}>Si parte dal numero più basso e si sale di una ripetizione a settimana; arrivato in cima in tutte le serie, più peso.<//>
    <${SectionLabel}>Recupero<//>
    <div class="list">
      <${RigaScelta} title="Da" value=${r.recMin} options=${opzRec} onChange=${v => set({ recMin: v, recMax: Math.max(v, r.recMax) })} />
      <${RigaScelta} title="A" value=${r.recMax} options=${opzRec.filter(o => o.value >= r.recMin)} onChange=${v => set({ recMax: v })} />
    </div>
    <div class="list mt-16">
      <${RigaInterruttore} title="Superserie con il successivo" sub=${succ ? succ.ex : 'È l\'ultimo esercizio'}
        checked=${conSucc} disabled=${!succ} onChange=${superserie} />
      <${RigaInterruttore} title="Drop set nell'ultima serie" sub="Solo nelle settimane 5, 6 e 7 del ciclo" checked=${!!r.drop} onChange=${v => set({ drop: v })} />
    </div>
    <div class="duo mt-16">
      <${Button} kind="secondary" icon="chevronUp" disabled=${i === 0} onClick=${() => sposta(-1)}>Sposta su<//>
      <${Button} kind="secondary" icon="chevronDown" disabled=${i === righe.length - 1} onClick=${() => sposta(1)}>Sposta giù<//>
    </div>
    <div class="center mt-16"><button type="button" class="btn btn-plain danger" onClick=${togli}>Togli dalla scheda</button></div>
  </div>`;
}

/** Elenco di tutti gli esercizi (catalogo + creati da te), con ricerca. */
export function apriCatalogo({ titolo, gruppo = null, onScegli }) {
  apriFoglio(chiudi => html`<${Catalogo} gruppo=${gruppo} onScegli=${n => { chiudi(); onScegli(n); }} />`, { titolo, alto: true });
}

function Catalogo({ gruppo, onScegli }) {
  const [q, setQ] = useState('');
  const pers = A.esercizi();
  const tutti = [...CATALOGO, ...pers.filter(p => !CATALOGO.some(c => c.nome === p.nome))];
  const f = normalizza(q);
  const filtrati = tutti.filter(e => !f || normalizza(e.nome).includes(f));
  const ordine = Object.keys(GRUPPI).sort((a, b) => (a === gruppo ? -1 : b === gruppo ? 1 : 0));
  return html`<div>
    <label class="search"><${Icon} name="search" /><input type="search" placeholder="Cerca esercizio" value=${q}
      onInput=${e => setQ(e.currentTarget.value)} aria-label="Cerca esercizio" /></label>
    ${ordine.map(g => {
      const lista = filtrati.filter(e => e.gruppo === g);
      if (!lista.length) return null;
      return html`<div class="section-label">${GRUPPI[g]}</div>
        <div class="list">${lista.map(e => html`<button type="button" class="row" onClick=${() => { aptico(); onScegli(e.nome); }}>
          <span class="row-main"><span class="row-title">${e.nome}</span><span class="row-sub">${ATTREZZI[e.eq]?.nome || ''}</span></span>
        </button>`)}</div>`;
    })}
    ${!filtrati.length && html`<${EmptyState} icon="search" title="Nessun esercizio" text="Puoi crearne uno nuovo durante l'allenamento, dal menu dell'esercizio." />`}
  </div>`;
}

/* =====================================================================
   Orari della palestra
   ===================================================================== */

export function PaginaOrari() {
  const imp = S.impostazioni();
  const giorni = [1, 2, 3, 4, 5, 6, 7].filter(d => imp.calendario[d] || (imp.avambracci.attivo && +imp.avambracci.giorno === d));
  const imposta = (d, v) => S.salvaImpostazioni(i => {
    if (v == null || v === i.palestra.ora) delete i.palestra.perGiorno[d];
    else i.palestra.perGiorno[d] = v;
    return i;
  });
  return html`
    <${List}>
      <${RigaOra} icon="clock" tile="#5e5ce6" title="Di solito vado alle" value=${imp.palestra.ora}
        onChange=${v => S.salvaImpostazioni(i => { i.palestra.ora = v; return i; })} />
    <//>
    <${SectionFoot}>Serve per i promemoria: allenamento, pranzo prima della palestra e merenda dopo.<//>
    <${SectionLabel}>Se un giorno è diverso<//>
    <${List}>
      ${giorni.map(d => {
        const cod = imp.calendario[d] || 'F';
        const proprio = imp.palestra.perGiorno?.[d];
        return html`<div class="row" key=${d}>
          <span class="row-main">
            <span class="row-title">${cap(GIORNI[d])}</span>
            <span class="row-sub">${imp.schede[cod]?.nome || ''}${proprio ? '' : ' · come gli altri giorni'}</span>
          </span>
          ${proprio && html`<button type="button" class="btn btn-plain btn-small" onClick=${() => imposta(d, null)}>Come gli altri</button>`}
          <input class="time-input" type="time" value=${proprio || imp.palestra.ora} aria-label=${`Orario di ${GIORNI[d]}`}
            onChange=${e => e.currentTarget.value && imposta(d, e.currentTarget.value)} />
        </div>`;
      })}
    <//>`;
}
