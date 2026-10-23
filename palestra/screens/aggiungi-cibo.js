// Aggiungi cibo (stile Yazio): ricerca, codice a barre, preferiti, recenti, pasti della scheda, foto con stima AI, a mano.

import { html, useState, useEffect, useRef } from '../lib/preact.js';
import * as A from '../data/actions.js';
import * as AI from '../data/ai.js';
import { cercaProdotti, prodottoDaCodice } from '../data/off.js';
import { Button, Segmented, Callout, EmptyState, IconButton } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { apriFoglio, toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { Scanner } from '../ui/scanner.js';
import { ALIMENTI, PRESET, PASTI, nomePasto, cercaLocale, normalizza } from '../core/foods.js';
import { perQuantita, kcalDaMacro } from '../core/nutrition.js';
import { fmtNum, fmtInt, parseNum } from '../core/format.js';
import { addDaysIso } from '../core/dates.js';
import { scegliFile } from './comuni.js';

/* ---------- utilità ---------- */

const etichettaQuantita = c => c.quantita ? `${fmtNum(c.quantita)} ${c.unita || 'g'}` : null;

/** Dati di un cibo da salvare a partire da un alimento (valori per 100) e una quantità. */
function daAlimento(al, q) {
  const v = perQuantita(al, q);
  return {
    nome: al.marca ? `${al.nome} · ${al.marca}` : al.nome,
    kcal: v.kcal, prot: v.prot, carb: v.carb, grassi: v.grassi,
    quantita: q, unita: al.unita || 'g',
    per100: { kcal: al.kcal, prot: al.prot, carb: al.carb, grassi: al.grassi },
    fonte: al.fonte || 'db', rif: al.id || null, barcode: al.barcode || null,
  };
}

/** Riga di un alimento nelle liste. */
function RigaAlimento({ titolo, sotto, kcal, onApri, onAggiungi, immagine, icona = 'forkKnife' }) {
  return html`<div class="row cibo-riga">
    <button type="button" class="cr-main" onClick=${() => { aptico(); onApri?.(); }} aria-label=${'Dettagli di ' + titolo}>
      ${immagine ? html`<img class="cr-img" src=${immagine} alt="" loading="lazy" />` : html`<span class="cr-img vuota"><${Icon} name=${icona} size=${18} /></span>`}
      <span class="row-main">
        <span class="row-title ellipsis">${titolo}</span>
        ${sotto && html`<span class="row-sub ellipsis">${sotto}</span>`}
      </span>
      ${kcal != null && html`<span class="cr-kcal num">${fmtInt(kcal)}<small> kcal</small></span>`}
    </button>
    ${onAggiungi && html`<button type="button" class="cr-piu" onClick=${() => { aptico('successo'); onAggiungi(); }} aria-label=${'Aggiungi ' + titolo}>
      <${Icon} name="plus" size=${18} strokeWidth=${2.4} />
    </button>`}
  </div>`;
}

/* =====================================================================
   Dettaglio di un alimento: quantità e valori
   ===================================================================== */

function Dettaglio({ al, pasto, giorno, onIndietro, onFatto }) {
  const porzioni = [...(al.porzioni || []), { nome: '100 ' + (al.unita || 'g'), g: 100 }];
  const [q, setQ] = useState(String(al.quantitaIniziale ?? porzioni[0].g));
  const [pref, setPref] = useState(A.ePreferito(al));
  const qn = parseNum(q) ?? 0;
  const v = perQuantita(al, qn);

  const aggiungi = () => {
    if (qn <= 0) return;
    aptico('successo');
    A.aggiungiCibo(giorno, pasto, daAlimento(al, qn));
    toast(`Aggiunto a ${nomePasto(pasto)}`);
    onFatto();
  };
  const stella = () => {
    aptico();
    A.preferito({ ...al, rif: al.id, quantitaIniziale: qn }, !pref);
    setPref(!pref);
  };

  return html`<div class="dettaglio">
    ${onIndietro && html`<button type="button" class="back-btn" onClick=${onIndietro}><${Icon} name="chevronLeft" />Indietro</button>`}
    <div class="det-testa">
      ${al.immagine ? html`<img class="det-img" src=${al.immagine} alt="" />` : html`<span class="det-img vuota"><${Icon} name="forkKnife" size=${24} /></span>`}
      <div class="grow">
        <div class="t-title3">${al.nome}</div>
        <div class="t-foot secondary">${[al.marca, al.fonte === 'off' ? 'Open Food Facts' : al.fonte === 'db' ? 'Alimenti di base' : null].filter(Boolean).join(' · ')}</div>
      </div>
      <button type="button" class=${'stella' + (pref ? ' on' : '')} onClick=${stella} aria-pressed=${pref ? 'true' : 'false'} aria-label="Preferito">
        <${Icon} name=${pref ? 'starFill' : 'star'} size=${24} />
      </button>
    </div>

    <div class="card det-quantita">
      <label class="field-label" for="det-q">Quantità</label>
      <div class="row-flex">
        <input id="det-q" class="field num-grande" inputmode="decimal" value=${q} onInput=${e => setQ(e.currentTarget.value)}
          onFocus=${e => e.currentTarget.select()} aria-label=${'Quantità in ' + (al.unita || 'g')} />
        <span class="t-headline secondary">${al.unita || 'g'}</span>
      </div>
      <div class="scelte mt-12">
        ${porzioni.map(p => html`<button type="button" class=${'scelta' + (qn === p.g ? ' on' : '')} onClick=${() => { aptico(); setQ(String(p.g)); }}>
          ${p.nome}${p.nome.startsWith('100') ? '' : ` · ${p.g} ${al.unita || 'g'}`}</button>`)}
      </div>
    </div>

    <div class="det-valori">
      <div class="dv-kcal"><span class="rounded num">${fmtInt(v.kcal)}</span><small>kcal</small></div>
      <div class="dv-macro">
        <div><span class="dot" style="--c:var(--tono-teal)"></span>Proteine<b class="num">${fmtNum(v.prot)} g</b></div>
        <div><span class="dot" style="--c:var(--tono-ambra)"></span>Carboidrati<b class="num">${fmtNum(v.carb)} g</b></div>
        <div><span class="dot" style="--c:var(--tono-lavanda)"></span>Grassi<b class="num">${fmtNum(v.grassi)} g</b></div>
      </div>
    </div>
    <p class="t-foot secondary center mt-8">Per 100 ${al.unita || 'g'}: ${fmtInt(al.kcal)} kcal · P ${fmtNum(al.prot)} · C ${fmtNum(al.carb)} · G ${fmtNum(al.grassi)}</p>

    <div class="mt-16"><${Button} block icon="plus" disabled=${qn <= 0} onClick=${aggiungi}>Aggiungi a ${nomePasto(pasto)}<//></div>
  </div>`;
}

/* =====================================================================
   Inserimento a mano
   ===================================================================== */

function AMano({ pasto, giorno, iniziale = {}, onIndietro, onFatto, titoloBottone }) {
  const [v, setV] = useState({ nome: iniziale.nome || '', kcal: iniziale.kcal ?? '', prot: iniziale.prot ?? '', carb: iniziale.carb ?? '', grassi: iniziale.grassi ?? '' });
  const set = k => e => setV({ ...v, [k]: e.currentTarget.value });
  const n = k => parseNum(String(v[k])) ?? 0;
  const kcalCalcolate = kcalDaMacro({ prot: n('prot'), carb: n('carb'), grassi: n('grassi') });
  const ok = n('kcal') > 0 || kcalCalcolate > 0;
  const salva = () => {
    aptico('successo');
    A.aggiungiCibo(giorno, pasto, { nome: v.nome.trim() || 'Alimento', kcal: n('kcal') || kcalCalcolate, prot: n('prot'), carb: n('carb'), grassi: n('grassi'), fonte: 'manuale', foto: iniziale.foto || null, descrizione: iniziale.descrizione || '' });
    toast(`Aggiunto a ${nomePasto(pasto)}`);
    onFatto();
  };
  const campo = (k, label, unita) => html`<label class="campo-macro">
    <span>${label}</span>
    <span class="row-flex gap-6"><input class="field num" inputmode="decimal" value=${v[k]} onInput=${set(k)} placeholder="0" aria-label=${label} /><small>${unita}</small></span>
  </label>`;
  return html`<div class="col gap-12">
    ${onIndietro && html`<button type="button" class="back-btn" onClick=${onIndietro}><${Icon} name="chevronLeft" />Indietro</button>`}
    <label class="field-label" for="mano-nome">Nome</label>
    <input id="mano-nome" class="field" placeholder="Es. Piadina con cotto" value=${v.nome} onInput=${set('nome')} />
    <div class="griglia-macro">
      ${campo('kcal', 'Calorie', 'kcal')}${campo('prot', 'Proteine', 'g')}${campo('carb', 'Carboidrati', 'g')}${campo('grassi', 'Grassi', 'g')}
    </div>
    ${!n('kcal') && kcalCalcolate > 0 && html`<p class="t-foot secondary">Calorie calcolate dai macro: ${fmtInt(kcalCalcolate)} kcal</p>`}
    <${Button} block disabled=${!ok} onClick=${salva}>${titoloBottone || `Aggiungi a ${nomePasto(pasto)}`}<//>
  </div>`;
}

/* =====================================================================
   Foto + descrizione → stima AI
   ===================================================================== */

function FotoAI({ pasto, giorno, onFatto, vai }) {
  const [foto, setFoto] = useState(null);
  const [anteprima, setAnteprima] = useState(null);
  const [testo, setTesto] = useState('');
  const [stato, setStato] = useState('pronto'); // pronto | stima | risultato | errore
  const [ris, setRis] = useState(null);
  const [errore, setErrore] = useState('');
  const [miniatura, setMiniatura] = useState(null);

  const prendi = async capture => {
    const f = await scegliFile({ accept: 'image/*', capture });
    if (!f) return;
    setFoto(f);
    setAnteprima(URL.createObjectURL(f));
    try { const { blob } = await A.ridimensiona(f, 240, 0.75); setMiniatura(await A.blobInDataUrl(blob)); } catch { setMiniatura(null); }
  };
  const stima = async () => {
    setStato('stima'); setErrore('');
    try {
      const r = await AI.stimaCibo({ foto, descrizione: testo });
      setRis(r); setStato('risultato'); aptico('successo');
    } catch (e) {
      setErrore(e.codice === 'offline' ? 'Sei offline: la stima ha bisogno di internet. Puoi inserire i valori a mano.' : (e.message || 'Non riesco a stimare ora, riprova.'));
      setStato('errore');
    }
  };

  if (!AI.disponibile()) {
    return html`<${EmptyState} icon="sparkles" title="Stima con AI" text="Fotografa il piatto e l'AI stima calorie e macro. Per usarla collega il tuo account (gratis) in Altro."
      action="Collega l'account" actionIcon="person" onAction=${() => { onFatto(); vai('altro', { sotto: 'account' }); }} />`;
  }

  if (stato === 'risultato' && ris) {
    return html`<div class="col gap-12">
      <div class="card stima">
        ${anteprima && html`<img class="stima-img" src=${anteprima} alt="" />`}
        <div class="t-title3">${ris.descrizione}</div>
        <div class="t-sub secondary">Circa <b class="num" style="color:var(--label)">${fmtInt(ris.kcal)} kcal</b>, tra ${fmtInt(ris.kcal_min)} e ${fmtInt(ris.kcal_max)}</div>
        ${ris.note && html`<p class="t-foot secondary mt-8">${ris.note}</p>`}
      </div>
      <div class="section-label" style="margin:8px 4px 0">Controlla e correggi i numeri</div>
      <${AMano} pasto=${pasto} giorno=${giorno} onFatto=${onFatto}
        iniziale=${{ nome: ris.descrizione, kcal: ris.kcal, prot: ris.proteine, carb: ris.carboidrati, grassi: ris.grassi, foto: miniatura, descrizione: testo }} />
      <${Button} kind="plain" onClick=${() => { setStato('pronto'); setRis(null); }}>Rifai la stima<//>
    </div>`;
  }

  return html`<div class="col gap-12">
    ${anteprima
      ? html`<div class="foto-anteprima"><img src=${anteprima} alt="Foto del piatto" />
          <button type="button" class="icon-btn" onClick=${() => { setFoto(null); setAnteprima(null); }} aria-label="Togli la foto"><${Icon} name="xmark" size=${18} /></button></div>`
      : html`<div class="foto-scelta">
          <button type="button" class="card" onClick=${() => prendi('environment')}><${Icon} name="camera" size=${28} /><span class="t-headline">Scatta una foto</span></button>
          <button type="button" class="card" onClick=${() => prendi(null)}><${Icon} name="photo" size=${28} /><span class="t-headline">Dalla libreria</span></button>
        </div>`}
    <label class="field-label" for="ai-testo">Descrizione (facoltativa ma utile)</label>
    <textarea id="ai-testo" class="field" rows="3" placeholder="Es. 110 g di pasta con 80 g di pollo, 1 cucchiaio d'olio"
      onInput=${e => setTesto(e.currentTarget.value)}>${testo}</textarea>
    ${stato === 'errore' && html`<${Callout} kind="warning" icon="info" title="Stima non riuscita" text=${errore} />`}
    <${Button} block icon="sparkles" disabled=${(!foto && testo.trim().length < 3) || stato === 'stima'} onClick=${stima}>
      ${stato === 'stima' ? 'Analizzo il piatto…' : 'Stima con AI'}
    <//>
    <p class="t-foot secondary center">La stima ha un margine di errore: se conosci i grammi scrivili nella descrizione.</p>
  </div>`;
}

/* =====================================================================
   Foglio "Aggiungi a …"
   ===================================================================== */

function Aggiungi({ giorno, pasto: pastoIniziale, chiudi, vai }) {
  const [pasto, setPasto] = useState(pastoIniziale);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('pasti');
  const [vista, setVista] = useState(null); // { tipo: 'dettaglio'|'mano'|'scanner'|'nontrovato', dati }
  const [off, setOff] = useState({ q: '', lista: [], stato: 'vuoto' });
  const timer = useRef(null);

  // ricerca su Open Food Facts mentre scrivi (con una piccola attesa)
  useEffect(() => {
    clearTimeout(timer.current);
    const t = q.trim();
    if (t.length < 3) { setOff({ q: t, lista: [], stato: 'vuoto' }); return; }
    const ctrl = new AbortController();
    setOff(o => ({ ...o, q: t, stato: 'cerco' }));
    timer.current = setTimeout(async () => {
      try {
        const lista = await cercaProdotti(t, ctrl.signal);
        setOff({ q: t, lista, stato: 'ok' });
      } catch (e) {
        if (e.name !== 'AbortError') setOff({ q: t, lista: [], stato: navigator.onLine === false ? 'offline' : 'errore' });
      }
    }, 450);
    return () => { clearTimeout(timer.current); ctrl.abort(); };
  }, [q]);

  const fatto = () => chiudi();
  const aggiungiDiretto = (item, etichetta) => {
    const { id, giorno: _g, ora: _o, pasto: _p, ...dati } = item;
    A.aggiungiCibo(giorno, pasto, { ...dati, rif: dati.rif || id });
    toast(etichetta || `Aggiunto a ${nomePasto(pasto)}`);
  };
  const apriDettaglio = al => setVista({ tipo: 'dettaglio', dati: al });
  const daVoce = c => (c.per100 ? { ...c.per100, id: c.rif || c.id, nome: c.nome, unita: c.unita, fonte: c.fonte, barcode: c.barcode, porzioni: c.quantita ? [{ nome: 'Come l\'ultima volta', g: c.quantita }] : [], quantitaIniziale: c.quantita } : null);

  const codiceLetto = async codice => {
    setVista({ tipo: 'cerco', dati: codice });
    try {
      const p = await prodottoDaCodice(codice);
      if (p) setVista({ tipo: 'dettaglio', dati: p });
      else setVista({ tipo: 'nontrovato', dati: codice });
    } catch {
      setVista({ tipo: 'nontrovato', dati: codice, offline: true });
    }
  };

  // ----- viste interne
  if (vista?.tipo === 'scanner') {
    return html`<${Scanner} onCodice=${codiceLetto} onChiudi=${() => setVista(null)} />`;
  }
  if (vista?.tipo === 'cerco') {
    return html`<${EmptyState} icon="barcode" title="Cerco il prodotto…" text=${'Codice ' + vista.dati} />`;
  }
  if (vista?.tipo === 'nontrovato') {
    return html`<div class="col gap-12">
      <${EmptyState} icon="barcode" title=${vista.offline ? 'Sei offline' : 'Prodotto non trovato'}
        text=${vista.offline ? 'Per cercare il codice serve internet. Puoi inserire i valori a mano leggendo l\'etichetta.' : 'Questo codice non è in Open Food Facts. Inserisci i valori dell\'etichetta.'} />
      <${Button} block onClick=${() => setVista({ tipo: 'mano' })}>Inserisci a mano<//>
      <${Button} kind="secondary" block onClick=${() => setVista({ tipo: 'scanner' })}>Scansiona di nuovo<//>
    </div>`;
  }
  if (vista?.tipo === 'dettaglio') {
    return html`<${Dettaglio} al=${vista.dati} pasto=${pasto} giorno=${giorno} onIndietro=${() => setVista(null)} onFatto=${fatto} />`;
  }
  if (vista?.tipo === 'mano') {
    return html`<${AMano} pasto=${pasto} giorno=${giorno} onIndietro=${() => setVista(null)} onFatto=${fatto} />`;
  }

  // ----- lista principale
  const ieri = A.pastoDiIeri(giorno, pasto);
  const qn = normalizza(q);
  const preferiti = A.preferiti();
  const recenti = A.recenti();

  const ricerca = () => {
    const miei = [...preferiti, ...recenti].filter((x, i, arr) => normalizza(x.nome).includes(qn) && arr.findIndex(y => y.nome === x.nome) === i).slice(0, 6);
    const base = cercaLocale(q, ALIMENTI, 12);
    const preset = PRESET.filter(p => normalizza(p.nome + ' ' + p.descrizione).includes(qn)).slice(0, 4);
    return html`
      ${miei.length > 0 && html`<div class="section-label">I tuoi alimenti</div><div class="list">${miei.map(c => html`<${RigaAlimento}
        titolo=${c.nome} sotto=${[etichettaQuantita(c), c.prot ? `${fmtNum(c.prot)} g proteine` : null].filter(Boolean).join(' · ')} kcal=${c.kcal}
        immagine=${c.foto} onApri=${() => (daVoce(c) ? apriDettaglio(daVoce(c)) : aggiungiDiretto(c))} onAggiungi=${() => aggiungiDiretto(c)} />`)}</div>`}
      ${preset.length > 0 && html`<div class="section-label">Pasti della scheda</div><div class="list">${preset.map(p => html`<${RigaAlimento}
        titolo=${p.nome} sotto=${p.descrizione} kcal=${p.kcal} icona=${PASTI.find(x => x.key === p.pasto)?.icona}
        onApri=${() => aggiungiDiretto(p)} onAggiungi=${() => aggiungiDiretto(p)} />`)}</div>`}
      ${base.length > 0 && html`<div class="section-label">Alimenti di base · per 100 g</div><div class="list">${base.map(al => html`<${RigaAlimento}
        titolo=${al.nome} sotto=${`P ${fmtNum(al.prot)} · C ${fmtNum(al.carb)} · G ${fmtNum(al.grassi)}`} kcal=${al.kcal}
        onApri=${() => apriDettaglio(al)} />`)}</div>`}
      <div class="section-label">Open Food Facts</div>
      ${off.stato === 'cerco' && html`<div class="list"><div class="row"><span class="spinner"></span><span class="secondary t-sub">Cerco nei prodotti del supermercato…</span></div></div>`}
      ${off.stato === 'offline' && html`<div class="list"><div class="row"><${Icon} name="cloudOff" size=${18} class="secondary" /><span class="secondary t-sub">Sei offline: cerco solo tra i tuoi alimenti.</span></div></div>`}
      ${off.stato === 'errore' && html`<div class="list"><div class="row"><${Icon} name="info" size=${18} class="secondary" /><span class="secondary t-sub">Open Food Facts non risponde ora, riprova tra poco.</span></div></div>`}
      ${off.stato === 'ok' && (off.lista.length
        ? html`<div class="list">${off.lista.map(al => html`<${RigaAlimento} titolo=${al.nome} sotto=${[al.marca, 'per 100 ' + al.unita].filter(Boolean).join(' · ')}
            kcal=${al.kcal} immagine=${al.immagine} onApri=${() => apriDettaglio(al)} />`)}</div>`
        : html`<div class="list"><div class="row"><span class="secondary t-sub">Nessun prodotto trovato.</span></div></div>`)}
      <div class="mt-16"><${Button} kind="secondary" block icon="pencil" onClick=${() => setVista({ tipo: 'mano' })}>Inserisci a mano<//></div>
      <p class="t-cap tertiary center mt-12">Dati dei prodotti: Open Food Facts (ODbL)</p>`;
  };

  const schede = {
    pasti: () => {
      const miei = PRESET.filter(p => p.pasto === pasto);
      const altri = PRESET.filter(p => p.pasto !== pasto);
      return html`
        <div class="list">${miei.map(p => html`<${RigaAlimento} titolo=${p.nome} sotto=${`${p.descrizione} · ${p.prot} g proteine`} kcal=${p.kcal}
          icona=${PASTI.find(x => x.key === p.pasto)?.icona} onApri=${() => aggiungiDiretto(p)} onAggiungi=${() => aggiungiDiretto(p)} />`)}</div>
        <p class="section-foot">Un tocco e il pasto è aggiunto. Puoi correggerlo dopo dal diario.</p>
        <details class="altri-pasti">
          <summary>Pasti degli altri momenti</summary>
          <div class="list">${altri.map(p => html`<${RigaAlimento} titolo=${p.nome} sotto=${`${nomePasto(p.pasto)} · ${p.descrizione}`} kcal=${p.kcal}
            icona=${PASTI.find(x => x.key === p.pasto)?.icona} onApri=${() => aggiungiDiretto(p)} onAggiungi=${() => aggiungiDiretto(p)} />`)}</div>
        </details>`;
    },
    recenti: () => recenti.length
      ? html`<div class="list">${recenti.map(c => html`<${RigaAlimento} titolo=${c.nome}
          sotto=${[etichettaQuantita(c), c.prot ? `${fmtNum(c.prot)} g proteine` : null].filter(Boolean).join(' · ')} kcal=${c.kcal} immagine=${c.foto}
          onApri=${() => (daVoce(c) ? apriDettaglio(daVoce(c)) : aggiungiDiretto(c))} onAggiungi=${() => aggiungiDiretto(c)} />`)}</div>`
      : html`<${EmptyState} icon="clockBack" title="Ancora niente" text="Qui trovi gli alimenti che aggiungi più spesso, pronti con un tocco." />`,
    preferiti: () => preferiti.length
      ? html`<div class="list">${preferiti.map(c => html`<${RigaAlimento} titolo=${c.nome}
          sotto=${c.per100 || c.fonte === 'off' || c.fonte === 'db' ? 'Tocca per scegliere la quantità' : `${fmtNum(c.prot || 0)} g proteine`} kcal=${c.kcal}
          onApri=${() => (c.fonte === 'off' || c.fonte === 'db' ? apriDettaglio({ ...c, id: c.rif || c.id }) : aggiungiDiretto(c))}
          onAggiungi=${c.fonte === 'off' || c.fonte === 'db' ? null : () => aggiungiDiretto(c)} />`)}</div>`
      : html`<${EmptyState} icon="star" title="Nessun preferito" text="Apri un alimento e tocca la stella per averlo sempre qui." />`,
    foto: () => html`<${FotoAI} pasto=${pasto} giorno=${giorno} onFatto=${fatto} vai=${vai} />`,
  };

  return html`<div class="aggiungi">
    <div class="scelte pasti-scelta" role="group" aria-label="Pasto">
      ${PASTI.map(p => html`<button type="button" class=${'scelta' + (p.key === pasto ? ' on' : '')} onClick=${() => { aptico(); setPasto(p.key); }}>${p.nome}</button>`)}
    </div>
    <div class="row-flex mt-12">
      <div class="search grow"><${Icon} name="search" />
        <input type="search" placeholder="Cerca alimenti e prodotti" value=${q} onInput=${e => setQ(e.currentTarget.value)} aria-label="Cerca alimento" />
      </div>
      <${IconButton} icon="barcode" label="Scansiona il codice a barre" onClick=${() => setVista({ tipo: 'scanner' })} />
    </div>
    ${!q && ieri.length > 0 && html`<button type="button" class="card copia-ieri mt-12" onClick=${() => { aptico('successo'); const n = A.copiaPasto(addDaysIso(giorno, -1), giorno, pasto); toast(`Copiati ${n} ${n === 1 ? 'alimento' : 'alimenti'}`, 'copy'); chiudi(); }}>
      <${Icon} name="copy" size=${20} class="accent" />
      <span class="grow"><b>Copia ${nomePasto(pasto).toLowerCase()} di ieri</b><span class="t-foot secondary"> · ${ieri.length} ${ieri.length === 1 ? 'alimento' : 'alimenti'}, ${fmtInt(ieri.reduce((t, c) => t + c.kcal, 0))} kcal</span></span>
    </button>`}
    ${q
      ? html`<div class="mt-8">${ricerca()}</div>`
      : html`<div class="mt-16"><${Segmented} value=${tab} onChange=${setTab} label="Tipo di aggiunta" options=${[
          { value: 'pasti', label: 'Pasti' }, { value: 'recenti', label: 'Recenti' }, { value: 'preferiti', label: 'Preferiti' }, { value: 'foto', label: 'Foto AI' }]} /></div>
        <div class="mt-16">${schede[tab]()}</div>`}
  </div>`;
}

/** Apre il foglio per aggiungere cibo a un pasto. */
export function apriAggiungi(giorno, pasto, vai) {
  apriFoglio(chiudi => html`<${Aggiungi} giorno=${giorno} pasto=${pasto} chiudi=${chiudi} vai=${vai} />`, { titolo: 'Aggiungi cibo', alto: true });
}

/* =====================================================================
   Modifica di un cibo già aggiunto
   ===================================================================== */

export function apriModificaCibo(cibo) {
  apriFoglio(chiudi => html`<${ModificaCibo} cibo=${cibo} chiudi=${chiudi} />`, { titolo: 'Modifica' });
}

function ModificaCibo({ cibo, chiudi }) {
  const [q, setQ] = useState(cibo.quantita != null ? String(cibo.quantita) : '');
  const [v, setV] = useState({ nome: cibo.nome, kcal: cibo.kcal, prot: cibo.prot, carb: cibo.carb, grassi: cibo.grassi });
  const [pasto, setPasto] = useState(cibo.pasto);
  const [pref, setPref] = useState(A.ePreferito(cibo));
  const conQuantita = !!cibo.per100;
  const qn = parseNum(q) ?? 0;
  const calc = conQuantita ? perQuantita(cibo.per100, qn) : null;
  const n = k => parseNum(String(v[k])) ?? 0;

  const salva = () => {
    aptico('successo');
    const patch = conQuantita
      ? { quantita: qn, kcal: calc.kcal, prot: calc.prot, carb: calc.carb, grassi: calc.grassi, nome: v.nome, pasto }
      : { nome: v.nome, kcal: Math.round(n('kcal')), prot: n('prot'), carb: n('carb'), grassi: n('grassi'), pasto };
    A.modificaCibo(cibo.id, patch);
    chiudi();
  };
  const set = k => e => setV({ ...v, [k]: e.currentTarget.value });

  return html`<div class="col gap-12">
    ${cibo.foto && html`<img class="stima-img" src=${cibo.foto} alt="" />`}
    <label class="field-label" for="mod-nome">Nome</label>
    <div class="row-flex">
      <input id="mod-nome" class="field" value=${v.nome} onInput=${set('nome')} />
      <button type="button" class=${'stella' + (pref ? ' on' : '')} aria-pressed=${pref ? 'true' : 'false'} aria-label="Preferito"
        onClick=${() => { aptico(); A.preferito(cibo, !pref); setPref(!pref); }}><${Icon} name=${pref ? 'starFill' : 'star'} size=${24} /></button>
    </div>
    ${conQuantita
      ? html`<label class="field-label" for="mod-q">Quantità (${cibo.unita || 'g'})</label>
          <input id="mod-q" class="field num-grande" inputmode="decimal" value=${q} onInput=${e => setQ(e.currentTarget.value)} />
          <div class="det-valori compatti">
            <div class="dv-kcal"><span class="rounded num">${fmtInt(calc.kcal)}</span><small>kcal</small></div>
            <div class="dv-macro">
              <div><span class="dot" style="--c:var(--tono-teal)"></span>Proteine<b class="num">${fmtNum(calc.prot)} g</b></div>
              <div><span class="dot" style="--c:var(--tono-ambra)"></span>Carboidrati<b class="num">${fmtNum(calc.carb)} g</b></div>
              <div><span class="dot" style="--c:var(--tono-lavanda)"></span>Grassi<b class="num">${fmtNum(calc.grassi)} g</b></div>
            </div>
          </div>`
      : html`<div class="griglia-macro">
          ${[['kcal', 'Calorie', 'kcal'], ['prot', 'Proteine', 'g'], ['carb', 'Carboidrati', 'g'], ['grassi', 'Grassi', 'g']].map(([k, l, u]) => html`
            <label class="campo-macro"><span>${l}</span><span class="row-flex gap-6"><input class="field num" inputmode="decimal" value=${v[k]} onInput=${set(k)} aria-label=${l} /><small>${u}</small></span></label>`)}
        </div>`}
    <span class="field-label">Pasto</span>
    <div class="scelte">${PASTI.map(p => html`<button type="button" class=${'scelta' + (p.key === pasto ? ' on' : '')} onClick=${() => setPasto(p.key)}>${p.nome}</button>`)}</div>
    <div class="mt-8"><${Button} block onClick=${salva}>Salva<//></div>
    <${Button} kind="danger" block icon="trash" onClick=${() => { aptico(); A.eliminaCibo(cibo.id); chiudi(); toast('Eliminato', 'trash'); }}>Elimina<//>
  </div>`;
}
