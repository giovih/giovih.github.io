// Progressi → Corpo: peso, andamento con la fascia obiettivo, consiglio sulle calorie, pesate e foto.
// L'obiettivo è salire di peso: i consigli possono solo aggiungere calorie, o toglierne poche
// se si sale troppo in fretta, mai sotto l'obiettivo di partenza della scheda.

import { html, useState, useRef } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import { Card, Button, EmptyState, Segmented, ListRow, SectionLabel } from '../ui/kit.js';
import { GraficoTempo } from '../ui/charts.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, apriMenu, toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { useOggi, useBlob, pref, setPref, scegliFile } from './comuni.js';
import { consiglioPeso, applicaConsiglio, lineaObiettivo, ritmoPeso, RITMO } from '../core/nutrition.js';
import { fmtKg1, fmtNum, fmtDelta, fmtInt, parseNum, plural } from '../core/format.js';
import { addDaysIso, daysBetween, parseDay, formatDayLong, formatDayShort, formatRelativeDay, cap, isoDay } from '../core/dates.js';

const PERIODI = [
  { value: '1m', label: '1M', giorni: 30 },
  { value: '3m', label: '3M', giorni: 91 },
  { value: '6m', label: '6M', giorni: 182 },
  { value: 'tutto', label: 'Tutto', giorni: null },
];

const giornoLungo = g => cap(formatDayLong(parseDay(g)));
const giornoBreve = g => formatDayShort(parseDay(g));

export function Corpo() {
  const oggi = useOggi();
  const imp = S.impostazioni();
  const pesi = A.pesi();
  const [periodo, setPeriodo] = useState(() => pref('periodoPeso', '3m'));
  const cambia = v => { setPeriodo(v); setPref('periodoPeso', v); };
  return html`
    <${Peso} pesi=${pesi} oggi=${oggi} imp=${imp} />
    ${pesi.length > 0 && html`<${Andamento} pesi=${pesi} oggi=${oggi} imp=${imp} periodo=${periodo} onPeriodo=${cambia} />`}
    <${Consiglio} pesi=${pesi} imp=${imp} oggi=${oggi} />
    ${pesi.length > 0 && html`<${Pesate} pesi=${pesi} oggi=${oggi} />`}
    <${Foto} oggi=${oggi} />`;
}

/* ---------- peso attuale ---------- */

function Peso({ pesi, oggi, imp }) {
  const ult = pesi.at(-1);
  if (!ult) {
    return html`<${Card}><${EmptyState} icon="scale" title="Nessuna pesata"
      text="Pesati al mattino, a digiuno, dopo il bagno. Una volta a settimana basta."
      action="Registra il peso" actionIcon="plus" onAction=${() => apriPesa()} /><//>`;
  }
  const p0 = pesi[0];
  const ritmo = ritmoPeso(pesi, oggi);
  const linea = lineaObiettivo(pesi, oggi, imp.obiettivi.ultimoAggiustamento);
  const quando = daysBetween(ult.giorno, oggi);
  return html`<${Card} class="peso-card">
    <div class="card-head">
      <span class="t-headline">Peso</span>
      <span class="spacer"></span>
      <${Button} kind="tinted" small icon="plus" onClick=${() => apriPesa()}>Registra<//>
    </div>
    <div class="peso-hero">
      <span class="ph-val rounded">${fmtKg1(ult.kg)}</span><span class="ph-unit">kg</span>
    </div>
    <div class="t-foot secondary">${quando === 0 ? 'Pesata di oggi' : quando === 1 ? 'Pesata di ieri' : `Ultima pesata: ${giornoLungo(ult.giorno).toLowerCase()}`}</div>
    <div class="peso-stat">
      <div>
        <span>Dall'inizio</span>
        <b class="num">${pesi.length > 1 ? `${fmtDelta(ult.kg - p0.kg)} kg` : '–'}</b>
      </div>
      <div>
        <span>A settimana</span>
        <b class="num">${ritmo == null ? '–' : `${fmtDelta(ritmo, 2)} kg`}</b>
      </div>
      <div>
        <span>Obiettivo oggi</span>
        <b class="num">${linea && pesi.length > 1 ? `${fmtKg1(linea.a.min)}-${fmtKg1(linea.a.max)}` : '–'}</b>
      </div>
    </div>
  <//>`;
}

/* ---------- grafico ---------- */

function Andamento({ pesi, oggi, imp, periodo, onPeriodo }) {
  const p0 = pesi[0];
  const giorni = PERIODI.find(p => p.value === periodo)?.giorni;
  let da = giorni ? addDaysIso(oggi, -giorni) : p0.giorno;
  if (da < p0.giorno) da = p0.giorno;
  if (daysBetween(da, oggi) < 7) da = addDaysIso(oggi, -7);
  // con un solo valore si vede il punto; con due o più la linea e la fascia obiettivo
  const linea = pesi.length >= 2 ? lineaObiettivo(pesi, oggi, imp.obiettivi.ultimoAggiustamento) : null;
  const banda = linea ? { da: { giorno: linea.da.giorno, y: linea.da.kg }, a: linea.a } : null;
  const punti = pesi.map(p => ({ giorno: p.giorno, y: p.kg }));
  const fumetto = q => {
    const righe = [];
    if (linea && q.giorno === linea.da.giorno) righe.push({ chiave: 'fascia', testo: 'Da qui parte l\'obiettivo' });
    else if (linea && q.giorno > linea.da.giorno) {
      const k = daysBetween(linea.da.giorno, q.giorno) / 7;
      righe.push({ chiave: 'fascia', testo: `Obiettivo ${fmtKg1(linea.da.kg + RITMO.min * k)}-${fmtKg1(linea.da.kg + RITMO.max * k)} kg` });
    }
    return { valore: `${fmtKg1(q.y)} kg`, data: giornoLungo(q.giorno), righe };
  };
  const descr = pesi.length === 1
    ? `Una pesata: ${fmtKg1(p0.kg)} chili il ${giornoBreve(p0.giorno)}.`
    : `Peso dal ${giornoBreve(pesi[0].giorno)} al ${giornoBreve(pesi.at(-1).giorno)}: da ${fmtKg1(pesi[0].kg)} a ${fmtKg1(pesi.at(-1).kg)} chili. Usa le frecce per leggere i valori.`;
  return html`
    <div class="section-title riga-filtro">
      <h2>Andamento</h2>
      <div class="filtro-periodo"><${Segmented} options=${PERIODI} value=${periodo} onChange=${onPeriodo} label="Periodo del grafico" /></div>
    </div>
    <${Card} class="grafico-card">
      <${GraficoTempo} punti=${punti} dominio=${[da, oggi]} banda=${banda} minSpan=${1.5}
        fmtY=${v => fmtNum(v)} fumetto=${fumetto} etichetta=${descr}
        legenda=${linea ? [{ tipo: 'linea', testo: 'Peso' }, { tipo: 'fascia', testo: `Obiettivo +${fmtNum(RITMO.min)}-${fmtNum(RITMO.max)} kg a settimana` }] : null} />
      ${pesi.length === 1 && html`<p class="t-foot secondary mt-8">Con la prossima pesata vedi la linea e la fascia obiettivo.</p>`}
    <//>`;
}

/* ---------- consiglio sulle calorie ---------- */

function Consiglio({ pesi, imp, oggi }) {
  const c = consiglioPeso(pesi, imp.obiettivi, oggi);
  const o = imp.obiettivi;
  const icona = { aumenta: 'arrowUp', riduci: 'gauge', attesa: 'hourglass', dati: 'scale', veloce: 'bolt' }[c.tipo] || 'checkCircle';
  const applica = () => {
    const nuovi = applicaConsiglio(o, c, oggi);
    S.salvaImpostazioni(i => ({ ...i, obiettivi: nuovi }));
    aptico('successo');
    toast(`Nuovo obiettivo: ${fmtInt(nuovi.kcalMin)}-${fmtInt(nuovi.kcalMax)} kcal`, 'flame');
  };
  return html`<div class="card consiglio mt-12">
    <div class="cs-top">
      <span class="co-icon"><${Icon} name=${icona} size=${18} /></span>
      <div class="grow">
        <div class="co-title">${c.titolo}</div>
        <div class="co-text">${c.testo}</div>
      </div>
    </div>
    <div class="cs-piede">
      <span class="t-foot secondary num">Obiettivo attuale ${fmtInt(o.kcalMin)}-${fmtInt(o.kcalMax)} kcal</span>
      ${c.delta !== 0 && html`<${Button} kind=${c.delta > 0 ? 'primary' : 'secondary'} small onClick=${applica}>
        ${c.delta > 0 ? `Aggiungi ${c.delta} kcal` : `Togli ${-c.delta} kcal`}<//>`}
    </div>
  </div>`;
}

/* ---------- elenco delle pesate (anche come tabella del grafico) ---------- */

function Pesate({ pesi, oggi }) {
  const [tutte, setTutte] = useState(false);
  const lista = [...pesi].reverse();
  const mostra = tutte ? lista : lista.slice(0, 5);
  return html`
    <${SectionLabel}>Pesate<//>
    <div class="list">
      ${mostra.map((p, i) => {
        const prec = lista[i + 1];
        return html`<${ListRow} key=${p.giorno} title=${formatRelativeDay(p.giorno, oggi)}
          sub=${prec ? `${fmtDelta(p.kg - prec.kg)} kg rispetto al ${giornoBreve(prec.giorno)}` : 'Prima pesata'}
          detail=${`${fmtKg1(p.kg)} kg`} chevron onClick=${() => apriPesa(p.giorno)} />`;
      })}
    </div>
    ${lista.length > 5 && html`<div class="center"><button type="button" class="btn btn-plain" onClick=${() => setTutte(!tutte)}>
      ${tutte ? 'Mostra meno' : `Mostra tutte (${lista.length})`}</button></div>`}`;
}

/* ---------- foglio: registra il peso ---------- */

export function apriPesa(giorno) {
  const oggi = isoDay();
  apriFoglio(chiudi => html`<${Pesa} giorno=${giorno || oggi} oggi=${oggi} chiudi=${chiudi} />`, { titolo: 'Peso' });
}

function Pesa({ giorno: g0, oggi, chiudi }) {
  const [giorno, setGiorno] = useState(g0);
  const esistente = A.pesi().find(p => p.giorno === giorno);
  const ultimo = A.pesoAttuale();
  const [testo, setTesto] = useState(() => fmtNum((esistente || ultimo)?.kg ?? 55));
  const [errore, setErrore] = useState('');
  const kg = parseNum(testo);
  const passo = d => {
    aptico('leggero');
    const v = Math.round(((kg ?? ultimo?.kg ?? 55) + d) * 10) / 10;
    setTesto(fmtNum(v));
    setErrore('');
  };
  const salva = () => {
    if (!A.registraPeso(giorno, kg ?? NaN)) { aptico('forte'); setErrore('Scrivi un peso tra 20 e 250 kg.'); return; }
    aptico('successo');
    toast(`${fmtKg1(Math.round(kg * 10) / 10)} kg salvato`, 'scale');
    chiudi();
  };
  const elimina = () => {
    A.eliminaPeso(giorno);
    aptico();
    toast('Pesata eliminata', 'trash');
    chiudi();
  };
  return html`<div class="pesa">
    <div class="pesa-valore">
      <button type="button" class="pesa-passo" onClick=${() => passo(-0.1)} aria-label="Meno 100 grammi"><${Icon} name="minus" size=${22} /></button>
      <label class="pesa-campo">
        <input class="rounded" inputmode="decimal" enterkeyhint="done" value=${testo} aria-label="Peso in chili"
          onInput=${e => { setTesto(e.currentTarget.value); setErrore(''); }} onKeyDown=${e => e.key === 'Enter' && salva()} />
        <span>kg</span>
      </label>
      <button type="button" class="pesa-passo" onClick=${() => passo(0.1)} aria-label="Più 100 grammi"><${Icon} name="plus" size=${22} /></button>
    </div>
    ${errore ? html`<p class="pesa-msg errore" role="alert">${errore}</p>`
      : html`<p class="pesa-msg">${esistente ? `Sostituisce la pesata di questo giorno (${fmtKg1(esistente.kg)} kg).` : 'Al mattino, a digiuno, dopo il bagno: sempre nelle stesse condizioni.'}</p>`}
    <div class="list mt-16">
      <label class="row">
        <span class="row-main"><span class="row-title">Giorno</span></span>
        <input class="time-input" type="date" value=${giorno} max=${oggi} aria-label="Giorno della pesata"
          onChange=${e => { if (e.currentTarget.value && e.currentTarget.value <= oggi) setGiorno(e.currentTarget.value); }} />
      </label>
    </div>
    <div class="mt-24"><${Button} block onClick=${salva}>Salva<//></div>
    ${esistente && html`<div class="center mt-8"><button type="button" class="btn btn-plain danger" onClick=${elimina}>Elimina questa pesata</button></div>`}
  </div>`;
}

/* ---------- foto di progresso ---------- */

function Foto({ oggi }) {
  const foto = A.foto(); // dalla più vecchia
  const [scelta, setScelta] = useState(() => pref('confrontoFoto', null));
  const trova = id => foto.find(f => f.id === id);
  const prima = (scelta && trova(scelta[0])) || foto[0];
  const dopo = (scelta && trova(scelta[1])) || foto.at(-1);
  const imposta = (quale, f) => {
    const v = quale === 'prima' ? [f.id, dopo?.id] : [prima?.id, f.id];
    setScelta(v);
    setPref('confrontoFoto', v);
  };
  const aggiungi = async ancora => {
    apriMenu(ancora, [
      { label: 'Scatta una foto', icona: 'camera', azione: () => carica('user') },
      { label: 'Scegli dalla libreria', icona: 'photo', azione: () => carica(null) },
    ]);
  };
  const carica = async capture => {
    const f = await scegliFile({ accept: 'image/*', capture });
    if (!f) return;
    try {
      await A.aggiungiFoto(f, oggi);
      aptico('successo');
      toast('Foto salvata', 'photo');
    } catch {
      toast('Non riesco ad aprire questa foto', 'info');
    }
  };

  return html`
    <div class="section-title">
      <h2>Foto</h2>
      <button type="button" class="st-action" onClick=${e => aggiungi(e.currentTarget)}>Aggiungi</button>
    </div>
    ${!foto.length ? html`<${Card}><${EmptyState} icon="camera" title="Nessuna foto"
        text="Una foto ogni 4 settimane, con la stessa luce e la stessa posa: è il modo migliore per vedere i cambiamenti."
        action="Aggiungi la prima" actionIcon="plus" onAction=${() => carica('user')} /><//>`
      : html`
        ${foto.length >= 2 && prima && dopo && prima.id !== dopo.id && html`<${Confronto} prima=${prima} dopo=${dopo} />`}
        <div class="foto-griglia">
          ${[...foto].reverse().map(f => html`<${Miniatura} key=${f.id} f=${f}
            segno=${f.id === prima?.id ? 'Prima' : f.id === dopo?.id && foto.length > 1 ? 'Dopo' : null}
            onClick=${() => apriFoto(f, imposta)} />`)}
        </div>`}
    <p class="section-foot">Le foto restano sul telefono e, se colleghi l'account, nel tuo spazio privato online. Nessun altro le vede.</p>`;
}

function Miniatura({ f, segno, onClick }) {
  const mini = useBlob(`foto/${f.id}_t`);
  const grande = useBlob(mini ? null : `foto/${f.id}`);
  const src = mini || grande;
  return html`<button type="button" class="foto-mini" onClick=${() => { aptico(); onClick(); }} aria-label=${`Foto del ${giornoBreve(f.giorno)}`}>
    ${src ? html`<img src=${src} alt="" loading="lazy" />` : html`<span class="fm-vuota"><${Icon} name="photo" size=${22} /></span>`}
    <span class="fm-data">${giornoBreve(f.giorno)}</span>
    ${segno && html`<span class="fm-segno">${segno}</span>`}
  </button>`;
}

function Confronto({ prima, dopo }) {
  const a = useBlob(`foto/${prima.id}_t`), b = useBlob(`foto/${dopo.id}_t`);
  const giorni = Math.abs(daysBetween(prima.giorno, dopo.giorno));
  return html`<button type="button" class="card flush confronto" onClick=${() => { aptico(); apriConfronto(prima, dopo); }}
    aria-label="Confronta prima e dopo a schermo intero">
    <div class="cf-coppia">
      <figure>${a ? html`<img src=${a} alt="" />` : html`<span class="fm-vuota"><${Icon} name="photo" size=${22} /></span>`}<figcaption>Prima · ${giornoBreve(prima.giorno)}</figcaption></figure>
      <figure>${b ? html`<img src=${b} alt="" />` : html`<span class="fm-vuota"><${Icon} name="photo" size=${22} /></span>`}<figcaption>Dopo · ${giornoBreve(dopo.giorno)}</figcaption></figure>
    </div>
    <div class="cf-piede">
      <span class="t-foot secondary">${plural(giorni, 'giorno', 'giorni')} di differenza</span>
      <span class="t-foot accent">Confronta<${Icon} name="chevronRight" size=${12} /></span>
    </div>
  </button>`;
}

/** Foto a schermo intero, con "usa come prima/dopo" ed elimina. */
function apriFoto(f, imposta) {
  apriFoglio(chiudi => html`<${FotoGrande} f=${f} imposta=${imposta} chiudi=${chiudi} />`, { alto: true, titolo: giornoLungo(f.giorno) });
}

function FotoGrande({ f, imposta, chiudi }) {
  // gli hook vanno chiamati sempre tutti e due (mai dentro un ||)
  const grande = useBlob(`foto/${f.id}`), mini = useBlob(`foto/${f.id}_t`);
  const src = grande || mini;
  const [conferma, setConferma] = useState(false);
  return html`<div class="foto-grande">
    <div class="fg-img">${src ? html`<img src=${src} alt=${`Foto del ${giornoBreve(f.giorno)}`} />` : html`<span class="fm-vuota"><${Icon} name="photo" size=${30} /></span>`}</div>
    <div class="duo mt-16">
      <${Button} kind="secondary" onClick=${() => { imposta('prima', f); chiudi(); toast('Impostata come "prima"', 'photo'); }}>Usa come prima<//>
      <${Button} kind="secondary" onClick=${() => { imposta('dopo', f); chiudi(); toast('Impostata come "dopo"', 'photo'); }}>Usa come dopo<//>
    </div>
    <div class="center mt-8">
      ${conferma
        ? html`<${Button} kind="danger" block onClick=${async () => { await A.eliminaFoto(f.id); aptico(); chiudi(); toast('Foto eliminata', 'trash'); }}>Elimina definitivamente<//>`
        : html`<button type="button" class="btn btn-plain danger" onClick=${() => setConferma(true)}>Elimina foto</button>`}
    </div>
  </div>`;
}

/** Prima e dopo sovrapposte: si trascina la linea per scoprire una o l'altra. */
function apriConfronto(prima, dopo) {
  apriFoglio(() => html`<${ConfrontoGrande} prima=${prima} dopo=${dopo} />`, { alto: true, titolo: 'Prima e dopo' });
}

function ConfrontoGrande({ prima, dopo }) {
  const a1 = useBlob(`foto/${prima.id}`), a2 = useBlob(`foto/${prima.id}_t`);
  const b1 = useBlob(`foto/${dopo.id}`), b2 = useBlob(`foto/${dopo.id}_t`);
  const a = a1 || a2, b = b1 || b2;
  const [pos, setPos] = useState(50);
  const box = useRef(null);
  const muovi = e => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };
  const tasto = e => {
    if (e.key === 'ArrowLeft') setPos(p => Math.max(0, p - 5));
    if (e.key === 'ArrowRight') setPos(p => Math.min(100, p + 5));
  };
  return html`<div class="confronto-grande">
    <div ref=${box} class="cg-box" onPointerDown=${e => { e.currentTarget.setPointerCapture?.(e.pointerId); muovi(e); }}
      onPointerMove=${e => e.buttons && muovi(e)} role="slider" tabindex="0" aria-label="Dividi prima e dopo"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(pos)} onKeyDown=${tasto}>
      ${b && html`<img class="cg-dopo" src=${b} alt="" />`}
      ${a && html`<img class="cg-prima" src=${a} alt="" style=${`clip-path:inset(0 ${100 - pos}% 0 0)`} />`}
      <span class="cg-linea" style=${`left:${pos}%`}><span class="cg-maniglia"><${Icon} name="chevronLeft" size=${12} /><${Icon} name="chevronRight" size=${12} /></span></span>
      <span class="cg-etichetta sx">Prima · ${giornoBreve(prima.giorno)}</span>
      <span class="cg-etichetta dx">Dopo · ${giornoBreve(dopo.giorno)}</span>
    </div>
    <p class="section-foot center">Trascina la linea. ${plural(Math.abs(daysBetween(prima.giorno, dopo.giorno)), 'giorno', 'giorni')} tra le due foto.</p>
  </div>`;
}
