// Allenamento a tutto schermo: serie da spuntare, tastierino, timer di recupero, sostituzioni, riepilogo.

import { html, useState, useEffect, useRef } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import * as R from '../data/rest.js';
import { Button, IconButton, Chip, Toggle, StatTile } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, apriMenu, toast } from '../ui/overlay.js';
import { aptico, suonoFine, schermoAcceso } from '../ui/haptics.js';
import { Tastierino, apriTastierino, chiudiTastierino, testoCampo, ascoltaTastierino } from '../ui/keypad.js';
import { useOra } from './comuni.js';
import { fmtNum, fmtDuration, fmtRest, fmtSetsReps, fmtInt, fmtMinutes } from '../core/format.js';
import { ATTREZZI, CATALOGO, GRUPPI, REGOLE } from '../core/scheda.js';
import { ultimaVolta, statistiche } from '../core/progression.js';
import { normalizza } from '../core/foods.js';

const PASSO_KG = { bil: 2.5, man: 1, mac: 2.5, cav: 2.5, cl: 1.25 };
const ICONA_TIPO = { sali: 'arrowUpRight', aggiungi: 'plus', ripeti: 'sync', fermo: 'arrowDownRight', scarico: 'moonZ', primo: 'sparkles' };

/* =====================================================================
   Riga di una serie
   ===================================================================== */

export function SetRow({ numero, prec, kg, reps, kgSugg, repsSugg, fatto, focus, onKg, onReps, onCheck, etichetta, unitaKg }) {
  return html`<div class=${'set-row' + (fatto ? ' done' : '')} role="group" aria-label=${etichetta}>
    <span class="sr-num" aria-hidden="true">${numero}</span>
    <span class="sr-prev ellipsis" aria-label=${prec ? `Ultima volta ${prec}` : 'Nessun dato precedente'}>${prec || '–'}</span>
    <button type="button" class=${'sr-field' + (kgSugg ? ' sugg' : '') + (focus === 'kg' ? ' focus' : '')} onClick=${onKg}
      aria-label=${`${unitaKg}: ${kg ?? 'vuoto'}`}>${kg ?? '–'}</button>
    <button type="button" class=${'sr-field' + (repsSugg ? ' sugg' : '') + (focus === 'reps' ? ' focus' : '')} onClick=${onReps}
      aria-label=${`Ripetizioni: ${reps ?? 'vuoto'}`}>${reps ?? '–'}</button>
    <button type="button" class="sr-check" onClick=${onCheck} aria-pressed=${fatto ? 'true' : 'false'}
      aria-label=${fatto ? `Serie ${numero} completata, tocca per annullare` : `Completa la serie ${numero}`}>
      <${Icon} name="checkBold" />
    </button>
  </div>`;
}

/* =====================================================================
   Card di un esercizio
   ===================================================================== */

function EsercizioCard({ s, v, vi, sedute, settDrop, campo, onCampo }) {
  const prec = ultimaVolta(sedute, v.ex, s.id);
  const A_ = ATTREZZI[v.eq] || ATTREZZI.mac;
  const conSucc = v.ss != null && s.voci[vi + 1]?.ss === v.ss;
  const conPrec = v.ss != null && s.voci[vi - 1]?.ss === v.ss;
  const partner = conSucc ? s.voci[vi + 1] : conPrec ? s.voci[vi - 1] : null;
  const btnMenu = useRef(null);

  const menu = () => apriMenu(btnMenu.current, [
    { label: 'Sostituisci esercizio', icona: 'swap', azione: () => apriSostituzione(s, vi) },
    { label: v.nota ? 'Modifica nota' : 'Aggiungi nota', icona: 'pencil', azione: () => apriNota(s, vi) },
    { label: 'Aggiungi serie', icona: 'plus', azione: () => A.aggiungiSerie(s.id, vi) },
    ...(v.sets.length > 1 && !v.sets.at(-1).fatto ? [{ label: 'Togli l\'ultima serie', icona: 'minus', azione: () => A.rimuoviSerie(s.id, vi) }] : []),
    '-',
    { label: 'Regole di esecuzione', icona: 'info', azione: apriRegole },
  ]);

  const apriCampo = (si, tipo) => onCampo(vi, si, tipo);

  return html`<article class=${'ex-card tono-' + s.tono + (conSucc ? ' paired-top' : '') + (conPrec ? ' paired-bottom' : '')}
    id=${'ex-' + vi} aria-label=${v.ex}>
    ${conPrec && html`<div class="ss-link"><${Icon} name="link" size=${14} />Subito dopo ${partner.ex}</div>`}
    <div class="ex-head">
      <div class="grow">
        <div class="ex-name">${v.ex}</div>
        <div class="ex-meta">
          <span class="num">${fmtSetsReps(v.sets.length, v.min, v.max)}</span>
          <span aria-hidden="true">·</span>
          <span>${conSucc ? 'senza pausa' : 'recupero ' + fmtRest(v.recMin, v.recMax)}</span>
          ${v.eq === 'man' && html`<${Chip} tono=${s.tono}>kg per manubrio<//>`}
          ${v.eq === 'cl' && html`<${Chip}>kg di zavorra<//>`}
          ${conSucc && html`<${Chip} tono=${s.tono} icon="link">Superserie<//>`}
        </div>
      </div>
      <button type="button" ref=${btnMenu} class="icon-btn plain" style="color:var(--label-2)" onClick=${() => { aptico(); menu(); }} aria-label=${'Altre azioni per ' + v.ex}>
        <${Icon} name="ellipsisCircle" size=${24} />
      </button>
    </div>
    <div class="ex-hint"><${Icon} name=${ICONA_TIPO[v.tipo] || 'sparkles'} /><span>${v.msg}</span></div>
    ${prec?.nota && html`<div class="ex-note"><b>Nota dell'ultima volta:</b> ${prec.nota}</div>`}
    ${v.nota && html`<div class="ex-note">${v.nota}</div>`}
    <div class="sets-head" aria-hidden="true"><span>Serie</span><span>Precedente</span><span>${v.eq === 'man' ? 'kg/man.' : v.eq === 'cl' ? '+kg' : 'kg'}</span><span>Rip.</span><span></span></div>
    ${v.sets.map((x, si) => {
      const val = A.valoriSerie(v, si);
      const p = prec?.sets[si];
      const chiaveKg = `${vi}-${si}-kg`, chiaveReps = `${vi}-${si}-reps`;
      const tKg = testoCampo(chiaveKg), tReps = testoCampo(chiaveReps);
      const drop = settDrop && v.drop && si === v.sets.length - 1 && !s.scarico;
      return html`
        <${SetRow} numero=${si + 1}
          prec=${p ? `${fmtNum(p.kg)} × ${p.reps}` : null}
          kg=${tKg != null ? (tKg || '0') : val.kg == null ? null : fmtNum(val.kg)}
          reps=${tReps != null ? (tReps || '0') : val.reps}
          kgSugg=${tKg == null && val.kgSuggerito && !x.fatto} repsSugg=${tReps == null && val.repsSuggerito && !x.fatto}
          fatto=${x.fatto}
          focus=${campo === chiaveKg ? 'kg' : campo === chiaveReps ? 'reps' : null}
          unitaKg=${A_.peso}
          etichetta=${`Serie ${si + 1} di ${v.ex}`}
          onKg=${() => apriCampo(si, 'kg')} onReps=${() => apriCampo(si, 'reps')}
          onCheck=${() => onCampo(vi, si, 'check')} />
        ${drop && html`<div class="sr-drop-row"><${Icon} name="flame" size=${14} />Drop set: a cedimento, poi ${val.kg ? fmtNum(Math.round(val.kg * 0.75 * 2) / 2) + ' kg' : '-25%'} e di nuovo a cedimento. Segna solo la serie normale.</div>`}`;
    })}
    <div class="clean-row">
      <span>Tecnica pulita in tutte le serie</span>
      <${Toggle} small checked=${v.pulita !== false} label="Tecnica pulita" onChange=${on => A.impostaPulita(s.id, vi, on)} />
    </div>
  </article>`;
}

/* =====================================================================
   Fogli: sostituzione, nota, regole, conferme
   ===================================================================== */

function apriSostituzione(s, vi) {
  apriFoglio(chiudi => html`<${Sostituzione} sessione=${s.id} vi=${vi} chiudi=${chiudi} />`, { titolo: 'Sostituisci esercizio', alto: true });
}

function Sostituzione({ sessione, vi, chiudi }) {
  const s = S.leggi('sessione', sessione);
  const v = s?.voci[vi];
  const [cerca, setCerca] = useState('');
  const [anche, setAnche] = useState(false);
  const [nuovo, setNuovo] = useState(null);
  if (!v) return null;
  const pers = A.esercizi();
  const tutti = [...CATALOGO, ...pers.map(e => ({ nome: e.nome, gruppo: e.gruppo, eq: e.eq }))];
  const gruppo = v.gruppo || tutti.find(e => e.nome === v.ex)?.gruppo;
  const q = normalizza(cerca);
  const lista = tutti.filter(e => e.nome !== v.ex && (q ? normalizza(e.nome).includes(q) : e.gruppo === gruppo));
  const scegli = nome => { aptico('successo'); A.sostituisciEsercizio(sessione, vi, nome, anche); chiudi(); toast(`${nome} al posto di ${v.ex}`, 'swap'); };

  if (nuovo) {
    return html`<div class="col gap-12">
      <label class="field-label" for="nuovo-nome">Nome</label>
      <input id="nuovo-nome" class="field" value=${nuovo.nome} placeholder="Es. Panca alla Smith machine"
        onInput=${e => setNuovo({ ...nuovo, nome: e.currentTarget.value })} />
      <span class="field-label">Gruppo muscolare</span>
      <div class="scelte">${Object.entries(GRUPPI).map(([k, n]) => html`<button type="button" class=${'scelta' + (nuovo.gruppo === k ? ' on' : '')}
        onClick=${() => setNuovo({ ...nuovo, gruppo: k })}>${n}</button>`)}</div>
      <span class="field-label">Attrezzo</span>
      <div class="scelte">${Object.entries(ATTREZZI).map(([k, a]) => html`<button type="button" class=${'scelta' + (nuovo.eq === k ? ' on' : '')}
        onClick=${() => setNuovo({ ...nuovo, eq: k })}>${a.nome}</button>`)}</div>
      <div class="row-flex mt-8">
        <${Button} kind="secondary" onClick=${() => setNuovo(null)}>Indietro<//>
        <${Button} class="grow" disabled=${!nuovo.nome.trim()} onClick=${() => { const n = A.creaEsercizio(nuovo.nome, nuovo.gruppo, nuovo.eq); if (n) scegli(n); }}>Crea e usa<//>
      </div>
    </div>`;
  }

  return html`<div class="col gap-12">
    <div class="search"><${Icon} name="search" /><input type="search" placeholder="Cerca tra tutti gli esercizi" value=${cerca}
      onInput=${e => setCerca(e.currentTarget.value)} aria-label="Cerca esercizio" /></div>
    <div class="list">
      <label class="row">
        <span class="row-main"><span class="row-title">Cambia anche nella scheda</span><span class="row-sub">Altrimenti vale solo per oggi</span></span>
        <${Toggle} checked=${anche} onChange=${setAnche} label="Cambia anche nella scheda" />
      </label>
    </div>
    <div class="section-label" style="margin-top:8px">${q ? 'Risultati' : `Stesso gruppo · ${GRUPPI[gruppo] || ''}`}</div>
    <div class="list">
      ${lista.length ? lista.map(e => html`<button type="button" class="row" onClick=${() => scegli(e.nome)}>
        <span class="row-main"><span class="row-title">${e.nome}</span><span class="row-sub">${ATTREZZI[e.eq]?.nome || ''}${q ? ' · ' + (GRUPPI[e.gruppo] || '') : ''}</span></span>
        <${Icon} name="chevronRight" class="chev" size=${14} />
      </button>`) : html`<div class="row"><span class="secondary t-sub">Nessun esercizio trovato.</span></div>`}
    </div>
    <${Button} kind="tinted" block icon="plus" onClick=${() => setNuovo({ nome: cerca, gruppo: gruppo || 'petto', eq: 'mac' })}>Crea un esercizio<//>
  </div>`;
}

function apriNota(s, vi) {
  let testo = s.voci[vi].nota || '';
  apriFoglio(chiudi => html`<div class="col gap-12">
    <textarea class="field" rows="4" placeholder="Es. sedile alla tacca 4, presa stretta" onInput=${e => { testo = e.currentTarget.value; }}
      ref=${el => el && !el.dataset.f && (el.dataset.f = 1, setTimeout(() => el.focus(), 350))}>${testo}</textarea>
    <${Button} block onClick=${() => { A.impostaNota(s.id, vi, testo.trim()); chiudi(); }}>Salva nota<//>
  </div>`, { titolo: s.voci[vi].ex });
}

export function apriRegole() {
  apriFoglio(() => html`<div class="col gap-12">
    ${REGOLE.map(r => html`<div class="regola">
      <span class="co-icon"><${Icon} name=${r.icona} /></span>
      <div><div class="t-headline">${r.titolo}</div><p class="t-sub secondary mt-4">${r.testo}</p></div>
    </div>`)}
  </div>`, { titolo: 'Regole di esecuzione' });
}

function conferma({ titolo, testo, ok, okKind = 'primary', annulla = 'Continua allenamento', onOk }) {
  apriFoglio(chiudi => html`<div class="conferma">
    <div class="t-title3 center">${titolo}</div>
    ${testo && html`<p class="t-sub secondary center mt-8">${testo}</p>`}
    <div class="col gap-8 mt-24">
      <${Button} kind=${okKind} block onClick=${() => { chiudi(); onOk(); }}>${ok}<//>
      <${Button} kind="secondary" block onClick=${chiudi}>${annulla}<//>
    </div>
  </div>`, { destra: null });
}

/* =====================================================================
   Barra del recupero
   ===================================================================== */

function BarraRecupero({ sessioneId }) {
  const [st, setSt] = useState(R.statoRecupero());
  const [finito, setFinito] = useState(false);
  useEffect(() => R.ascolta(setSt), []);
  const attivo = !!st.fine && (!st.sessione || st.sessione === sessioneId);
  const ora = useOra(250, attivo || finito);
  const rest = R.rimanente(ora);

  useEffect(() => {
    if (attivo && rest <= 0) {
      R.concluso();
      if (!document.hidden) {
        suonoFine();
        aptico('successo');
        setFinito(true);
        setTimeout(() => setFinito(false), 2600);
      }
    }
  }, [attivo, rest]);

  const on = (attivo && rest > 0) || finito;
  const quota = attivo && st.totale ? Math.max(0, Math.min(1, rest / st.totale)) : 0;
  return html`<div class=${'rest-bar' + (on ? ' on' : '')} role="timer" aria-live="off" aria-hidden=${on ? null : 'true'}>
    ${finito ? html`
      <div class="grow"><div class="rb-label">Recupero finito</div><div class="t-headline">Via con la prossima serie</div></div>
      <${Icon} name="checkCircle" size=${30} class="accent" />`
    : html`
      <div class="grow" style="min-width:0">
        <div class="rb-label"><b>Recupero</b>${st.prossimo ? ` · poi ${st.prossimo}` : ''}</div>
        <div class="rb-time" aria-label=${`Recupero: mancano ${rest} secondi`}>${fmtDuration(rest)}</div>
      </div>
      <button type="button" class="rb-btn" onClick=${() => { aptico(); R.aggiungi(-15); }} aria-label="Togli 15 secondi">−15</button>
      <button type="button" class="rb-btn" onClick=${() => { aptico(); R.aggiungi(15); }} aria-label="Aggiungi 15 secondi">+15</button>
      <button type="button" class="rb-btn skip" onClick=${() => { aptico(); R.salta(); }}>Salta</button>
      <span class="rb-line" style=${`width:${quota * 100}%`}></span>`}
  </div>`;
}

/* =====================================================================
   Riepilogo
   ===================================================================== */

/** Apre il riepilogo di un allenamento già finito (dalla scheda Oggi). */
export function apriRiepilogo(sessione) {
  const r = A.riepilogo(sessione);
  apriFoglio(chiudi => html`<${Riepilogo} r=${r} onFatto=${chiudi} />`, { alto: true, titolo: 'Riepilogo' });
}

function Riepilogo({ r, onFatto, conIntestazione }) {
  const s = r.sessione;
  return html`<div class="riepilogo">
    ${conIntestazione && html`<div class="rp-top">
      <div class="rp-check pop"><${Icon} name="checkBold" size=${36} /></div>
      <div class="t-title1 center">Allenamento completato</div>
      <div class="t-sub secondary center">${s.nome} · ${fmtMinutes(r.stat.durata)}</div>
    </div>`}
    <div class="rp-stat">
      <div class="card"><${StatTile} label="Durata" icon="clock" value=${fmtDuration(r.stat.durata)} /></div>
      <div class="card"><${StatTile} label="Serie" icon="dumbbell" value=${r.stat.serie} /></div>
      <div class="card"><${StatTile} label="Volume" icon="chart" value=${fmtInt(r.stat.volume)} unit="kg" /></div>
      <div class="card"><${StatTile} label="Record" icon="trophy" value=${r.record.length} /></div>
    </div>
    ${r.record.length > 0 && html`<div class="section-label">Nuovi record</div>
      <div class="list">${r.record.map(x => html`<div class="row has-icon">
        <span class="row-icon" style="--tile:var(--tono-ambra)"><${Icon} name="trophy" /></span>
        <span class="row-main"><span class="row-title">${x.ex}</span></span>
        <span class="row-detail num">${fmtNum(x.kg)} kg × ${x.reps}</span>
      </div>`)}</div>`}
    <div class="section-label">Rispetto alla volta prima e prossima volta</div>
    <div class="list">${r.prossima.map(p => html`<div class="row rp-esercizio">
      <span class="row-main">
        <span class="row-title">${p.ex}</span>
        ${p.confronto && html`<span class="row-sub num">${p.confronto.testo}</span>`}
        <span class=${'rp-consiglio' + (p.tipo === 'sali' ? ' sali' : '')}>
          ${p.tipo === 'sali' && html`<${Icon} name="arrowUp" size=${12} />`}${p.msg}
        </span>
      </span>
      <span class="prossima-val num">${p.kg != null ? `${fmtNum(p.kg)} kg` : ''}<small>${p.reps.length} × ${p.reps[0]}</small></span>
    </div>`)}</div>
    <div class="mt-24"><${Button} block onClick=${onFatto}>Fatto<//></div>
  </div>`;
}

/* =====================================================================
   Schermata dell'allenamento
   ===================================================================== */

export function Allenamento({ aperto, sessione, onChiudi }) {
  const [on, setOn] = useState(false);
  const [riep, setRiep] = useState(null);
  const [campo, setCampo] = useState(null);
  const corpo = useRef(null);
  const ora = useOra(1000, aperto && !!sessione);
  useEffect(() => ascoltaTastierino(st => setCampo(st?.chiave || null)), []);

  const visibile = aperto && (!!sessione || !!riep);
  useEffect(() => {
    if (visibile) requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    else setOn(false);
  }, [visibile]);
  useEffect(() => { schermoAcceso(aperto && !!sessione); }, [aperto, !!sessione]);
  useEffect(() => { if (!aperto) chiudiTastierino(); }, [aperto]);
  // se l'allenamento è stato chiuso altrove (es. da un altro dispositivo) chiudo la schermata
  useEffect(() => { if (aperto && !sessione && !riep) onChiudi(); }, [aperto, sessione, riep]);

  const s = sessione;
  const sedute = A.sessioni();

  const vaiAlCampo = (vi, si, tipo) => {
    const v = S.leggi('sessione', s.id)?.voci[vi];
    if (!v) return;
    if (tipo === 'check') {
      chiudiTastierino();
      const r = A.spuntaSerie(s.id, vi, si);
      if (r.serveKg) { aptico(); toast('Scrivi prima i kg della serie', 'info'); vaiAlCampo(vi, si, 'kg'); return; }
      if (r.fatto) {
        aptico('successo');
        if (r.recupero) R.avvia(r.recupero, r.prossimo, s.id);
        else if (r.prossimo) { R.salta(); toast(`Subito: ${r.prossimo}`, 'link'); }
      } else aptico();
      return;
    }
    const val = A.valoriSerie(v, si);
    const avanti = () => {
      if (tipo === 'kg') return vaiAlCampo(vi, si, 'reps');
      // dalle ripetizioni: completo la serie e passo alla successiva
      const fatto = S.leggi('sessione', s.id)?.voci[vi]?.sets[si]?.fatto;
      if (!fatto) vaiAlCampo(vi, si, 'check');
      else chiudiTastierino();
    };
    apriTastierino({
      chiave: `${vi}-${si}-${tipo}`,
      titolo: html`<b>${v.ex}</b> · serie ${si + 1} · ${tipo === 'kg' ? (ATTREZZI[v.eq]?.peso || 'kg') : 'ripetizioni'}`,
      valore: tipo === 'kg' ? val.kg : val.reps,
      decimali: tipo === 'kg',
      passo: tipo === 'kg' ? (PASSO_KG[v.eq] || 2.5) : 1,
      etichettaAvanti: tipo === 'kg' ? 'Avanti' : (v.sets[si].fatto ? 'Fine' : 'Completa'),
      onCambia: n => A.aggiornaSerie(s.id, vi, si, tipo === 'kg' ? { kg: n } : { reps: n == null ? null : Math.round(n) }),
      onAvanti: avanti,
    });
    // porto la riga in vista sopra il tastierino
    setTimeout(() => document.getElementById('ex-' + vi)?.querySelectorAll('.set-row')[si]?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  };

  const fine = () => {
    const st = statistiche(s);
    if (!st.serie) {
      conferma({ titolo: 'Nessuna serie completata', testo: 'Se chiudi ora l\'allenamento non viene salvato.', ok: 'Elimina allenamento', okKind: 'danger',
        onOk: () => { R.salta(); A.annullaAllenamento(s.id); onChiudi(); } });
      return;
    }
    conferma({
      titolo: 'Terminare l\'allenamento?',
      testo: st.serie < st.totali ? `Hai completato ${st.serie} serie su ${st.totali}. Quelle non spuntate non vengono salvate.` : 'Ottimo lavoro: tutte le serie completate.',
      ok: 'Termina e salva',
      onOk: () => {
        R.salta();
        chiudiTastierino();
        const r = A.terminaAllenamento(s.id);
        if (r) { aptico('successo'); setRiep(r); corpo.current?.scrollTo({ top: 0 }); } else onChiudi();
      },
    });
  };

  const menuTesta = e => apriMenu(e.currentTarget, [
    { label: 'Regole di esecuzione', icona: 'info', azione: apriRegole },
    '-',
    { label: 'Annulla allenamento', icona: 'trash', pericolo: true, azione: () => conferma({
      titolo: 'Annullare l\'allenamento?', testo: 'Le serie di oggi verranno cancellate.', ok: 'Annulla allenamento', okKind: 'danger', annulla: 'Continua',
      onOk: () => { R.salta(); A.annullaAllenamento(s.id); onChiudi(); } }) },
  ]);

  // ----- riepilogo dopo la fine
  if (riep) {
    return html`<div class=${'workout' + (on ? ' on' : '')} role="dialog" aria-label="Riepilogo allenamento">
      <div class="workout-body" ref=${corpo}><div class="inner" style="padding-top:calc(var(--safe-top) + 12px)">
        <${Riepilogo} r=${riep} conIntestazione onFatto=${() => { setRiep(null); onChiudi(); }} />
      </div></div>
    </div>`;
  }

  if (!s) return html`<div class="workout" aria-hidden="true"></div>`;

  const st = statistiche(s);
  const durata = (ora - new Date(s.data)) / 1000;
  const sc = S.impostazioni().schede[s.codice];

  return html`<div class=${'workout' + (on ? ' on' : '') + (campo ? ' con-tastierino' : '')} role="dialog" aria-label=${'Allenamento ' + s.nome}>
    <header class="workout-head">
      <div class="wh-row">
        <${IconButton} icon="chevronDown" label="Riduci" onClick=${onChiudi} class="plain" />
        <div class="wh-title">
          <b>${s.nome}</b>
          <span>${fmtDuration(durata)} · ${st.serie}/${st.totali} serie</span>
        </div>
        <${IconButton} icon="ellipsisCircle" label="Altre azioni" onClick=${menuTesta} class="plain" />
        <${Button} kind="tinted" small onClick=${fine}>Fine<//>
      </div>
      <div class="wh-progress"><i style=${`width:${st.totali ? (st.serie / st.totali) * 100 : 0}%`}></i></div>
    </header>
    <div class="workout-body" ref=${corpo}>
      <div class="inner">
        <div class="wo-chips">
          <${Chip} tono=${s.tono}>${sc?.sotto || s.nome}<//>
          <${Chip}>Settimana ${s.settimana} · ciclo ${s.ciclo}/8<//>
          ${s.scarico && html`<${Chip} kind="warning" icon="moonZ">Scarico: metà serie, -10%<//>`}
        </div>
        <button type="button" class="riscaldamento" onClick=${apriRegole}>
          <span class="co-icon"><${Icon} name="flame" /></span>
          <span class="grow"><b>Riscaldamento</b><span class="secondary"> · 5 min leggeri + 2 serie progressive</span></span>
          <${Icon} name="chevronRight" size=${14} class="chev" />
        </button>
        ${s.voci.map((v, vi) => html`<${EsercizioCard} key=${vi + v.ex} s=${s} v=${v} vi=${vi} sedute=${sedute}
          settDrop=${s.ciclo >= 5 && s.ciclo < 8} campo=${campo} onCampo=${vaiAlCampo} />`)}
        <div class="mt-24"><${Button} block icon="check" onClick=${fine}>Fine allenamento<//></div>
        <div class="center mt-8"><${Button} kind="plain" onClick=${e => menuTesta(e)}>Altre azioni<//></div>
      </div>
    </div>
    <${BarraRecupero} sessioneId=${s.id} />
    <${Tastierino} />
  </div>`;
}
