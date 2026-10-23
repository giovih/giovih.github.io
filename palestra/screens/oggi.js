// Scheda "Oggi": giorno in grande, settimana, seduta di oggi, calorie e proteine, acqua e creatina.

import { html } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import { Page, Card, Button, ProgressRing, Bar, Callout, Chip, IconButton, Section } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { useOggi, useOra, coloreTono } from './comuni.js';
import { parseDay, weekdayIt, mondayOf, addDays, isoDay, GIORNI, GIORNI_INIZIALI, MESI, cap } from '../core/dates.js';
import { fmtInt, fmtLitri, fmtSetsReps, fmtDuration, fmtMinutes } from '../core/format.js';
import { durataStimata, ORDINE_SCHEDE } from '../core/scheda.js';
import { sedutaDelGiorno } from '../core/settings.js';
import { statistiche } from '../core/progression.js';
import { consiglioPeso, quota } from '../core/nutrition.js';
import { apriRiepilogo } from './allenamento.js';

/* ---------- settimana ---------- */

function Settimana({ oggi, imp, w }) {
  const lun = mondayOf(parseDay(oggi));
  const giorni = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(lun, i);
    const g = isoDay(d);
    const cod = sedutaDelGiorno(imp, i + 1);
    const fatte = A.sessioniDelGiorno(g);
    return { g, i: i + 1, cod, fatta: fatte[0] || null, oggi: g === oggi, passato: g < oggi };
  });
  const previste = giorni.filter(x => x.cod).length;
  const fatte = giorni.filter(x => x.fatta).length;
  return html`<${Card} class="settimana">
    <div class="sett-head">
      <div>
        <div class="t-headline">Settimana ${w.n}</div>
        <div class="t-foot secondary">Ciclo ${w.ciclo} di 8${w.scarico ? ' · scarico' : w.drop ? ' · drop set' : ''}</div>
      </div>
      <div class="sett-count">
        <span class="rounded num">${fatte}</span><span class="secondary"> di ${previste}</span>
        <div class="t-cap secondary">allenamenti</div>
      </div>
    </div>
    <div class="sett-giorni">
      ${giorni.map(x => {
        const sc = x.fatta ? { tono: x.fatta.tono } : x.cod ? imp.schede[x.cod] : null;
        const stato = x.fatta ? 'fatto' : x.cod ? (x.passato ? 'saltato' : 'previsto') : 'riposo';
        const lettera = x.fatta ? null : x.cod ? (x.cod === 'G' ? 'G' : x.cod) : null;
        return html`<div class=${'sg ' + stato + (x.oggi ? ' oggi' : '')} style=${sc ? `--tono:${coloreTono(sc.tono)}` : null}
          aria-label=${`${cap(GIORNI[x.i])}: ${stato === 'riposo' ? 'riposo' : (x.fatta?.nome || imp.schede[x.cod]?.nome)}${stato === 'fatto' ? ', fatto' : ''}`}>
          <span class="sg-lettera">${GIORNI_INIZIALI[x.i]}</span>
          <span class="sg-cerchio">
            ${stato === 'fatto' ? html`<${Icon} name="checkBold" size=${16} />` : stato === 'riposo' ? html`<i></i>` : lettera}
          </span>
        </div>`;
      })}
    </div>
  <//>`;
}

/* ---------- seduta di oggi ---------- */

function righeAnteprima(sc) {
  return sc.righe.slice(0, 4).map((r, i) => html`<div class="anteprima-riga">
    <span class="ellipsis">${r.ex}</span>
    ${r.ss != null && (sc.righe[i + 1]?.ss === r.ss || sc.righe[i - 1]?.ss === r.ss) && html`<${Chip} tono=${sc.tono}>SS<//>`}
    <span class="spacer"></span>
    <span class="secondary num">${fmtSetsReps(r.serie, r.min, r.max)}</span>
  </div>`);
}

function SedutaCard({ cod, imp, w, vai, oggi }) {
  const sc = imp.schede[cod];
  const att = A.sessioneAttiva();
  const fatta = A.sessioniDelGiorno(oggi).find(s => s.codice === cod) || null;
  const ora = useOra(1000, !!att);
  const nSerie = sc.righe.reduce((t, r) => t + r.serie, 0);

  if (att) {
    const st = statistiche(att);
    const sc2 = imp.schede[att.codice] || sc;
    return html`<${Card} class=${'seduta tono-' + att.tono}>
      <div class="seduta-top">
        <${Chip} kind="accent"><span class="pallino"></span>In corso<//>
        <span class="spacer"></span>
        <span class="t-sub secondary num">${fmtDuration((ora - new Date(att.data)) / 1000)}</span>
      </div>
      <div class="t-title1 mt-8">${att.nome}</div>
      <div class="t-sub secondary">${sc2.sotto}</div>
      <div class="mt-16"><${Bar} value=${st.totali ? st.serie / st.totali : 0} label="Serie completate" /></div>
      <div class="t-foot secondary mt-8 num">${st.serie} di ${st.totali} serie completate</div>
      <div class="mt-16"><${Button} block icon="play" onClick=${() => vai('allenamento')}>Riprendi allenamento<//></div>
    <//>`;
  }

  if (fatta) {
    const st = statistiche(fatta);
    return html`<${Card} class=${'seduta tono-' + fatta.tono}>
      <div class="seduta-top"><${Chip} tono=${fatta.tono} icon="check">Completato<//></div>
      <div class="t-title1 mt-8">${fatta.nome}</div>
      <div class="t-sub secondary">${sc.sotto}</div>
      <div class="seduta-stat mt-16">
        <div><div class="t-cap secondary">Durata</div><div class="rounded t-title3 num">${fmtMinutes(st.durata)}</div></div>
        <div><div class="t-cap secondary">Serie</div><div class="rounded t-title3 num">${st.serie}</div></div>
        <div><div class="t-cap secondary">Volume</div><div class="rounded t-title3 num">${fmtInt(st.volume)}<small class="t-cap secondary"> kg</small></div></div>
      </div>
      <div class="mt-16"><${Button} kind="secondary" block onClick=${() => apriRiepilogo(fatta)}>Vedi riepilogo<//></div>
    <//>`;
  }

  return html`<${Card} class=${'seduta tono-' + sc.tono}>
    <div class="seduta-top">
      <${Chip} tono=${sc.tono}>Seduta di oggi<//>
      ${w.scarico && html`<${Chip} kind="warning" icon="moonZ">Scarico<//>`}
      ${w.drop && sc.righe.some(r => r.drop) && html`<${Chip} kind="accent" icon="flame">Drop set<//>`}
    </div>
    <div class="t-title1 mt-8">${sc.nome}</div>
    <div class="t-sub secondary">${sc.sotto}</div>
    <div class="seduta-meta t-foot secondary">
      <span><${Icon} name="clock" size=${14} /> ${durataStimata(sc)} min</span>
      <span><${Icon} name="list" size=${14} /> ${sc.righe.length} esercizi</span>
      <span><${Icon} name="dumbbell" size=${14} /> ${w.scarico ? Math.ceil(nSerie / 2) : nSerie} serie</span>
    </div>
    <div class="anteprima">
      ${righeAnteprima(sc)}
      ${sc.righe.length > 4 && html`<div class="anteprima-altri secondary t-foot">e altri ${sc.righe.length - 4} esercizi</div>`}
    </div>
    <${Button} block icon="play" onClick=${() => { A.avviaAllenamento(cod); vai('allenamento'); }}>Inizia allenamento<//>
  <//>`;
}

function prossimoAllenamento(imp, oggi) {
  const d0 = parseDay(oggi);
  for (let i = 1; i <= 7; i++) {
    const d = addDays(d0, i);
    const cod = sedutaDelGiorno(imp, weekdayIt(d));
    if (cod) return { d, sc: imp.schede[cod] };
  }
  return null;
}

function scegliSeduta(vai) {
  const imp = S.impostazioni();
  apriFoglio(chiudi => html`<div class="col gap-12">
    <p class="t-sub secondary" style="margin:0 4px 4px">Se hai saltato un allenamento, riprendi dal successivo senza raddoppiare.</p>
    <div class="list">
      ${ORDINE_SCHEDE.map(c => imp.schede[c]).map((sc, i) => html`<button type="button" class="row" onClick=${() => {
        aptico(); chiudi(); A.avviaAllenamento(ORDINE_SCHEDE[i]); setTimeout(() => vai('allenamento'), 250);
      }}>
        <span class="pallino-tono" style=${`--tono:${coloreTono(sc.tono)}`}></span>
        <span class="row-main"><span class="row-title">${sc.nome}</span><span class="row-sub">${sc.sotto} · ${durataStimata(sc)} min</span></span>
        <${Icon} name="chevronRight" class="chev" size=${14} />
      </button>`)}
    </div>
  </div>`, { titolo: 'Scegli la seduta' });
}

function Riposo({ imp, oggi, vai }) {
  const p = prossimoAllenamento(imp, oggi);
  return html`<${Card} class="riposo-card">
    <div class="riposo-icona"><${Icon} name="moonZ" size=${28} /></div>
    <div class="t-title3">Giorno di riposo</div>
    <p class="t-sub secondary">I muscoli crescono mentre recuperi: mangia bene, bevi e dormi almeno 8 ore.</p>
    ${p && html`<div class="t-foot secondary mt-8">Prossimo: <b class="w-semibold" style="color:var(--label)">${cap(GIORNI[weekdayIt(p.d)])}</b> · ${p.sc.nome}</div>`}
    <div class="mt-16"><${Button} kind="secondary" block icon="dumbbell" onClick=${() => scegliSeduta(vai)}>Allenati lo stesso<//></div>
  <//>`;
}

/* ---------- alimentazione ---------- */

function Alimentazione({ oggi, imp, vai }) {
  const t = A.totaliGiorno(oggi);
  const o = imp.obiettivi;
  return html`<${Card} onClick=${() => vai('cibo')} label="Apri il diario del cibo" class="alim">
    <div class="card-head"><span class="t-headline">Alimentazione</span><span class="spacer"></span><${Icon} name="chevronRight" size=${14} class="chev" /></div>
    <div class="alim-anelli">
      <div class="alim-anello">
        <${ProgressRing} value=${quota(t.kcal, o.kcalMin)} size=${80} stroke=${9} label=${`Calorie: ${t.kcal} di ${o.kcalMin}`}>
          <${Icon} name="flame" size=${20} class="accent" />
        <//>
        <div class="alim-val">
          <div class="t-foot secondary">Calorie</div>
          <div class="rounded t-title2 num">${fmtInt(t.kcal)}</div>
          <div class="t-foot secondary num">di ${fmtInt(o.kcalMin)}</div>
        </div>
      </div>
      <div class="alim-anello">
        <${ProgressRing} value=${quota(t.prot, o.proteine)} size=${80} stroke=${9} color="var(--dato-prot)" label=${`Proteine: ${t.prot} di ${o.proteine} grammi`}>
          <span class="t-sub w-bold">P</span>
        <//>
        <div class="alim-val">
          <div class="t-foot secondary">Proteine</div>
          <div class="rounded t-title2 num">${fmtInt(t.prot)}<small class="t-sub secondary"> g</small></div>
          <div class="t-foot secondary num">di ${o.proteine} g</div>
        </div>
      </div>
    </div>
    <div class="macro-row due mt-16">
      <div class="macro"><div class="macro-top"><b>Carboidrati</b><span>${fmtInt(t.carb)} di ${o.carboidrati} g</span></div><${Bar} value=${quota(t.carb, o.carboidrati)} color="var(--tono-ambra)" /></div>
      <div class="macro"><div class="macro-top"><b>Grassi</b><span>${fmtInt(t.grassi)} di ${o.grassi} g</span></div><${Bar} value=${quota(t.grassi, o.grassi)} color="var(--tono-lavanda)" /></div>
    </div>
  <//>`;
}

/** Acqua e creatina in una riga compatta. */
export function AcquaCreatina({ giorno }) {
  const g = A.giorno(giorno);
  const imp = S.impostazioni();
  const obiettivo = imp.obiettivi.acquaMl || 2500;
  const cambiaCreatina = () => { aptico(g.creatina ? 'leggero' : 'successo'); A.impostaCreatina(giorno, !g.creatina); };
  return html`<div class="duo">
    <div class="card mini">
      <div class="mini-top">
        <span class="mini-icona" style="color:var(--acqua);background:color-mix(in srgb, var(--acqua) 15%, transparent)"><${Icon} name="dropFill" size=${18} /></span>
        <${IconButton} icon="plus" label="Aggiungi 250 ml d'acqua" onClick=${() => A.aggiungiAcqua(giorno, 250)} />
      </div>
      <button type="button" class="mini-main" onClick=${() => apriAcqua(giorno)} aria-label=${`Acqua: ${fmtLitri(g.acquaMl)} di ${fmtLitri(obiettivo)}. Tocca per i dettagli`}>
        <span class="t-foot secondary">Acqua</span>
        <span class="mini-val">${fmtLitri(g.acquaMl)} <small>di ${fmtLitri(obiettivo)}</small></span>
      </button>
      <div class="mini-bar"><${Bar} value=${quota(g.acquaMl, obiettivo)} color="var(--acqua)" /></div>
    </div>
    <div class="card mini">
      <div class="mini-top">
        <span class="mini-icona" style="color:var(--tono-lavanda);background:color-mix(in srgb, var(--tono-lavanda) 15%, transparent)"><${Icon} name="pill" size=${18} /></span>
        <button type="button" class=${'check-tondo' + (g.creatina ? ' on' : '')} onClick=${cambiaCreatina}
          aria-pressed=${g.creatina ? 'true' : 'false'} aria-label="Creatina presa oggi"><${Icon} name="checkBold" size=${16} /></button>
      </div>
      <button type="button" class="mini-main" onClick=${cambiaCreatina} tabindex="-1" aria-hidden="true">
        <span class="t-foot secondary">Creatina 5 g</span>
        <span class="mini-val" style="font-family:var(--font);font-size:1.06rem">${g.creatina ? 'Presa' : 'Da prendere'}</span>
      </button>
      <div class="mini-bar"><${Bar} value=${g.creatina ? 1 : 0} color="var(--tono-lavanda)" /></div>
    </div>
</div>`;
}

function apriAcqua(giorno) {
  apriFoglio(() => {
    const g = A.giorno(giorno);
    const obiettivo = S.impostazioni().obiettivi.acquaMl || 2500;
    return html`<div class="col gap-16">
      <div class="acqua-big">
        <${ProgressRing} value=${quota(g.acquaMl, obiettivo)} size=${150} stroke=${14} color="var(--acqua)" label="Acqua bevuta">
          <div><div class="rounded t-title1 num">${fmtLitri(g.acquaMl)}</div><div class="t-foot secondary">di ${fmtLitri(obiettivo)}</div></div>
        <//>
      </div>
      <div class="acqua-tasti">
        ${[[250, 'Bicchiere'], [330, 'Lattina'], [500, 'Bottiglietta']].map(([ml, n]) => html`
          <button type="button" class="card acqua-tasto" onClick=${() => { aptico(); A.aggiungiAcqua(giorno, ml); }}>
            <${Icon} name="drop" size=${22} />
            <span class="t-headline num">+${ml} ml</span><span class="t-cap secondary">${n}</span>
          </button>`)}
      </div>
      <div class="row-flex" style="justify-content:center">
        <${Button} kind="secondary" small icon="minus" onClick=${() => A.aggiungiAcqua(giorno, -250)}>250 ml<//>
        <${Button} kind="plain" small onClick=${() => A.impostaAcqua(giorno, 0)}>Azzera<//>
      </div>
    </div>`;
  }, { titolo: 'Acqua' });
}

/* ---------- consigli ---------- */

function Consigli({ oggi, imp, w, vai }) {
  const lista = [];
  const pesi = A.pesi();
  const c = consiglioPeso(pesi, imp.obiettivi, oggi);
  if (c.tipo === 'aumenta' || c.tipo === 'riduci') {
    lista.push(html`<${Callout} icon=${c.delta > 0 ? 'arrowUpRight' : 'arrowDownRight'} title=${c.titolo} text=${c.testo}
      onClick=${() => vai('progressi', { sotto: 'corpo' })} right=${html`<${Icon} name="chevronRight" size=${14} class="chev" />`} />`);
  }
  if (w.scarico) {
    lista.push(html`<${Callout} kind="warning" icon="moonZ" title="Settimana di scarico"
      text="Metà serie e 10% di peso in meno. Dalla prossima settimana riparti dai pesi di prima." />`);
  } else if (w.ciclo === 7) {
    lista.push(html`<${Callout} icon="info" title="La prossima settimana è di scarico" text="Ultima settimana di carico del ciclo: dai il massimo con tecnica pulita." />`);
  }
  if (w.drop && sedutaDelGiorno(imp, weekdayIt(parseDay(oggi)))) {
    lista.push(html`<${Callout} icon="flame" tono="rosa" title="Drop set attivi"
      text="Ultima serie di alzate laterali, croci e curl inclinato: cedimento, -25% di peso e di nuovo cedimento." />`);
  }
  const pesataOggi = pesi.some(p => p.giorno === oggi);
  if (imp.notifiche.pesata.on !== false && weekdayIt(parseDay(oggi)) === +imp.notifiche.pesata.giorno && !pesataOggi) {
    lista.push(html`<${Callout} icon="scale" title="Pesata settimanale" text="A digiuno, dopo il bagno. Tocca per segnare il peso."
      onClick=${() => vai('progressi', { sotto: 'pesa' })} right=${html`<${Icon} name="chevronRight" size=${14} class="chev" />`} />`);
  }
  if (w.diario && !A.diario().some(e => e.settimana === w.n)) {
    lista.push(html`<${Callout} icon="book" title=${`Diario della settimana ${w.n}`} text="Peso, panca, squat, rematore e qualche nota: ci vuole un minuto."
      onClick=${() => vai('progressi', { sotto: 'diario' })} right=${html`<${Icon} name="chevronRight" size=${14} class="chev" />`} />`);
  }
  if (!lista.length) return null;
  return html`<${Section} title="Per te">${lista}<//>`;
}

/* ---------- pagina ---------- */

export function Oggi({ hidden, vai }) {
  const oggi = useOggi();
  const d = parseDay(oggi);
  const imp = S.impostazioni();
  const w = A.settimana(oggi);
  const cod = sedutaDelGiorno(imp, weekdayIt(d));
  const att = A.sessioneAttiva();

  return html`<${Page} id="oggi" hidden=${hidden} caption=${`${d.getDate()} ${MESI[d.getMonth()]}`} title=${cap(GIORNI[weekdayIt(d)])}>
    <${Settimana} oggi=${oggi} imp=${imp} w=${w} />
    <div class="mt-12">
      ${att || cod
        ? html`<${SedutaCard} cod=${att ? att.codice : cod} imp=${imp} w=${w} vai=${vai} oggi=${oggi} />`
        : html`<${Riposo} imp=${imp} oggi=${oggi} vai=${vai} />`}
    </div>
    <div class="mt-12"><${Alimentazione} oggi=${oggi} imp=${imp} vai=${vai} /></div>
    <div class="mt-12"><${AcquaCreatina} giorno=${oggi} /></div>
    <${Consigli} oggi=${oggi} imp=${imp} w=${w} vai=${vai} />
  <//>`;
}
