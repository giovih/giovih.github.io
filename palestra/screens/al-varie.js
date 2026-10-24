// Altro → Obiettivi del cibo, Blocca le distrazioni, Privacy e dati, Crediti.

import { html } from '../lib/preact.js';
import * as S from '../data/store.js';
import { List, ListRow, SectionLabel, SectionFoot, RigaNumero } from '../ui/kit.js';
import { Icon } from '../ui/icons.js';
import { toast } from '../ui/overlay.js';
import { aptico } from '../ui/haptics.js';
import { OBIETTIVI_BASE, kcalDaMacro } from '../core/nutrition.js';
import { fmtInt, fmtLitri } from '../core/format.js';
import { parseDay, formatDayShort } from '../core/dates.js';

/* ---------- obiettivi ---------- */

export function PaginaObiettivi() {
  const imp = S.impostazioni();
  const o = imp.obiettivi;
  const set = patch => S.salvaImpostazioni(i => { Object.assign(i.obiettivi, patch); return i; });
  const base = o.baseKcalMin ?? OBIETTIVI_BASE.kcalMin;
  const macroKcal = kcalDaMacro({ prot: o.proteine, carb: o.carboidrati, grassi: o.grassi });
  const diversi = o.kcalMin !== OBIETTIVI_BASE.kcalMin || o.kcalMax !== OBIETTIVI_BASE.kcalMax || o.proteine !== OBIETTIVI_BASE.proteine
    || o.carboidrati !== OBIETTIVI_BASE.carboidrati || o.grassi !== OBIETTIVI_BASE.grassi || o.acquaMl !== OBIETTIVI_BASE.acquaMl;
  const ripristina = () => {
    S.salvaImpostazioni(i => { i.obiettivi = { ...i.obiettivi, ...OBIETTIVI_BASE, ultimoAggiustamento: null }; return i; });
    aptico('successo');
    toast('Obiettivi della scheda ripristinati', 'reset');
  };
  return html`
    <${SectionLabel}>Calorie<//>
    <${List}>
      <${RigaNumero} title="Minimo" value=${o.kcalMin} unit="kcal" step=${50} min=${1500} max=${6000} format=${fmtInt}
        onChange=${v => set({ kcalMin: v, kcalMax: Math.max(v, o.kcalMax) })} />
      <${RigaNumero} title="Massimo" value=${o.kcalMax} unit="kcal" step=${50} min=${o.kcalMin} max=${6500} format=${fmtInt}
        onChange=${v => set({ kcalMax: v })} />
    <//>
    ${o.kcalMin < base
      ? html`<div class="callout warning mt-12"><span class="co-icon"><${Icon} name="warning" /></span>
          <span class="grow"><span class="co-text">È meno delle ${fmtInt(base)} kcal di partenza della scheda: per salire di peso servono abbastanza calorie.</span></span></div>`
      : html`<${SectionFoot}>${o.ultimoAggiustamento
        ? `Aggiornate il ${formatDayShort(parseDay(o.ultimoAggiustamento))} con i consigli del peso.`
        : 'Si aggiornano anche con i consigli del peso (Progressi, Corpo): se non sali, +250 kcal.'}<//>`}

    <${SectionLabel}>Macro<//>
    <${List}>
      <${RigaNumero} title="Proteine" value=${o.proteine} unit="g" step=${5} min=${60} max=${250} onChange=${v => set({ proteine: v })} />
      <${RigaNumero} title="Carboidrati" value=${o.carboidrati} unit="g" step=${10} min=${150} max=${700} onChange=${v => set({ carboidrati: v })} />
      <${RigaNumero} title="Grassi" value=${o.grassi} unit="g" step=${5} min=${40} max=${160} onChange=${v => set({ grassi: v })} />
    <//>
    <${SectionFoot}>Questi macro fanno circa ${fmtInt(macroKcal)} kcal. Le proteine contano di più: almeno 1,6-2 g per kg di peso.<//>

    <${SectionLabel}>Acqua<//>
    <${List}>
      <${RigaNumero} title="Al giorno" value=${o.acquaMl} step=${250} min=${1000} max=${5000} format=${v => fmtLitri(v)} onChange=${v => set({ acquaMl: v })} />
    <//>
    ${diversi && html`<div class="center mt-24"><button type="button" class="btn btn-plain" onClick=${ripristina}>Ripristina gli obiettivi della scheda</button></div>`}`;
}

/* ---------- blocca le distrazioni ---------- */

const Passi = ({ passi }) => html`<ol class="passi">${passi.map(p => html`<li>${p}</li>`)}</ol>`;

export function PaginaBlocco() {
  return html`
    <div class="card info-testa">
      <span class="at-icona"><${Icon} name="nosign" size=${28} /></span>
      <p class="t-sub secondary center">Un'app web non può bloccare le altre app: Apple lo permette solo alle app native con un permesso speciale.
        Con le funzioni dell'iPhone però si fa lo stesso, in pochi minuti.</p>
    </div>

    <${SectionLabel}>Limiti di tempo (il modo più semplice)<//>
    <div class="card"><${Passi} passi=${[
      'Apri Impostazioni, Tempo di utilizzo, Limitazioni app, Aggiungi limitazione.',
      'Scegli le app che ti distraggono (per esempio TikTok e Instagram) e imposta un tempo, per esempio 30 minuti al giorno.',
      'Attiva "Blocca alla fine del limite". Se vuoi che funzioni davvero, fai scegliere il codice di Tempo di utilizzo a un genitore.',
      'Per la sera: Tempo di utilizzo, Tempo di inattività, per esempio dalle 22:30 alle 7:00. Dormire bene fa crescere i muscoli.',
    ]} /><//>

    <${SectionLabel}>In palestra: apri Palestra al posto dei social<//>
    <div class="card"><${Passi} passi=${[
      'Apri l\'app Comandi, scheda Automazione, tocca +, poi "App".',
      'Scegli le app da evitare, seleziona "Viene aperta" e "Esegui subito".',
      'Come azione scegli "Apri app" e poi Palestra (aggiunta alla schermata Home).',
      'Da ora, quando apri una di quelle app si apre Palestra: un promemoria gentile per tornare all\'allenamento.',
    ]} /><//>

    <${SectionLabel}>Full immersion "Palestra"<//>
    <div class="card"><${Passi} passi=${[
      'Impostazioni, Full immersion, tocca +, Personalizzato, chiamala Palestra.',
      'In "App consentite" lascia solo Palestra, Musica e Telefono.',
      'In "Attiva automaticamente" scegli l\'orario della palestra o il luogo della palestra.',
    ]} /><//>
    <${SectionFoot}>Per un vero blocco dentro l'app serve la versione nativa per iPhone (il codice Swift è nella cartella PalestraApp):
      richiede un Mac con Xcode, un account sviluppatore Apple a pagamento e il permesso "Family Controls" di Apple. Dettagli in PROGRESS.md.<//>`;
}

/* ---------- privacy ---------- */

export function PaginaPrivacy() {
  return html`
    <${List}>
      <${ListRow} icon="lock" tile="#34c759" title="Sul telefono" sub="Tutto è salvato nell'app e funziona anche senza internet e senza account." />
      <${ListRow} icon="cloud" tile="#007aff" title="Online, solo se colleghi l'account"
        sub="Nel tuo progetto Supabase. Ogni dato è legato al tuo account: senza la tua password nessuno lo legge. Le foto sono in uno spazio privato." />
      <${ListRow} icon="sparkles" tile="#af52de" title="Coach e stima del cibo"
        sub="La domanda e un riassunto dei dati (o la foto del piatto) passano dalla funzione del tuo progetto e vanno ad Anthropic solo per la risposta. La chiave dell'AI è sul server, mai nell'app." />
      <${ListRow} icon="search" tile="#ff9500" title="Ricerca degli alimenti"
        sub="A Open Food Facts va solo il testo che cerchi o il codice a barre." />
      <${ListRow} icon="nosign" tile="#8e8e93" title="Niente pubblicità" sub="Nessun tracciamento e nessun dato venduto." />
    <//>
    <${SectionFoot}>Per cancellare i dati dal telefono: Altro, Cancella tutti i dati. Per cancellare quelli online elimina il progetto su supabase.com.<//>`;
}

/* ---------- crediti ---------- */

export function PaginaCrediti() {
  return html`
    <${List}>
      <${ListRow} title="Open Food Facts" sub="Database libero degli alimenti, licenza ODbL" />
      <${ListRow} title="Preact e htm" sub="Interfaccia, licenze MIT e Apache 2.0" />
      <${ListRow} title="ZXing" sub="Lettura dei codici a barre, licenza Apache 2.0" />
      <${ListRow} title="Supabase" sub="Salvataggio online e notifiche" />
      <${ListRow} title="Claude di Anthropic" sub="Coach e stima del cibo dalla foto" />
    <//>
    <${SectionFoot}>Icone disegnate per l'app nello stile di iOS. Font di sistema dell'iPhone.<//>`;
}
