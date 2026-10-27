// Scheda "Altro": impostazioni in stile iOS. Le sotto-pagine si aprono una sopra l'altra
// (con la freccia "indietro" o scorrendo dal bordo sinistro dello schermo).

import { html, useState, useEffect, useRef } from '../lib/preact.js';
import * as S from '../data/store.js';
import * as A from '../data/actions.js';
import * as C from '../data/cloud.js';
import { Page, NavBar, List, ListRow, SectionLabel, SectionFoot, Segmented, RigaInterruttore, Button } from '../ui/kit.js';
import { apriFoglio, toast } from '../ui/overlay.js';
import { Icon } from '../ui/icons.js';
import { aptico } from '../ui/haptics.js';
import { scegliFile, salvaFile } from './comuni.js';
import { PaginaSchede, PaginaScheda, PaginaOrari } from './al-programma.js';
import { PaginaNotifiche, riassuntoNotifiche } from './al-notifiche.js';
import { PaginaAccount, statoSync } from './al-account.js';
import { PaginaPrepara } from './al-prepara.js';
import { PaginaObiettivi, PaginaBlocco, PaginaPrivacy, PaginaCrediti } from './al-varie.js';
import { fmtInt } from '../core/format.js';
import { parseDay, formatDayShort, isoDay, mondayOf } from '../core/dates.js';

export const VERSIONE_APP = '2.3.0';

/** Le sotto-pagine: titolo e componente. */
const PAGINE = {
  account: { titolo: 'Salvataggio online', C: PaginaAccount },
  prepara: { titolo: 'Prepara il server', C: PaginaPrepara },
  schede: { titolo: 'Scheda e calendario', C: PaginaSchede },
  scheda: { titolo: v => S.impostazioni().schede[v.cod]?.nome || 'Scheda', C: PaginaScheda },
  orari: { titolo: 'Orari della palestra', C: PaginaOrari },
  obiettivi: { titolo: 'Obiettivi del cibo', C: PaginaObiettivi },
  notifiche: { titolo: 'Notifiche', C: PaginaNotifiche },
  blocco: { titolo: 'Blocca le distrazioni', C: PaginaBlocco },
  privacy: { titolo: 'Privacy e dati', C: PaginaPrivacy },
  crediti: { titolo: 'Crediti', C: PaginaCrediti },
};
const titoloDi = v => { const t = PAGINE[v.id]?.titolo; return typeof t === 'function' ? t(v) : t; };

export function Altro({ hidden, vai }) {
  const [pila, setPila] = useState([]);          // [{ uid, id, ...dati, esce? }]
  const pilaRef = useRef(pila);
  pilaRef.current = pila;
  const uid = useRef(0);
  const apri = (id, dati = {}) => { if (PAGINE[id]) setPila(p => [...p.filter(x => !x.esce), { ...dati, id, uid: ++uid.current }]); };
  // la pagina in cima scivola via a destra e poi viene tolta
  const indietro = () => {
    const vive = pilaRef.current.filter(x => !x.esce);
    if (!vive.length) return;
    const u = vive[vive.length - 1].uid;
    setPila(p => p.map(x => (x.uid === u ? { ...x, esce: true } : x)));
    setTimeout(() => setPila(p => p.filter(x => x.uid !== u)), 340);
  };

  // da altre schede si arriva direttamente a una sotto-pagina (es. "Collega l'account");
  // toccare di nuovo "Altro" nella barra torna all'inizio
  useEffect(() => {
    const sotto = e => { const { scheda, sotto: id } = e.detail || {}; if (scheda === 'altro' && PAGINE[id]) setPila([{ id, uid: ++uid.current }]); };
    const radice = e => { if (e.detail === 'altro') setPila([]); };
    addEventListener('vai-sotto', sotto);
    addEventListener('torna-radice', radice);
    return () => { removeEventListener('vai-sotto', sotto); removeEventListener('torna-radice', radice); };
  }, []);

  return html`
    <${Page} id="altro" hidden=${hidden} title="Altro">
      <${Radice} apri=${apri} vai=${vai} />
    <//>
    ${!hidden && pila.map((v, i) => html`<${SottoPagina} key=${v.uid} voce=${v} livello=${i}
      indietroTesto=${i ? titoloDi(pila[i - 1]) : 'Altro'} apri=${apri} indietro=${indietro} vai=${vai} />`)}`;
}

/* ---------- sotto-pagina con "indietro" e scorrimento dal bordo ---------- */

function SottoPagina({ voce, livello, indietroTesto, apri, indietro, vai }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const P = PAGINE[voce.id];
  const giu = e => {
    if (e.clientX > 26 || e.button > 0) return;
    drag.current = { x0: e.clientX, y0: e.clientY, dx: 0, preso: false, id: e.pointerId };
  };
  const muovi = e => {
    const d = drag.current;
    if (!d) return;
    d.dx = Math.max(0, e.clientX - d.x0);
    if (!d.preso) {
      if (Math.abs(e.clientY - d.y0) > 24) { drag.current = null; return; }
      if (d.dx > 10) { d.preso = true; ref.current.classList.add('trascina'); try { ref.current.setPointerCapture(d.id); } catch { /* niente */ } }
    }
    if (d.preso) ref.current.style.transform = `translateX(${d.dx}px)`;
  };
  const su = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.preso) return;
    ref.current.classList.remove('trascina');
    if (d.dx > Math.min(120, innerWidth * 0.3)) { aptico(); indietro(); } else ref.current.style.transform = '';
  };
  return html`<main ref=${ref} class=${'page sotto-pagina' + (voce.esce ? ' esce' : '')} style=${`z-index:${25 + livello}`}
    aria-label=${titoloDi(voce)} onPointerDown=${giu} onPointerMove=${muovi} onPointerUp=${su} onPointerCancel=${su}>
    <${NavBar} title=${titoloDi(voce)} back=${indietroTesto} onBack=${() => { aptico(); indietro(); }} />
    <div class="page-inner sp-corpo">
      <${P.C} voce=${voce} apri=${apri} indietro=${indietro} vai=${vai} />
    </div>
  </main>`;
}

/* ---------- pagina principale ---------- */

function Radice({ apri, vai }) {
  const imp = S.impostazioni();
  const [cloud, setCloud] = useState(C.stato());
  useEffect(() => C.ascolta(setCloud), []);
  const sync = statoSync();
  const tema = imp.tema;
  const cambiaTema = v => S.salvaImpostazioni(i => ({ ...i, tema: v }));
  const giorniPalestra = [1, 2, 3, 4, 5, 6, 7].filter(g => imp.calendario[g]).length;
  const inizio = parseDay(imp.inizioProgramma);

  return html`
    <${List}>
      <${ListRow} icon=${cloud.collegato ? 'cloudCheck' : 'cloud'} tile=${cloud.collegato ? 'var(--accent)' : '#8e8e93'}
        title=${cloud.collegato ? cloud.email : 'Salvataggio online'}
        sub=${cloud.collegato ? sync.testo : 'Non attivo: i dati sono solo su questo telefono'} chevron onClick=${() => apri('account')} />
    <//>

    <${SectionLabel}>Allenamento<//>
    <${List}>
      <${ListRow} icon="list" tile="#ff9f0a" title="Scheda e calendario" detail=${`${giorniPalestra} giorni`} chevron onClick=${() => apri('schede')} />
      <${ListRow} icon="clock" tile="#5e5ce6" title="Orari della palestra" detail=${imp.palestra.ora} chevron onClick=${() => apri('orari')} />
      <${RigaInterruttore} icon="dumbbell" tile="#a2845e" title="Seduta avambracci" sub="Facoltativa, in un giorno di riposo"
        checked=${imp.avambracci.attivo} onChange=${v => S.salvaImpostazioni(i => { i.avambracci.attivo = v; return i; })} />
      ${imp.avambracci.attivo && html`<div class="row">
        <span class="row-main"><span class="row-title">Giorno</span></span>
        <div class="seg-piccolo"><${Segmented} label="Giorno degli avambracci" value=${+imp.avambracci.giorno}
          options=${[{ value: 2, label: 'Martedì' }, { value: 4, label: 'Giovedì' }]}
          onChange=${v => S.salvaImpostazioni(i => { i.avambracci.giorno = v; return i; })} /></div>
      </div>`}
      <label class="row has-icon">
        <span class="row-icon" style="--tile:#30b0c7"><${Icon} name="calendar" /></span>
        <span class="row-main"><span class="row-title">Inizio programma</span></span>
        <input class="time-input" type="date" value=${imp.inizioProgramma} max=${isoDay()} aria-label="Inizio del programma"
          onChange=${e => { const v = e.currentTarget.value; if (v) S.salvaImpostazioni(i => ({ ...i, inizioProgramma: isoDay(mondayOf(parseDay(v))) })); }} />
      </label>
    <//>
    <${SectionFoot}>Settimana 1 dal lunedì ${inizio ? formatDayShort(inizio) : ''}. Ogni 8 settimane una di scarico.<//>

    <${SectionLabel}>Cibo e notifiche<//>
    <${List}>
      <${ListRow} icon="target" tile="#34c759" title="Obiettivi" detail=${`${fmtInt(imp.obiettivi.kcalMin)} kcal`} chevron onClick=${() => apri('obiettivi')} />
      <${ListRow} icon="bell" tile="#ff3b30" title="Notifiche" detail=${riassuntoNotifiche(imp)} chevron onClick=${() => apri('notifiche')} />
    <//>

    <${SectionLabel}>Aspetto<//>
    <div class="card tema-card">
      <${Segmented} label="Tema" value=${tema} onChange=${cambiaTema}
        options=${[{ value: 'auto', label: 'Automatico' }, { value: 'scuro', label: 'Scuro' }, { value: 'chiaro', label: 'Chiaro' }]} />
    </div>
    <${SectionFoot}>Automatico segue il tema dell'iPhone.<//>

    <${SectionLabel}>Dati<//>
    <${List}>
      <${ListRow} icon="download" tile="#007aff" title="Esporta backup" sub="Un file con tutti i dati, da tenere al sicuro" chevron onClick=${apriEsporta} />
      <${ListRow} icon="doc" tile="#8e8e93" title="Importa backup" sub="Anche quello della versione precedente" chevron onClick=${importa} />
      <${ListRow} icon="clockBack" tile="#8e8e93" title="Versione precedente" sub="La vecchia app, se ti serve qualcosa" chevron
        onClick=${() => { location.href = new URL('v1/', location.href).href; }} />
    <//>

    <${SectionLabel}>Concentrazione<//>
    <${List}>
      <${ListRow} icon="nosign" tile="#5856d6" title="Blocca le distrazioni" sub="Limita le app che ti fanno perdere tempo" chevron onClick=${() => apri('blocco')} />
    <//>

    <${SectionLabel}>Informazioni<//>
    <${List}>
      <${ListRow} icon="shield" tile="#34c759" title="Privacy e dati" chevron onClick=${() => apri('privacy')} />
      <${ListRow} icon="heart" tile="#ff2d55" title="Crediti" chevron onClick=${() => apri('crediti')} />
    <//>

    <div class="center mt-24"><button type="button" class="btn btn-plain danger" onClick=${apriCancella}>Cancella tutti i dati</button></div>
    <p class="versione">Palestra ${VERSIONE_APP}</p>`;
}

/* ---------- backup ---------- */

function apriEsporta() {
  apriFoglio(chiudi => html`<${Esporta} chiudi=${chiudi} />`, { titolo: 'Esporta backup' });
}

function Esporta({ chiudi }) {
  const [conFoto, setConFoto] = useState(true);
  const [lavoro, setLavoro] = useState(false);
  const nFoto = A.foto().length;
  const esporta = async () => {
    setLavoro(true);
    try {
      const b = await S.creaBackup(conFoto);
      const ok = await salvaFile(`palestra-backup-${isoDay()}.json`, JSON.stringify(b));
      if (ok) { aptico('successo'); toast('Backup pronto', 'download'); chiudi(); }
    } catch {
      toast('Non sono riuscito a creare il file', 'info');
    } finally { setLavoro(false); }
  };
  return html`<div>
    <p class="t-sub secondary">Il file contiene allenamenti, cibo, peso, diario e impostazioni. Salvalo in File o mandalo a te stesso:
      con "Importa backup" torna tutto com'era, anche su un altro telefono.</p>
    <div class="list mt-16">
      <${RigaInterruttore} title="Includi le foto" sub=${nFoto ? `${nFoto} ${nFoto === 1 ? 'foto' : 'foto'}: il file diventa più grande` : 'Nessuna foto salvata'}
        checked=${conFoto && nFoto > 0} disabled=${!nFoto} onChange=${setConFoto} />
    </div>
    <div class="mt-24"><${Button} block icon="share" disabled=${lavoro} onClick=${esporta}>${lavoro ? 'Preparo il file…' : 'Esporta'}<//></div>
  </div>`;
}

async function importa() {
  const f = await scegliFile({ accept: '.json,application/json' });
  if (!f) return;
  try {
    const r = await S.importaFile(await f.text());
    aptico('successo');
    toast(r.tipo === 'vecchio' ? 'Dati della versione precedente importati' : `Backup importato: ${r.n} elementi`, 'checkCircle');
  } catch (e) {
    toast(e instanceof SyntaxError ? 'Il file non è un backup valido' : (e.message || 'Il file non è un backup valido'), 'info');
  }
}

/* ---------- cancella tutto ---------- */

function apriCancella() {
  apriFoglio(chiudi => html`<${Cancella} chiudi=${chiudi} />`, { titolo: 'Cancella tutti i dati' });
}

function Cancella({ chiudi }) {
  const [testo, setTesto] = useState('');
  const ok = testo.trim().toUpperCase() === 'CANCELLA';
  return html`<div>
    <p class="t-sub">Tutti gli allenamenti, il cibo, il peso, il diario e le foto spariscono da questo telefono. Non si può annullare.</p>
    <p class="t-sub secondary mt-8">${C.collegato()
      ? 'I dati salvati online restano: se accedi di nuovo tornano. Per cancellarli anche online elimina il progetto Supabase.'
      : 'Se non hai un backup, li perdi per sempre.'}</p>
    <label class="campo-diario mt-16">
      <span class="field-label">Scrivi CANCELLA per confermare</span>
      <input class="field" value=${testo} autocapitalize="characters" onInput=${e => setTesto(e.currentTarget.value)} />
    </label>
    <div class="mt-16"><${Button} kind="danger" block disabled=${!ok} onClick=${async () => {
      await S.cancellaTutto();
      aptico('forte');
      chiudi();
      toast('Dati cancellati', 'trash');
    }}>Cancella tutto<//></div>
  </div>`;
}

