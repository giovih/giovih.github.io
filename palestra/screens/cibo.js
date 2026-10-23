// Scheda "Cibo": calorie e macro del giorno, acqua e creatina, i sei pasti con gli alimenti.

import { html, useState, useEffect } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import { Page, Card, ProgressRing, Bar, IconButton } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { aptico } from '../ui/haptics.js';
import { useOggi } from './comuni.js';
import { AcquaCreatina } from './oggi.js';
import { apriAggiungi, apriModificaCibo } from './aggiungi-cibo.js';
import { PASTI, nomePasto } from '../core/foods.js';
import { quota, totali } from '../core/nutrition.js';
import { fmtInt, fmtNum } from '../core/format.js';
import { addDaysIso, parseDay, weekdayIt, GIORNI, MESI, cap, daysBetween } from '../core/dates.js';
import { sedutaDelGiorno } from '../core/settings.js';
import { toast } from '../ui/overlay.js';

function titoloGiorno(g, oggi) {
  const diff = daysBetween(oggi, g);
  if (diff === 0) return 'Oggi';
  if (diff === -1) return 'Ieri';
  const d = parseDay(g);
  return `${cap(GIORNI[weekdayIt(d)])} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

function Riepilogo({ giorno }) {
  const imp = S.impostazioni();
  const o = imp.obiettivi;
  const t = A.totaliGiorno(giorno);
  const mancano = o.kcalMin - t.kcal;
  return html`<${Card} class="cibo-riep">
    <div class="cr-top">
      <${ProgressRing} value=${quota(t.kcal, o.kcalMin)} size=${118} stroke=${12} label=${`Calorie mangiate: ${t.kcal} su ${o.kcalMin}`}>
        <div>
          <div class="rounded num cr-kcal-big">${fmtInt(t.kcal)}</div>
          <div class="t-cap secondary">kcal</div>
        </div>
      <//>
      <div class="cr-testo">
        <div class="t-foot secondary">${mancano > 0 ? 'Ti mancano' : t.kcal <= o.kcalMax ? 'Obiettivo raggiunto' : 'Sopra l\'obiettivo di'}</div>
        <div class="rounded t-title1 num">${mancano > 0 ? fmtInt(mancano) : t.kcal <= o.kcalMax ? fmtInt(t.kcal) : fmtInt(t.kcal - o.kcalMax)}<small class="t-sub secondary"> kcal</small></div>
        <div class="t-foot secondary num">Obiettivo ${fmtInt(o.kcalMin)}-${fmtInt(o.kcalMax)} kcal</div>
      </div>
    </div>
    <div class="macro-row mt-16">
      <div class="macro"><div class="macro-top"><b>Proteine</b><span>${fmtInt(t.prot)} di ${o.proteine} g</span></div><${Bar} value=${quota(t.prot, o.proteine)} color="var(--tono-teal)" label="Proteine" /></div>
      <div class="macro"><div class="macro-top"><b>Carboidrati</b><span>${fmtInt(t.carb)} di ${o.carboidrati} g</span></div><${Bar} value=${quota(t.carb, o.carboidrati)} color="var(--tono-ambra)" label="Carboidrati" /></div>
      <div class="macro"><div class="macro-top"><b>Grassi</b><span>${fmtInt(t.grassi)} di ${o.grassi} g</span></div><${Bar} value=${quota(t.grassi, o.grassi)} color="var(--tono-lavanda)" label="Grassi" /></div>
    </div>
  <//>`;
}

function Pasto({ p, giorno, vai, allenamento }) {
  const voci = A.cibiDelGiorno(giorno).filter(c => c.pasto === p.key);
  const t = totali(voci);
  const ieri = voci.length ? [] : A.pastoDiIeri(giorno, p.key);
  const sotto = p.key === 'pranzo' ? (allenamento ? 'Pre-allenamento' : null) : p.key === 'merenda' ? (allenamento ? 'Post-allenamento' : null) : null;
  return html`<section class="card flush pasto" aria-label=${p.nome}>
    <div class="pasto-testa">
      <span class="pasto-icona"><${Icon} name=${p.icona} size=${18} /></span>
      <div class="grow">
        <div class="t-headline">${p.nome}</div>
        ${(sotto || voci.length > 0) && html`<div class="t-foot secondary num">${[sotto, voci.length ? `${fmtInt(t.kcal)} kcal · ${fmtInt(t.prot)} g proteine` : null].filter(Boolean).join(' · ')}</div>`}
      </div>
      <${IconButton} icon="plus" label=${'Aggiungi a ' + p.nome} onClick=${() => apriAggiungi(giorno, p.key, vai)} />
    </div>
    ${voci.map(c => html`<button type="button" class="row voce-cibo" onClick=${() => { aptico(); apriModificaCibo(c); }}>
      ${c.foto ? html`<img class="cr-img" src=${c.foto} alt="" />` : html`<span class="cr-img vuota"><${Icon} name=${c.fonte === 'preset' ? 'list' : c.fonte === 'off' ? 'barcode' : 'forkKnife'} size=${16} /></span>`}
      <span class="row-main">
        <span class="row-title ellipsis">${c.nome}</span>
        <span class="row-sub ellipsis">${[c.quantita ? `${fmtNum(c.quantita)} ${c.unita || 'g'}` : null, `${fmtNum(c.prot)} g proteine`].filter(Boolean).join(' · ')}</span>
      </span>
      <span class="cr-kcal num">${fmtInt(c.kcal)}</span>
    </button>`)}
    ${!voci.length && ieri.length > 0 && html`<button type="button" class="row copia" onClick=${() => {
      aptico('successo');
      const n = A.copiaPasto(addDaysIso(giorno, -1), giorno, p.key);
      toast(`Copiati ${n} ${n === 1 ? 'alimento' : 'alimenti'} da ieri`, 'copy');
    }}>
      <${Icon} name="copy" size=${18} class="accent" />
      <span class="row-main"><span class="row-title accent">Copia da ieri</span><span class="row-sub">${ieri.map(c => c.nome).join(', ')}</span></span>
    </button>`}
  </section>`;
}

export function Cibo({ hidden, vai }) {
  const oggi = useOggi();
  const [giorno, setGiorno] = useState(oggi);
  // a mezzanotte, se stavi guardando "oggi", passo al giorno nuovo
  useEffect(() => { setGiorno(g => (daysBetween(g, oggi) === 1 ? oggi : g)); }, [oggi]);
  const allenamento = !!sedutaDelGiorno(S.impostazioni(), weekdayIt(parseDay(giorno)));
  const cambia = n => { aptico(); setGiorno(g => (n > 0 && g >= oggi ? g : addDaysIso(g, n))); };

  const azioni = html`
    <${IconButton} icon="chevronLeft" label="Giorno precedente" onClick=${() => cambia(-1)} />
    <${IconButton} icon="chevronRight" label="Giorno successivo" onClick=${() => cambia(1)} style=${giorno >= oggi ? 'opacity:.3;pointer-events:none' : null} />`;

  return html`<${Page} id="cibo" hidden=${hidden} title="Cibo" caption=${titoloGiorno(giorno, oggi)} actions=${azioni}>
    <${Riepilogo} giorno=${giorno} />
    <div class="mt-12"><${AcquaCreatina} giorno=${giorno} /></div>
    <div class="pasti mt-24">
      ${PASTI.map(p => html`<${Pasto} key=${p.key} p=${p} giorno=${giorno} vai=${vai} allenamento=${allenamento} />`)}
    </div>
    ${giorno !== oggi && html`<div class="center mt-16"><button type="button" class="btn btn-plain" onClick=${() => setGiorno(oggi)}>Torna a oggi</button></div>`}
  <//>`;
}

export { nomePasto };
