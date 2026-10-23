// Progressi → Diario: ogni 4 settimane (settimane 1, 4, 8, 12…) peso, panca, squat, rematore e qualche nota.
// Il modulo si compila da solo con l'ultimo peso e la serie migliore delle ultime 4 settimane.

import { html, useState } from '../lib/preact.js';
import * as A from '../data/actions.js';
import { Card, Button, EmptyState, Callout } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, apriMenu, toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { useOggi } from './comuni.js';
import { migliorePeriodo } from '../core/stats.js';
import { fmtNum, fmtKg1, fmtDelta, parseNum } from '../core/format.js';
import { parseDay, formatDayLong, cap, isoDay } from '../core/dates.js';

/** Esercizi del diario: campo, nome nella scheda, etichetta. */
const ALZATE = [
  { campo: 'panca', ex: 'Panca piana', nome: 'Panca' },
  { campo: 'squat', ex: 'Squat', nome: 'Squat' },
  { campo: 'rematore', ex: 'Rematore con bilanciere', nome: 'Rematore' },
];

const testoSerie = x => (x ? `${fmtNum(x.kg)} kg × ${x.reps}` : '');

export function Diario() {
  const oggi = useOggi();
  const w = A.settimana(oggi);
  const voci = A.diario();
  const fattaQuesta = voci.some(e => e.settimana === w.n);
  const prossima = w.n === 1 ? 4 : Math.ceil((w.n + 1) / 4) * 4;
  return html`
    ${w.diario && !fattaQuesta
      ? html`<${Callout} icon="book" title=${`Settimana ${w.n}: è settimana di diario`}
          text="Peso, panca, squat, rematore e due righe su come ti senti. Ci vuole un minuto." />`
      : html`<p class="section-foot pr-nota">Il diario si compila nelle settimane 1, 4, 8, 12… Ora sei alla ${w.n}${fattaQuesta ? ' e l\'hai già compilato' : `: il prossimo è alla ${prossima}`}.</p>`}
    <div class="mt-12"><${Button} block kind=${w.diario && !fattaQuesta ? 'primary' : 'tinted'} icon="plus" onClick=${() => apriVoce(null)}>Compila il diario<//></div>
    ${!voci.length
      ? html`<${Card} class="mt-16"><${EmptyState} icon="book" title="Diario vuoto"
          text="Ogni 4 settimane scrivi i tuoi numeri: rileggerli tra qualche mese è la parte più bella." /><//>`
      : html`<div class="diario-lista mt-16">${voci.map((e, i) => html`<${Voce} key=${e.id} e=${e} prima=${voci[i + 1]} />`)}</div>`}`;
}

function Voce({ e, prima }) {
  const d = parseDay(e.giorno);
  const menu = ancora => apriMenu(ancora, [
    { label: 'Modifica', icona: 'pencil', azione: () => apriVoce(e) },
    '-',
    { label: 'Elimina', icona: 'trash', pericolo: true, azione: () => { A.eliminaDiario(e.id); toast('Voce eliminata', 'trash'); } },
  ]);
  return html`<section class="card voce-diario" aria-label=${`Diario della settimana ${e.settimana}`}>
    <div class="vd-testa">
      <div class="grow">
        <div class="t-headline">Settimana ${e.settimana}</div>
        <div class="t-foot secondary">${d ? cap(formatDayLong(d)) : e.giorno}</div>
      </div>
      <button type="button" class="icon-btn plain" aria-label="Altre azioni" onClick=${ev => { aptico(); menu(ev.currentTarget); }}>
        <${Icon} name="ellipsis" size=${20} />
      </button>
    </div>
    <div class="vd-valori">
      <div><span>Peso</span><b class="num">${e.peso ? `${fmtKg1(e.peso)} kg` : '–'}</b>
        ${e.peso && prima?.peso ? html`<small class="num">${fmtDelta(e.peso - prima.peso)} kg</small>` : null}</div>
      ${ALZATE.map(a => html`<div><span>${a.nome}</span><b class="num">${e[a.campo] || '–'}</b></div>`)}
    </div>
    ${e.note && html`<p class="vd-note">${e.note}</p>`}
  </section>`;
}

/** Foglio per scrivere (o modificare) una voce del diario. */
export function apriVoce(e) {
  apriFoglio(chiudi => html`<${ModuloVoce} e=${e} chiudi=${chiudi} />`, { titolo: e ? `Settimana ${e.settimana}` : 'Diario', alto: true });
}

function ModuloVoce({ e, chiudi }) {
  const oggi = isoDay();
  const sedute = A.sessioni();
  const [v, setV] = useState(() => {
    if (e) return { giorno: e.giorno, settimana: e.settimana, peso: e.peso != null ? fmtNum(e.peso) : '', panca: e.panca || '', squat: e.squat || '', rematore: e.rematore || '', note: e.note || '' };
    const w = A.settimana(oggi);
    const p = A.pesoAttuale();
    const out = { giorno: oggi, settimana: w.n, peso: p ? fmtNum(p.kg) : '', note: '' };
    for (const a of ALZATE) out[a.campo] = testoSerie(migliorePeriodo(sedute, a.ex, oggi, 28));
    return out;
  });
  const [errore, setErrore] = useState('');
  const set = (k, val) => { setV(x => ({ ...x, [k]: val })); setErrore(''); };
  const salva = () => {
    const peso = v.peso.trim() ? parseNum(v.peso) : null;
    if (v.peso.trim() && !(peso > 20 && peso < 250)) { setErrore('Il peso deve essere tra 20 e 250 kg.'); aptico('forte'); return; }
    A.salvaDiario(e?.id || null, {
      giorno: v.giorno, settimana: +v.settimana || 1, peso,
      panca: v.panca.trim(), squat: v.squat.trim(), rematore: v.rematore.trim(), note: v.note.trim(),
    });
    // se il peso è di oggi e non è ancora registrato, lo salvo anche tra le pesate
    if (peso && v.giorno === oggi && !A.pesi().some(p => p.giorno === oggi)) A.registraPeso(oggi, peso);
    aptico('successo');
    toast('Diario salvato', 'book');
    chiudi();
  };
  const campo = (k, etichetta, extra = {}) => html`<label class="campo-diario">
    <span class="field-label">${etichetta}</span>
    <input class="field" value=${v[k]} onInput=${ev => set(k, ev.currentTarget.value)} ...${extra} />
  </label>`;
  return html`<div class="modulo-diario">
    <div class="duo">
      <label class="campo-diario">
        <span class="field-label">Giorno</span>
        <input class="field" type="date" value=${v.giorno} max=${oggi} onChange=${ev => ev.currentTarget.value && set('giorno', ev.currentTarget.value)} />
      </label>
      ${campo('settimana', 'Settimana del programma', { inputmode: 'numeric' })}
    </div>
    ${campo('peso', 'Peso corporeo (kg)', { inputmode: 'decimal', placeholder: 'Es. 55,2' })}
    ${errore && html`<p class="pesa-msg errore" role="alert">${errore}</p>`}
    <div class="section-label">Serie migliore delle ultime 4 settimane</div>
    ${ALZATE.map(a => campo(a.campo, a.nome, { placeholder: 'Es. 50 kg × 8' }))}
    <p class="section-foot">Si compilano da sole dagli allenamenti: puoi correggerle.</p>
    <label class="campo-diario mt-16">
      <span class="field-label">Note</span>
      <textarea class="field" rows="4" maxlength="2000" placeholder="Come ti senti, sonno, cosa è cambiato…"
        value=${v.note} onInput=${ev => set('note', ev.currentTarget.value)}></textarea>
    </label>
    <div class="mt-24"><${Button} block onClick=${salva}>Salva<//></div>
  </div>`;
}
