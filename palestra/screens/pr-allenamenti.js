// Progressi → Allenamenti: numeri della settimana, serie per muscolo, grafico di un esercizio, storico delle sedute.

import { html, useState } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import { Card, Button, IconButton, EmptyState, Segmented, StatTile, SectionLabel, Chip } from '../ui/kit.js';
import { GraficoTempo, BarreOrizzontali } from '../ui/charts.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { useOggi, pref, setPref, coloreTono } from './comuni.js';
import { GRUPPI, gruppoDi, attrezzoDi, ATTREZZI } from '../core/scheda.js';
import { sedutaDelGiorno } from '../core/settings.js';
import { puntiEsercizio, eserciziFatti, statistiche, serieFatte, serieMigliore, recordBattuti, forzaStimata } from '../core/progression.js';
import { seriePerGruppo, giornoSeduta } from '../core/stats.js';
import { fmtNum, fmtInt, fmtDelta, fmtMinutes, plural } from '../core/format.js';
import { isoDay, parseDay, addDaysIso, mondayOf, formatDayShort, formatDayLong, cap, MESI, MESI_BREVI, GIORNI_BREVI, weekdayIt } from '../core/dates.js';
import { normalizza } from '../core/foods.js';

const ora = iso => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const giornoBreve = g => formatDayShort(parseDay(g));
const setsTesto = sets => sets.map(x => (x.kg > 0 ? `${fmtNum(x.kg)} × ${x.reps}` : `${x.reps}`)).join(' · ');

export function Allenamenti({ vai }) {
  const oggi = useOggi();
  const sedute = A.sessioni().filter(s => s.fine);
  if (!sedute.length) {
    return html`<${Card}><${EmptyState} icon="dumbbell" title="Ancora nessun allenamento"
      text="Quando finisci il primo allenamento qui trovi la forza di ogni esercizio, le serie per muscolo e lo storico."
      action="Vai a Oggi" onAction=${() => vai('oggi')} /><//>`;
  }
  return html`
    <${Numeri} sedute=${sedute} oggi=${oggi} />
    <${Anno} sedute=${sedute} oggi=${oggi} />
    <${Muscoli} sedute=${sedute} oggi=${oggi} />
    <${Esercizio} sedute=${sedute} oggi=${oggi} />
    <${Storico} sedute=${sedute} />`;
}

/* ---------- numeri della settimana e del mese ---------- */

function Numeri({ sedute, oggi }) {
  const imp = S.impostazioni();
  const lun = isoDay(mondayOf(parseDay(oggi)));
  const settimana = sedute.filter(s => giornoSeduta(s) >= lun).length;
  let previste = 0;
  for (let d = 1; d <= 7; d++) if (sedutaDelGiorno(imp, d)) previste++;
  const mese = oggi.slice(0, 7);
  const nelMese = sedute.filter(s => giornoSeduta(s).startsWith(mese)).length;
  const ultime = sedute.slice(0, 10).map(s => statistiche(s).durata).filter(d => d > 0);
  const media = ultime.length ? ultime.reduce((t, d) => t + d, 0) / ultime.length : 0;
  return html`<div class="card numeri-card">
    <${StatTile} label="Settimana" value=${settimana} unit=${`di ${previste}`} />
    <${StatTile} label=${cap(MESI[parseDay(oggi).getMonth()])} value=${nelMese} unit=${nelMese === 1 ? 'seduta' : 'sedute'} />
    <${StatTile} label="Durata media" value=${media ? Math.round(media / 60) : '–'} unit=${media ? 'min' : ''} />
  </div>`;
}

/* ---------- l'anno a colpo d'occhio: un pallino per giorno ---------- */

/** Settimane di fila (fino a questa) in cui hai fatto tutti gli allenamenti previsti. */
function settimaneDiFila(giorni, oggi, previste) {
  const obiettivo = Math.max(1, previste);
  const conta = lun => { let n = 0; for (let i = 0; i < 7; i++) if (giorni.has(addDaysIso(lun, i))) n++; return n; };
  let lun = isoDay(mondayOf(parseDay(oggi)));
  let fila = conta(lun) >= obiettivo ? 1 : 0; // la settimana in corso conta solo se è già completa
  for (let k = 0; k < 520; k++) {
    lun = addDaysIso(lun, -7);
    if (conta(lun) < obiettivo) break;
    fila++;
  }
  return fila;
}

function Anno({ sedute, oggi }) {
  const imp = S.impostazioni();
  const giorni = new Set(sedute.map(giornoSeduta));
  const anni = [...new Set([...giorni].map(g => +g.slice(0, 4)))];
  const annoOggi = +oggi.slice(0, 4);
  if (!anni.includes(annoOggi)) anni.push(annoOggi);
  anni.sort((a, b) => a - b);
  const [anno, setAnno] = useState(annoOggi);
  let previste = 0;
  for (let d = 1; d <= 7; d++) if (sedutaDelGiorno(imp, d)) previste++;
  const fila = settimaneDiFila(giorni, oggi, previste);

  // colonne = settimane (da lunedì), righe = giorni
  const primo = `${anno}-01-01`, ultimo = `${anno}-12-31`;
  const inizio = isoDay(mondayOf(parseDay(primo)));
  const colonne = [];
  for (let lun = inizio; lun <= ultimo; lun = addDaysIso(lun, 7)) colonne.push(lun);
  const P = 6.4, R = 2.25, W = colonne.length * P, H = 7 * P + 12;
  const fatti = [...giorni].filter(g => g.startsWith(String(anno))).length;
  const mesi = [];
  colonne.forEach((lun, c) => {
    const fine = addDaysIso(lun, 6);
    const m = +fine.slice(5, 7) - 1;
    if (fine.slice(0, 4) == anno && (!mesi.length || mesi[mesi.length - 1].m !== m) && +fine.slice(8) <= 7) mesi.push({ m, c });
  });
  const punti = [];
  colonne.forEach((lun, c) => {
    for (let r = 0; r < 7; r++) {
      const g = addDaysIso(lun, r);
      if (g < primo || g > ultimo) continue;
      const classe = giorni.has(g) ? 'fatto' : g > oggi ? 'futuro' : 'riposo';
      punti.push(html`<circle cx=${c * P + P / 2} cy=${12 + r * P + P / 2} r=${R} class=${classe + (g === oggi ? ' oggi' : '')} />`);
    }
  });
  const i = anni.indexOf(anno);
  return html`<div class="card anno-card">
    <div class="row-flex">
      <div class="grow">
        <div class="t-title3 num">${anno}</div>
        <div class="t-foot secondary">${plural(fatti, 'allenamento', 'allenamenti')}</div>
      </div>
      <div class="anno-fila" aria-label=${`${plural(fila, 'settimana', 'settimane')} di fila con tutti gli allenamenti`}>
        <${Icon} name="flame" size=${20} /><span class="num">${fila}</span>
      </div>
      <${IconButton} icon="chevronLeft" label="Anno prima" disabled=${i <= 0} onClick=${() => setAnno(anni[i - 1])} />
      <${IconButton} icon="chevronRight" label="Anno dopo" disabled=${i >= anni.length - 1} onClick=${() => setAnno(anni[i + 1])} />
    </div>
    <svg class="anno-griglia" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`${anno}: ${plural(fatti, 'giorno', 'giorni')} di allenamento`}>
      ${mesi.map(({ m, c }) => html`<text x=${c * P + 1} y="7">${cap(MESI_BREVI[m])}</text>`)}
      ${punti}
    </svg>
    <div class="anno-legenda t-cap secondary">
      <span><i class="riposo"></i>Riposo</span><span><i class="fatto"></i>Allenamento</span>
      <span class="grow"></span><span>${plural(fila, 'settimana', 'settimane')} di fila</span>
    </div>
  </div>`;
}

/* ---------- serie per muscolo (una settimana alla volta) ---------- */

function Muscoli({ sedute, oggi }) {
  const [sett, setSett] = useState(0); // 0 = questa settimana, -1 = la scorsa…
  const imp = S.impostazioni();
  const pers = A.esercizi();
  const da = addDaysIso(isoDay(mondayOf(parseDay(oggi))), sett * 7);
  const a = addDaysIso(da, 6);
  const conta = seriePerGruppo(sedute, da, a, nome => gruppoDi(nome, pers));
  // gruppi della scheda attiva (anche a zero) più quelli allenati
  const inScheda = new Set();
  for (let d = 1; d <= 7; d++) {
    const cod = sedutaDelGiorno(imp, d);
    for (const r of imp.schede[cod]?.righe || []) { const g = gruppoDi(r.ex, pers); if (g) inScheda.add(g); }
  }
  for (const c of conta) inScheda.add(c.gruppo);
  const righe = Object.keys(GRUPPI).filter(g => inScheda.has(g))
    .map(g => ({ chiave: g, etichetta: GRUPPI[g], valore: conta.find(c => c.gruppo === g)?.serie || 0 }));
  const totale = righe.reduce((t, r) => t + r.valore, 0);
  const primo = sedute.at(-1) ? giornoSeduta(sedute.at(-1)) : oggi;
  const titoloSett = sett === 0 ? 'Questa settimana' : sett === -1 ? 'Settimana scorsa' : `${-sett} settimane fa`;
  return html`
    <div class="section-title"><h2>Serie per muscolo</h2></div>
    <${Card}>
      <div class="naviga-sett">
        <${IconButton} icon="chevronLeft" label="Settimana prima" size=${16}
          style=${addDaysIso(da, -7) < isoDay(mondayOf(parseDay(primo))) ? 'opacity:.3;pointer-events:none' : null}
          onClick=${() => setSett(s => s - 1)} />
        <span class="grow center">
          <span class="t-sub w-semibold">${titoloSett}</span>
          <span class="t-foot secondary num"> · ${giornoBreve(da)} - ${giornoBreve(a)}</span>
        </span>
        <${IconButton} icon="chevronRight" label="Settimana dopo" size=${16}
          style=${sett >= 0 ? 'opacity:.3;pointer-events:none' : null} onClick=${() => setSett(s => Math.min(0, s + 1))} />
      </div>
      ${righe.length ? html`<${BarreOrizzontali} righe=${righe} fascia=${{ min: 10, max: 20 }} max=${22}
          etichetta=${`Serie per muscolo, ${titoloSett.toLowerCase()}: ${righe.map(r => `${r.etichetta} ${r.valore}`).join(', ')}`} />
        <div class="ch-legenda">
          <span><i class="ch-chiave fascia"></i>10-20 serie a settimana: la fascia indicativa per crescere</span>
        </div>
        <p class="t-foot secondary mt-8">${plural(totale, 'serie fatta', 'serie fatte')}. Conta il muscolo principale di ogni esercizio. La scheda dà la priorità alla parte alta: è normale che le gambe abbiano meno serie.</p>`
      : html`<p class="t-sub secondary">Nessuna serie in questa settimana.</p>`}
    <//>`;
}

/* ---------- un esercizio nel tempo ---------- */

const METRICHE = [
  { value: 'forza', label: 'Forza' },
  { value: 'kg', label: 'Carico' },
  { value: 'reps', label: 'Ripetizioni' },
];

function Esercizio({ sedute, oggi }) {
  const fatti = eserciziFatti(sedute);
  const [nome, setNome] = useState(() => {
    const p = pref('esercizioGrafico', null);
    return fatti.includes(p) ? p : fatti.includes('Panca piana') ? 'Panca piana' : fatti[0];
  });
  const [metrica, setMetrica] = useState(() => pref('metricaGrafico', 'forza'));
  const scegli = n => { setNome(n); setPref('esercizioGrafico', n); };
  const cambiaMetrica = m => { setMetrica(m); setPref('metricaGrafico', m); };
  const attuale = fatti.includes(nome) ? nome : fatti[0];
  if (!attuale) return null;

  const punti = puntiEsercizio(sedute, attuale);
  const corpoLibero = punti.every(p => p.kg <= 0);
  const m = corpoLibero ? 'reps' : metrica;
  const valore = p => (m === 'forza' ? p.forza : m === 'kg' ? p.kg : p.reps);
  const unita = m === 'reps' ? 'rip.' : 'kg';
  const dati = punti.map(p => ({ giorno: giornoSeduta(p), y: valore(p), cavo: p.scarico, p }));
  const record = serieMigliore(punti.flatMap(p => p.sets.filter(x => !p.scarico)));
  const primo = punti[0], ultimo = punti.at(-1);
  const eq = ATTREZZI[attrezzoDi(attuale, A.esercizi())];

  const fumetto = q => ({
    valore: `${fmtNum(q.y)} ${unita}`,
    data: cap(formatDayLong(parseDay(q.giorno))),
    righe: [{ testo: setsTesto(q.p.sets) }, ...(q.p.scarico ? [{ testo: 'Settimana di scarico' }] : [])],
  });
  const descr = `${attuale}: ${METRICHE.find(x => x.value === m).label.toLowerCase()} in ${plural(punti.length, 'seduta', 'sedute')}, da ${fmtNum(valore(primo))} a ${fmtNum(valore(ultimo))} ${unita}.`;

  return html`
    <div class="section-title"><h2>Esercizio</h2></div>
    <${Card} class="esercizio-card">
      <button type="button" class="scegli-esercizio" onClick=${() => { aptico(); apriSceltaEsercizio(attuale, fatti, scegli); }}>
        <span class="grow">
          <span class="t-headline ellipsis">${attuale}</span>
          <span class="t-foot secondary">${plural(punti.length, 'seduta', 'sedute')}${eq ? ' · ' + eq.nome.toLowerCase() : ''}</span>
        </span>
        <${Icon} name="chevronDown" size=${16} class="tertiary" />
      </button>
      <div class="es-stat">
        <${StatTile} small label="Record" value=${record ? (record.kg > 0 ? `${fmtNum(record.kg)} × ${record.reps}` : `${record.reps} rip.`) : '–'} />
        ${!corpoLibero && html`<${StatTile} small label="Forza stimata" value=${fmtNum(ultimo.forza)} unit="kg"
          foot=${punti.length > 1 ? `${fmtDelta(ultimo.forza - primo.forza)} kg dalla prima` : 'prima seduta'} />`}
        ${corpoLibero && html`<${StatTile} small label="Ripetizioni" value=${ultimo.reps}
          foot=${punti.length > 1 ? `${fmtDelta(ultimo.reps - primo.reps, 0)} dalla prima` : 'prima seduta'} />`}
      </div>
      ${!corpoLibero && html`<div class="mt-12"><${Segmented} options=${METRICHE} value=${m} onChange=${cambiaMetrica} label="Cosa mostrare" /></div>`}
      <div class="mt-16">
        <${GraficoTempo} punti=${dati} dominio=${[dati[0].giorno, oggi > dati.at(-1).giorno ? oggi : dati.at(-1).giorno]}
          fmtY=${v => fmtNum(v)} fumetto=${fumetto} etichetta=${descr} area altezza=${180}
          minSpan=${m === 'reps' ? 4 : Math.max(5, valore(ultimo) * 0.1)} />
      </div>
      <p class="t-foot secondary mt-8">${m === 'forza'
        ? 'Forza stimata: il peso che alzeresti per una ripetizione, calcolato dalla serie migliore di ogni seduta.'
        : m === 'kg' ? 'Il peso più alto usato in ogni seduta.' : 'Le ripetizioni di tutte le serie di ogni seduta.'}
        ${punti.some(p => p.scarico) ? ' I punti vuoti sono settimane di scarico.' : ''}</p>
    <//>
    <${SectionLabel}>Ultime volte<//>
    <div class="list">
      ${[...punti].reverse().slice(0, 6).map(p => html`<div class="row">
        <span class="row-main">
          <span class="row-title">${cap(formatDayShort(new Date(p.data)))}${p.scarico ? html` <span class="t-foot secondary">· scarico</span>` : ''}</span>
          <span class="row-sub num">${setsTesto(p.sets)}</span>
        </span>
        ${!corpoLibero && html`<span class="row-detail num">${fmtNum(p.forza)} kg</span>`}
      </div>`)}
    </div>`;
}

function apriSceltaEsercizio(attuale, fatti, scegli) {
  apriFoglio(chiudi => html`<${SceltaEsercizio} attuale=${attuale} fatti=${fatti} onScegli=${n => { scegli(n); chiudi(); }} />`,
    { titolo: 'Scegli esercizio', alto: true });
}

function SceltaEsercizio({ attuale, fatti, onScegli }) {
  const [q, setQ] = useState('');
  const imp = S.impostazioni();
  const sedute = A.sessioni();
  const visti = new Set();
  const gruppi = [];
  for (const cod of ['A', 'B', 'G', 'C', 'F']) {
    const sc = imp.schede[cod];
    if (!sc) continue;
    const nomi = sc.righe.map(r => r.ex).filter(n => !visti.has(n) && fatti.includes(n));
    nomi.forEach(n => visti.add(n));
    if (nomi.length) gruppi.push({ titolo: sc.nome, tono: sc.tono, nomi });
  }
  const altri = fatti.filter(n => !visti.has(n));
  if (altri.length) gruppi.push({ titolo: 'Altri esercizi', nomi: altri });
  const filtro = normalizza(q);
  const vis = gruppi.map(g => ({ ...g, nomi: g.nomi.filter(n => !filtro || normalizza(n).includes(filtro)) })).filter(g => g.nomi.length);
  return html`<div>
    <label class="search"><${Icon} name="search" /><input type="search" placeholder="Cerca" value=${q}
      onInput=${e => setQ(e.currentTarget.value)} aria-label="Cerca esercizio" /></label>
    ${vis.map(g => html`
      <div class="section-label">${g.titolo}</div>
      <div class="list">
        ${g.nomi.map(n => {
          const pt = puntiEsercizio(sedute, n);
          const u = pt.at(-1);
          return html`<button type="button" class="row" onClick=${() => { aptico(); onScegli(n); }}>
            <span class="row-main">
              <span class="row-title">${n}</span>
              <span class="row-sub num">${u ? `${plural(pt.length, 'seduta', 'sedute')} · ultima ${setsTesto(u.sets.slice(0, 1))}` : ''}</span>
            </span>
            ${n === attuale && html`<${Icon} name="checkBold" size=${16} class="accent" />`}
          </button>`;
        })}
      </div>`)}
    ${!vis.length && html`<${EmptyState} icon="search" title="Nessun esercizio" text="Prova con un altro nome." />`}
  </div>`;
}

/* ---------- storico delle sedute ---------- */

function Storico({ sedute }) {
  const [quante, setQuante] = useState(12);
  const lista = sedute.slice(0, quante);
  const mesi = [];
  for (const s of lista) {
    const d = new Date(s.data);
    const k = `${cap(MESI[d.getMonth()])} ${d.getFullYear()}`;
    if (mesi.at(-1)?.k !== k) mesi.push({ k, sedute: [] });
    mesi.at(-1).sedute.push(s);
  }
  return html`
    <div class="section-title"><h2>Storico</h2><span class="t-foot secondary">${plural(sedute.length, 'seduta', 'sedute')}</span></div>
    ${mesi.map(m => html`
      <div class="section-label">${m.k}</div>
      <div class="list">${m.sedute.map(s => html`<${RigaSeduta} key=${s.id} s=${s} />`)}</div>`)}
    ${sedute.length > quante && html`<div class="center mt-8"><button type="button" class="btn btn-plain" onClick=${() => setQuante(q => q + 20)}>Mostra altre</button></div>`}`;
}

function RigaSeduta({ s }) {
  const st = statistiche(s);
  const d = new Date(s.data);
  return html`<button type="button" class="row riga-seduta" onClick=${() => { aptico(); apriSeduta(s.id); }}>
    <span class="pallino-tono" style=${`--tono:${coloreTono(s.tono)}`} aria-hidden="true"></span>
    <span class="row-main">
      <span class="row-title">${s.nome}</span>
      <span class="row-sub num">${GIORNI_BREVI[weekdayIt(d)]} ${formatDayShort(d)} · ${ora(s.data)} · ${plural(st.serie, 'serie', 'serie')}</span>
    </span>
    <span class="row-detail num">${fmtMinutes(st.durata)}</span>
    <${Icon} name="chevronRight" class="chev" size=${14} />
  </button>`;
}

/** Dettaglio di una seduta passata: serie di ogni esercizio, record, note. Si può eliminare. */
export function apriSeduta(id) {
  const s = S.leggi('sessione', id);
  if (!s) return;
  apriFoglio(chiudi => html`<${DettaglioSeduta} id=${id} chiudi=${chiudi} />`, { alto: true, titolo: s.nome });
}

function DettaglioSeduta({ id, chiudi }) {
  const [conferma, setConferma] = useState(false);
  const s = S.leggi('sessione', id);
  if (!s) return html`<${EmptyState} icon="dumbbell" title="Seduta eliminata" />`;
  const st = statistiche(s);
  const rec = recordBattuti(A.sessioni(), s);
  const d = new Date(s.data);
  return html`<div class="dettaglio-seduta">
    <div class="ds-testa">
      <span class="t-sub secondary">${cap(formatDayLong(d))} · ${ora(s.data)}</span>
      <div class="ds-chip">
        ${s.settimana && html`<${Chip}>Settimana ${s.settimana}<//>`}
        ${s.scarico && html`<${Chip} kind="accent">Scarico<//>`}
        ${rec.length > 0 && html`<${Chip} icon="trophy" kind="accent">${plural(rec.length, 'record', 'record')}<//>`}
      </div>
    </div>
    <div class="rp-stat tre">
      <div class="card"><${StatTile} label="Durata" icon="clock" value=${fmtMinutes(st.durata)} /></div>
      <div class="card"><${StatTile} label="Serie" icon="dumbbell" value=${st.serie} /></div>
      <div class="card"><${StatTile} label="Volume" icon="chart" value=${fmtInt(st.volume)} unit="kg" /></div>
    </div>
    ${s.voci.map(v => {
      const sets = serieFatte(v);
      if (!sets.length) return null;
      const r = rec.find(x => x.ex === v.ex);
      return html`<div class="card ds-es">
        <div class="ds-es-testa">
          <span class="t-headline grow">${v.ex}</span>
          ${r && html`<${Icon} name="trophy" size=${16} class="accent" label="Record" />`}
        </div>
        <div class="ds-serie">
          ${sets.map((x, i) => html`<div class="ds-serie-riga num">
            <span class="ds-n">${i + 1}</span>
            <span>${x.kg > 0 ? `${fmtNum(x.kg)} kg` : 'corpo libero'}</span>
            <span>× ${x.reps}</span>
            <span class="tertiary">${x.kg > 0 ? `${fmtNum(Math.round(forzaStimata(x.kg, x.reps) * 2) / 2)} kg 1RM` : ''}</span>
          </div>`)}
        </div>
        ${v.pulita === false && html`<div class="t-foot secondary mt-8">Tecnica non del tutto pulita</div>`}
        ${v.nota && html`<div class="ex-note">${v.nota}</div>`}
      </div>`;
    })}
    <div class="center mt-24">
      ${conferma
        ? html`<${Button} kind="danger" block onClick=${() => { A.annullaAllenamento(id); aptico(); chiudi(); toast('Allenamento eliminato', 'trash'); }}>Elimina definitivamente<//>`
        : html`<button type="button" class="btn btn-plain danger" onClick=${() => setConferma(true)}>Elimina allenamento</button>`}
    </div>
  </div>`;
}
