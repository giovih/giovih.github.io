import { CATEGORIE, categoria, CALORE, STILI, ORDINE, proponi, bisogni, mancanze, spiegazione, nomeColore } from "./stilista.js";
import * as archivio from "./archivio.js";
import { previsioni, cercaCitta, posizioneAttuale, descrizione } from "./meteo.js";

const $ = s => document.querySelector(s);

let capi = [];
let meteo = null;             // { giorni, aggiornato, offline }
let erroreMeteo = "";
let pagina = leggi("armadio:pagina", "settimana");
let filtro = "tutti";
let impostazioni = leggi("armadio:impostazioni", { citta: null, freddoloso: 0, stile: "" });
let piano = leggi("armadio:piano", {});   // { "2026-10-12": { ids, punti, t, pioggia, variante, esclusi, manuale, indossato } }

// ---------- utilità ----------

function h(tag, attr = {}, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const f of figli.flat()) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(f));
  }
  return el;
}
function riempi(el, ...figli) { el.replaceChildren(...figli.flat().filter(f => f != null && f !== false)); }

function leggi(k, base) { try { return JSON.parse(localStorage.getItem(k)) ?? base; } catch { return base; } }
function scrivi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const salvaPiano = () => scrivi("armadio:piano", piano);
const salvaImpostazioni = () => scrivi("armadio:impostazioni", impostazioni);
const vibra = ms => { try { navigator.vibrate?.(ms); } catch {} };

const ICONE = {
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  gruccia: '<path d="M12 7.5a2 2 0 1 1 2-2c0 1-1 1.5-2 2.2v1.3"/><path d="M12 9L3.2 15.4a1.5 1.5 0 0 0 .9 2.6h15.8a1.5 1.5 0 0 0 .9-2.6z"/>',
  bucato: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="13" r="4.5"/><path d="M7.5 6.5h1M11 6.5h1"/>',
  ingranaggio: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  galleria: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-5-5-9 9"/>',
  rigenera: '<path d="M20 11.5A8 8 0 0 0 5.6 6.8L4 8.5M4 4v4.5h4.5M4 12.5a8 8 0 0 0 14.4 4.7L20 15.5M20 20v-4.5h-4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chiudi: '<path d="M6 6l12 12M18 6L6 18"/>',
  lucchetto: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  aperto: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1.2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  cestino: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  stella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  scarica: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  carica: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  freccia: '<path d="M9 6l6 6-6 6"/>'
};
function icona(nome, cls = "") {
  const t = document.createElement("template");
  t.innerHTML = `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[nome]}</svg>`;
  return t.content.firstChild;
}

// Le foto si mostrano tramite URL temporanei, creati una volta sola per capo.
const urlFoto = new Map();
function foto(capo) {
  if (!capo?.foto) return null;
  let u = urlFoto.get(capo.id);
  if (!u || u.blob !== capo.foto) {
    if (u) URL.revokeObjectURL(u.url);
    u = { url: URL.createObjectURL(capo.foto), blob: capo.foto };
    urlFoto.set(capo.id, u);
  }
  return u.url;
}
function miniatura(capo, cls = "") {
  const u = foto(capo);
  return u
    ? h("img", { class: `foto ${cls}`, src: u, alt: nomeCapo(capo), loading: "lazy", decoding: "async" })
    : h("span", { class: `foto vuota ${cls}`, style: `--col:${capo.colore || "#999"}` }, categoria(capo.categoria)?.icona || "👚");
}

const nomeCapo = c => c.nome?.trim() || `${categoria(c.categoria)?.uno || "Capo"} ${nomeColore(c.colore)}`;
const lavaggioOgni = c => c.lavaggioOgni ?? categoria(c.categoria)?.usi ?? 1;

// ---------- date ----------

const due = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
const oggi = () => iso(new Date());
const daIso = s => new Date(s + "T12:00:00");

// Lunedì–venerdì di questa settimana; nel weekend quelli della prossima.
function settimana() {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const g = d.getDay();
  d.setDate(d.getDate() + (g === 6 ? 2 : g === 0 ? 1 : 1 - g));
  return Array.from({ length: 5 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return iso(x); });
}
const nomeGiorno = s => daIso(s).toLocaleDateString("it-IT", { weekday: "long" });
const dataBreve = s => daIso(s).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
const maiuscola = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- avvisi ----------

let timerToast;
function toast(testo, azione, fn) {
  const t = $("#toast");
  riempi(t, h("span", {}, testo),
    azione ? h("button", { type: "button", onclick: () => { t.classList.remove("su"); fn(); } }, azione) : null);
  t.classList.add("su");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove("su"), azione ? 5000 : 2600);
}

// ---------- il piano della settimana ----------

const capoDa = id => capi.find(c => c.id === id);
const outfitDa = ids => {
  const o = {};
  for (const id of ids) { const c = capoDa(id); if (c) o[c.categoria] = c; }
  return o;
};

function usatiTranne(data, giorni) {
  const m = new Map();
  for (const g of giorni) if (g !== data) for (const id of piano[g]?.ids || []) m.set(id, (m.get(id) || 0) + 1);
  return m;
}

// Il giorno va ricalcolato? Sì se manca, se un capo è sparito o sporco, o se il meteo è cambiato molto.
function daRifare(data, voce, m) {
  if (!voce?.ids?.length) return "nuovo";
  if (voce.indossato || data < oggi()) return false;
  for (const id of voce.ids) {
    const c = capoDa(id);
    if (!c || !c.categoria || c.stato === "sporco" || voce.esclusi?.includes(id)) return "sostituisci";
  }
  if (voce.manuale || !m) return false;
  const b = bisogni(m, impostazioni.freddoloso);
  if (voce.t == null || Math.abs(b.t - voce.t) > 3 || b.pioggia !== voce.pioggia) return "meteo";
  return false;
}

function scegli(data, giorni, { variante = 0, vicinoA = null } = {}) {
  const m = meteo?.giorni?.[data];
  if (!m) return null;
  const voce = piano[data] || {};
  const proposte = proponi(capi, m, {
    data, usati: usatiTranne(data, giorni), esclusi: voce.esclusi || [],
    freddoloso: impostazioni.freddoloso, stile: impostazioni.stile
  });
  if (!proposte.length) return null;
  let scelta = proposte[variante % proposte.length];
  // Se si cambia solo un capo, si tiene l'outfit il più simile possibile a prima.
  if (vicinoA?.length) {
    const quanti = p => p.ids.filter(id => vicinoA.includes(id)).length;
    scelta = proposte.slice().sort((a, b) => quanti(b) - quanti(a) || a.punti - b.punti)[0];
  }
  const b = bisogni(m, impostazioni.freddoloso);
  return { ...voce, ids: scelta.ids, punti: scelta.punti, t: b.t, pioggia: b.pioggia, variante, manuale: false };
}

// L'armadio è cambiato (capi nuovi o modificati): i giorni non ancora indossati né fissati si rifanno.
function rifaiSettimana() {
  for (const k of settimana()) if (k >= oggi() && piano[k] && !piano[k].indossato && !piano[k].manuale) delete piano[k];
}

// Aggiorna il piano; restituisce i giorni in cui un capo sporco è stato sostituito.
function pianifica() {
  const giorni = settimana();
  const cambiati = [];
  if (!meteo) return cambiati;
  for (const data of giorni) {
    const motivo = daRifare(data, piano[data], meteo.giorni[data]);
    if (!motivo) continue;
    if (data < oggi() && motivo === "nuovo") continue;
    const prima = piano[data]?.ids;
    const nuova = scegli(data, giorni, motivo === "sostituisci" ? { vicinoA: prima, variante: piano[data].variante || 0 } : {});
    if (nuova) { piano[data] = nuova; if (motivo === "sostituisci") cambiati.push(data); }
    else if (piano[data]) piano[data].ids = [];
  }
  // il piano tiene solo le ultime settimane
  const limite = iso(new Date(Date.now() - 21 * 86400000));
  for (const k of Object.keys(piano)) if (k < limite) delete piano[k];
  salvaPiano();
  return cambiati;
}

function altroOutfit(data) {
  vibra(8);
  const v = (piano[data]?.variante || 0) + 1;
  const nuova = scegli(data, settimana(), { variante: v });
  if (nuova) { piano[data] = nuova; salvaPiano(); }
  disegna();
}

function bloccaGiorno(data) {
  const voce = piano[data];
  voce.manuale = !voce.manuale;
  salvaPiano();
  toast(voce.manuale ? "Outfit fissato: non cambierà col meteo" : "L'outfit si adatterà di nuovo al meteo");
  disegna();
}

async function indossato(data) {
  const voce = piano[data];
  const copie = voce.ids.map(id => ({ ...capoDa(id) })).filter(c => c.id);
  const sporchi = [];
  for (const id of voce.ids) {
    const c = capoDa(id); if (!c) continue;
    c.usi = (c.usi || 0) + 1;
    c.ultimoUso = data;
    const ogni = lavaggioOgni(c);
    if (ogni > 0 && c.usi >= ogni) { c.stato = "sporco"; sporchi.push(nomeCapo(c)); }
    await archivio.salva(c);
  }
  voce.indossato = true;
  pianifica(); salvaPiano();
  vibra(15);
  toast(sporchi.length ? `Da lavare: ${sporchi.join(", ")}` : "Segnato come indossato", "Annulla", async () => {
    await archivio.salvaTanti(copie);
    copie.forEach(c => { const i = capi.findIndex(x => x.id === c.id); if (i >= 0) capi[i] = c; });
    voce.indossato = false; salvaPiano(); pianifica(); disegna();
  });
  disegna();
}

async function segnaSporco(capo, sporco = true) {
  capo.stato = sporco ? "sporco" : "pulito";
  if (!sporco) capo.usi = 0;
  await archivio.salva(capo);
  const cambiati = pianifica();
  disegna();
  return cambiati;
}

// ---------- caricamento ----------

async function caricaMeteo(forza = false) {
  if (!impostazioni.citta) return;
  try {
    if (forza) localStorage.removeItem("armadio:meteo");
    meteo = await previsioni(impostazioni.citta);
    erroreMeteo = "";
  } catch (e) { erroreMeteo = e.message; }
  pianifica();
  disegna();
}

// ---------- disegno delle pagine ----------

const PAGINE = [
  { id: "settimana", nome: "Settimana", icona: "calendario" },
  { id: "armadio", nome: "Armadio", icona: "gruccia" },
  { id: "bucato", nome: "Bucato", icona: "bucato" },
  { id: "impostazioni", nome: "Impostazioni", icona: "ingranaggio" }
];

function disegna() {
  const sporchi = capi.filter(c => c.stato === "sporco").length;
  riempi($("#tabs"), PAGINE.map(p => h("button", {
    type: "button", class: `tab ${p.id === pagina ? "attiva" : ""}`, "aria-current": p.id === pagina ? "page" : null,
    onclick: () => { if (pagina !== p.id) { pagina = p.id; scrivi("armadio:pagina", pagina); disegna(); scrollTo({ top: 0 }); } }
  }, icona(p.icona), h("span", {}, p.nome), p.id === "bucato" && sporchi ? h("b", { class: "conta" }, sporchi) : null)));

  const main = $("#pagina");
  const fn = { settimana: paginaSettimana, armadio: paginaArmadio, bucato: paginaBucato, impostazioni: paginaImpostazioni }[pagina];
  riempi(main, fn());
}

function paginaSettimana() {
  const giorni = settimana();
  const parti = [];
  const fineSettimana = [0, 6].includes(new Date().getDay());

  parti.push(h("div", { class: "intesta" },
    h("div", {},
      h("p", { class: "occhiello" }, fineSettimana ? "La prossima settimana" : "Questa settimana"),
      h("h1", {}, "I tuoi outfit")
    ),
    impostazioni.citta ? h("button", { type: "button", class: "chip", onclick: () => apriCitta() },
      icona("pin"), impostazioni.citta.nome) : null
  ));

  if (!impostazioni.citta) {
    parti.push(vuoto("📍", "Dove ti trovi?", "Mi serve la città per sapere che tempo farà.",
      h("button", { type: "button", class: "btn primario", onclick: () => apriCitta() }, "Scegli la città")));
    return parti;
  }
  const manca = mancanze(capi);
  if (!capi.some(c => c.categoria)) {
    parti.push(vuoto("👚", "L'armadio è vuoto", "Fotografa i tuoi vestiti (o caricali dalla galleria) e ti preparo gli outfit da lunedì a venerdì.",
      h("button", { type: "button", class: "btn primario", onclick: () => { pagina = "armadio"; disegna(); } }, "Aggiungi i vestiti")));
    return parti;
  }
  if (manca.length) parti.push(h("div", { class: "avviso" }, `Per proporti un outfit mi serve ${manca.join(" e ")} pulito. Controlla il bucato o aggiungi capi.`));
  if (erroreMeteo) parti.push(h("div", { class: "avviso" }, erroreMeteo,
    h("button", { type: "button", class: "link", onclick: () => caricaMeteo(true) }, "Riprova")));
  else if (meteo?.offline) parti.push(h("div", { class: "avviso tenue" }, "Sei offline: uso le ultime previsioni scaricate."));
  if (!meteo && !erroreMeteo) parti.push(h("div", { class: "carica" }, "Scarico le previsioni…"));

  const daCompletare = capi.filter(c => !c.categoria).length;
  if (daCompletare) parti.push(h("button", { type: "button", class: "avviso azione", onclick: completaProssimo },
    `${daCompletare === 1 ? "1 foto" : daCompletare + " foto"} da completare: dimmi cosa sono e le userò`, icona("freccia")));

  for (const data of giorni) parti.push(cardGiorno(data, giorni));
  if (meteo) parti.push(h("p", { class: "piede" }, "Previsioni Open-Meteo · aggiornate ",
    new Date(meteo.aggiornato).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }), " · ",
    h("button", { type: "button", class: "link", onclick: () => caricaMeteo(true) }, "aggiorna")));
  return parti;
}

function cardGiorno(data, giorni) {
  const m = meteo?.giorni?.[data];
  const voce = piano[data];
  const passato = data < oggi();
  const eOggi = data === oggi();
  const [desc, emoji] = m ? descrizione(m.codice) : ["", ""];

  const testa = h("div", { class: "giorno-testa" },
    h("div", {},
      h("h2", {}, maiuscola(nomeGiorno(data)), eOggi ? h("span", { class: "pill" }, "Oggi") : null),
      h("p", { class: "data" }, dataBreve(data))
    ),
    m ? h("div", { class: "meteo", title: desc },
      h("span", { class: "emoji" }, emoji),
      h("div", {},
        h("b", {}, `${Math.round(m.tMax)}°`), h("span", { class: "min" }, ` ${Math.round(m.tMin)}°`),
        h("small", {}, m.pioggiaProb >= 20 ? `💧 ${m.pioggiaProb}%` : desc)
      )
    ) : null
  );

  const corpo = [];
  if (!m) corpo.push(h("p", { class: "tenue" }, meteo ? "Previsioni non ancora disponibili." : ""));
  else if (!voce?.ids?.length) corpo.push(h("p", { class: "tenue" }, passato ? "Nessun outfit registrato." : "Non trovo una combinazione con i capi puliti."));
  else {
    corpo.push(h("p", { class: "consiglio" }, spiegazione(m, impostazioni.freddoloso)));
    const o = outfitDa(voce.ids);
    corpo.push(h("div", { class: "outfit" }, ORDINE.filter(k => o[k]).map(k => {
      const c = o[k];
      return h("button", { type: "button", class: `pezzo ${c.stato === "sporco" ? "sporco" : ""}`, onclick: () => azioniPezzo(data, c) },
        miniatura(c),
        h("span", { class: "pezzo-nome" }, nomeCapo(c)));
    })));
    const azioni = [];
    if (!passato && !voce.indossato) {
      azioni.push(h("button", { type: "button", class: "btn", onclick: () => altroOutfit(data) }, icona("rigenera"), "Altro outfit"));
      azioni.push(h("button", { type: "button", class: `btn tondo ${voce.manuale ? "acceso" : ""}`, "aria-label": voce.manuale ? "Sblocca" : "Fissa questo outfit", title: "Fissa", onclick: () => bloccaGiorno(data) }, icona(voce.manuale ? "lucchetto" : "aperto")));
    }
    if (data <= oggi()) {
      azioni.push(voce.indossato
        ? h("span", { class: "fatto" }, icona("check"), "Indossato")
        : h("button", { type: "button", class: "btn primario", onclick: () => indossato(data) }, icona("check"), "L'ho indossato"));
    }
    if (azioni.length) corpo.push(h("div", { class: "azioni" }, azioni));
  }
  return h("section", { class: `giorno ${eOggi ? "oggi" : ""} ${passato ? "passato" : ""}`, id: `g-${data}` }, testa, corpo);
}

function vuoto(emoji, titolo, testo, ...extra) {
  return h("div", { class: "vuoto" }, h("div", { class: "vuoto-emoji" }, emoji), h("h2", {}, titolo), h("p", {}, testo), extra);
}

// ---------- azioni su un capo dell'outfit ----------

function azioniPezzo(data, capo) {
  const d = $("#foglio");
  const passato = data < oggi() || piano[data]?.indossato;
  const chiudi = () => d.close();
  const scelte = passato ? [] : [
    h("button", { type: "button", class: "voce", onclick: async () => {
      chiudi();
      const cambiati = await segnaSporco(capo, true);
      toast(cambiati.length ? `${nomeCapo(capo)} va al bucato: ti ho proposto un'alternativa` : `${nomeCapo(capo)} va al bucato`, "Annulla", () => segnaSporco(capo, false));
    } }, h("span", { class: "voce-ic" }, "🧺"), h("span", {}, h("b", {}, "È sporco"), h("small", {}, "Va nel bucato e lo sostituisco in tutti i giorni"))),
    h("button", { type: "button", class: "voce", onclick: () => {
      chiudi();
      const voce = piano[data];
      voce.esclusi = [...(voce.esclusi || []), capo.id];
      const nuova = scegli(data, settimana(), { vicinoA: voce.ids });
      if (nuova) piano[data] = nuova; else toast("Non ho alternative pulite per questo capo");
      salvaPiano(); disegna();
    } }, h("span", { class: "voce-ic" }, "🙅"), h("span", {}, h("b", {}, "Non mi va / non disponibile"), h("small", {}, "Lo cambio solo per questo giorno"))),
    h("button", { type: "button", class: "voce", onclick: () => { chiudi(); sceltaManuale(data, capo); } },
      h("span", { class: "voce-ic" }, "👆"), h("span", {}, h("b", {}, "Scelgo io"), h("small", {}, `Mostra gli altri capi: ${categoria(capo.categoria).nome.toLowerCase()}`)))
  ];
  riempi(d,
    h("div", { class: "foglio-testa" }, miniatura(capo, "grande"),
      h("div", {}, h("h2", {}, nomeCapo(capo)), h("p", { class: "tenue" }, `${categoria(capo.categoria).uno} · ${CALORE[capo.calore || 3].toLowerCase()}`)),
      h("button", { type: "button", class: "chiudi", "aria-label": "Chiudi", onclick: chiudi }, icona("chiudi"))),
    h("div", { class: "voci" }, scelte,
      h("button", { type: "button", class: "voce", onclick: () => { chiudi(); schedaCapo(capo); } },
        h("span", { class: "voce-ic" }, "✏️"), h("span", {}, h("b", {}, "Apri la scheda"), h("small", {}, "Modifica le informazioni del capo"))))
  );
  d.showModal();
}

function sceltaManuale(data, capo) {
  const d = $("#foglio");
  const altri = capi.filter(c => c.categoria === capo.categoria && c.id !== capo.id && c.stato !== "sporco");
  riempi(d,
    h("div", { class: "foglio-testa" }, h("div", {}, h("h2", {}, "Scegli tu"), h("p", { class: "tenue" }, categoria(capo.categoria).nome + " puliti")),
      h("button", { type: "button", class: "chiudi", "aria-label": "Chiudi", onclick: () => d.close() }, icona("chiudi"))),
    altri.length ? h("div", { class: "griglia scelta" }, altri.map(c => h("button", { type: "button", class: "capo", onclick: () => {
      const voce = piano[data];
      voce.ids = voce.ids.map(id => id === capo.id ? c.id : id);
      voce.manuale = true;
      salvaPiano(); d.close(); disegna();
      toast("Fatto: l'outfit è fissato con la tua scelta");
    } }, miniatura(c), h("span", { class: "capo-nome" }, nomeCapo(c))))) : h("p", { class: "tenue" }, "Non ci sono altri capi puliti di questo tipo.")
  );
  d.showModal();
}

// ---------- armadio ----------

function paginaArmadio() {
  const conta = id => capi.filter(c => c.categoria === id).length;
  const lista = capi
    .filter(c => filtro === "tutti" ? true : filtro === "nuovi" ? !c.categoria : c.categoria === filtro)
    .sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || (b.creato || 0) - (a.creato || 0));
  const daCompletare = capi.filter(c => !c.categoria).length;

  return [
    h("div", { class: "intesta" }, h("div", {},
      h("p", { class: "occhiello" }, capi.length === 1 ? "1 capo" : `${capi.length} capi`),
      h("h1", {}, "Il tuo armadio"))),
    h("div", { class: "aggiungi" },
      h("label", { class: "btn primario grande" }, icona("camera"), "Scatta una foto",
        h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true, onchange: e => aggiungiFoto(e.target) })),
      h("label", { class: "btn grande" }, icona("galleria"), "Dalla galleria",
        h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: e => aggiungiFoto(e.target) }))
    ),
    daCompletare ? h("button", { type: "button", class: "avviso azione", onclick: completaProssimo },
      `${daCompletare === 1 ? "1 foto" : daCompletare + " foto"} da completare`, icona("freccia")) : null,
    h("div", { class: "filtri" },
      h("button", { type: "button", class: `chip ${filtro === "tutti" ? "attivo" : ""}`, onclick: () => { filtro = "tutti"; disegna(); } }, "Tutti"),
      CATEGORIE.filter(c => conta(c.id)).map(c => h("button", { type: "button", class: `chip ${filtro === c.id ? "attivo" : ""}`, onclick: () => { filtro = c.id; disegna(); } },
        `${c.icona} ${c.nome}`, h("span", { class: "n" }, conta(c.id))))
    ),
    lista.length ? h("div", { class: "griglia" }, lista.map(c => h("button", { type: "button", class: `capo ${c.stato === "sporco" ? "sporco" : ""} ${!c.categoria ? "nuovo" : ""}`, onclick: () => schedaCapo(c) },
      miniatura(c),
      c.stato === "sporco" ? h("span", { class: "etichetta" }, "Da lavare") : !c.categoria ? h("span", { class: "etichetta blu" }, "Da completare") : null,
      c.preferito ? h("span", { class: "cuore" }, icona("stella")) : null,
      h("span", { class: "capo-nome" }, c.categoria ? nomeCapo(c) : "Nuovo capo")
    ))) : capi.length ? null : vuoto("📸", "Fotografa i tuoi vestiti", "Puoi scattare una foto alla volta o scegliere tante foto insieme dalla galleria. Il colore lo riconosco io.")
  ];
}

async function aggiungiFoto(input) {
  const files = [...input.files];
  input.value = "";
  if (!files.length) return;
  toast(files.length === 1 ? "Preparo la foto…" : `Preparo ${files.length} foto…`);
  const nuovi = [];
  for (const f of files) {
    try {
      const { foto: blob, colore } = await archivio.preparaFoto(f);
      const c = { id: archivio.nuovoId(), foto: blob, colore, nome: "", categoria: null, calore: 3, stile: "casual",
        impermeabile: false, preferito: false, stato: "pulito", usi: 0, lavaggioOgni: null, creato: Date.now() + nuovi.length };
      await archivio.salva(c);
      capi.push(c); nuovi.push(c);
    } catch (e) { toast(e.message); }
  }
  disegna();
  if (nuovi.length) {
    if (nuovi.length > 1) toast(`Aggiunte ${nuovi.length} foto: ora dimmi cosa sono`);
    schedaCapo(nuovi[0], true);
  }
}

function completaProssimo() {
  const c = capi.filter(x => !x.categoria).sort((a, b) => (a.creato || 0) - (b.creato || 0))[0];
  if (c) schedaCapo(c, true);
}

function schedaCapo(capo, inSequenza = false) {
  const d = $("#scheda");
  const bozza = { ...capo };
  const rimasti = () => capi.filter(x => !x.categoria && x.id !== capo.id).length;

  const nome = h("input", { class: "campo", value: capo.nome || "", placeholder: "Nome (facoltativo)", maxlength: 60 });
  const colore = h("input", { type: "color", class: "colore", value: capo.colore || "#888888", "aria-label": "Colore" });
  const nomeCol = h("span", { class: "tenue" }, nomeColore(colore.value));
  colore.addEventListener("input", () => { bozza.colore = colore.value; nomeCol.textContent = nomeColore(colore.value); });

  function gruppo(valori, chiave, etichetta, onPick) {
    const box = h("div", { class: "segmenti", role: "radiogroup", "aria-label": etichetta });
    const ridisegna = () => riempi(box, valori.map(v => h("button", {
      type: "button", role: "radio", "aria-checked": String(bozza[chiave] === v.id), class: `seg ${bozza[chiave] === v.id ? "attivo" : ""}`,
      onclick: () => { bozza[chiave] = v.id; onPick?.(v.id); ridisegna(); }
    }, v.nome)));
    ridisegna();
    return box;
  }
  const lavaggio = h("input", { type: "number", class: "campo piccolo", min: 0, max: 99, inputmode: "numeric",
    value: capo.lavaggioOgni ?? "", placeholder: String(categoria(capo.categoria)?.usi ?? 1) });
  const cat = gruppo(CATEGORIE.map(c => ({ id: c.id, nome: `${c.icona} ${c.uno}` })), "categoria", "Tipo", id => {
    lavaggio.placeholder = String(categoria(id).usi);
    // calore tipico per tipo di capo, se non è stato ancora scelto a mano
    if (!capo.categoria && !caloreToccato) { bozza.calore = { sopra: 2, strato: 3, sotto: 3, intero: 2, capospalla: 3, scarpe: 2 }[id]; ridisegnaCalore(); }
  });
  let caloreToccato = false;
  const calBox = h("div");
  const ridisegnaCalore = () => riempi(calBox, gruppo([1, 2, 3, 4, 5].map(n => ({ id: n, nome: CALORE[n] })), "calore", "Calore", () => { caloreToccato = true; }));
  ridisegnaCalore();

  const imperm = h("input", { type: "checkbox", checked: !!capo.impermeabile });
  const pref = h("input", { type: "checkbox", checked: !!capo.preferito });

  async function salva(e) {
    e?.preventDefault();
    if (!bozza.categoria) { toast("Scegli che tipo di capo è"); return; }
    const cambiaScelta = ["categoria", "calore", "stile", "colore"].some(k => capo[k] !== bozza[k])
      || capo.impermeabile !== imperm.checked || capo.preferito !== pref.checked;
    Object.assign(capo, bozza, {
      nome: nome.value.trim(), colore: colore.value, impermeabile: imperm.checked, preferito: pref.checked,
      lavaggioOgni: lavaggio.value === "" ? null : Math.max(0, Math.min(99, +lavaggio.value))
    });
    await archivio.salva(capo);
    d.close();
    if (cambiaScelta) rifaiSettimana();
    pianifica(); disegna();
    if (inSequenza && rimasti()) completaProssimo();
  }

  riempi(d, h("form", { method: "dialog", onsubmit: salva },
    h("div", { class: "scheda-foto" }, miniatura(capo, "grande"),
      h("button", { type: "button", class: "chiudi su-foto", "aria-label": "Chiudi", onclick: () => d.close() }, icona("chiudi"))),
    h("div", { class: "scheda-corpo" },
      inSequenza && rimasti() ? h("p", { class: "occhiello" }, `Ancora ${rimasti()} dopo questa`) : null,
      h("label", { class: "etichetta-campo" }, "Che cos'è?"), cat,
      h("label", { class: "etichetta-campo" }, "Quanto tiene caldo?"), calBox,
      h("label", { class: "etichetta-campo" }, "Colore"),
      h("div", { class: "riga" }, colore, nomeCol, h("small", { class: "tenue destra" }, "riconosciuto dalla foto: toccalo per cambiarlo")),
      h("label", { class: "etichetta-campo" }, "Stile"), gruppo(STILI, "stile", "Stile"),
      h("label", { class: "interruttore" }, imperm, h("span", {}, "Va bene con la pioggia (impermeabile)")),
      h("label", { class: "interruttore" }, pref, h("span", {}, "Uno dei miei preferiti")),
      h("label", { class: "etichetta-campo" }, "Da lavare dopo quante volte?"),
      h("div", { class: "riga" }, lavaggio, h("small", { class: "tenue" }, "0 = non va mai al bucato (es. scarpe)")),
      h("label", { class: "etichetta-campo" }, "Nome"), nome,
      capo.categoria ? h("div", { class: "riga stato-capo" },
        h("span", {}, capo.stato === "sporco" ? "🧺 Ora è nel bucato" : "✨ Ora è pulito"),
        h("button", { type: "button", class: "btn", onclick: async () => { d.close(); await segnaSporco(capo, capo.stato !== "sporco"); } },
          capo.stato === "sporco" ? "Segna pulito" : "Segna sporco")) : null,
      h("div", { class: "azioni" },
        h("button", { type: "button", class: "btn pericolo", onclick: () => eliminaCapo(capo, d) }, icona("cestino"), "Elimina"),
        h("button", { type: "submit", class: "btn primario" }, icona("check"), inSequenza && rimasti() ? "Salva e avanti" : "Salva"))
    )
  ));
  d.showModal();
}

async function eliminaCapo(capo, d) {
  if (!confirm(`Eliminare ${nomeCapo(capo)} dall'armadio?`)) return;
  await archivio.elimina(capo.id);
  capi = capi.filter(c => c.id !== capo.id);
  d.close();
  pianifica(); disegna();
  toast("Capo eliminato", "Annulla", async () => { await archivio.salva(capo); capi.push(capo); pianifica(); disegna(); });
}

// ---------- bucato ----------

function paginaBucato() {
  const sporchi = capi.filter(c => c.stato === "sporco");
  const quasi = capi.filter(c => c.stato !== "sporco" && c.categoria && lavaggioOgni(c) > 1 && (c.usi || 0) > 0)
    .sort((a, b) => (b.usi / lavaggioOgni(b)) - (a.usi / lavaggioOgni(a)));
  return [
    h("div", { class: "intesta" }, h("div", {},
      h("p", { class: "occhiello" }, sporchi.length ? `${sporchi.length} da lavare` : "Tutto pulito"),
      h("h1", {}, "Bucato")),
      sporchi.length ? h("button", { type: "button", class: "btn primario", onclick: async () => {
        for (const c of sporchi) { c.stato = "pulito"; c.usi = 0; }
        await archivio.salvaTanti(sporchi);
        rifaiSettimana(); pianifica(); disegna(); vibra(15);
        toast(`${sporchi.length === 1 ? "1 capo pulito" : sporchi.length + " capi puliti"}: di nuovo nell'armadio`);
      } }, icona("check"), "Tutto lavato") : null),
    sporchi.length ? h("ul", { class: "lista" }, sporchi.map(c => h("li", { class: "riga-capo" },
      miniatura(c, "piccola"),
      h("span", { class: "riga-nome" }, h("b", {}, nomeCapo(c)), h("small", {}, c.ultimoUso ? `Messo ${dataBreve(c.ultimoUso)}` : categoria(c.categoria)?.uno)),
      h("button", { type: "button", class: "btn", onclick: async () => { await segnaSporco(c, false); toast(`${nomeCapo(c)} è di nuovo pulito`); } }, "Lavato")
    ))) : vuoto("🧺", "Il cesto è vuoto", "Quando un capo è sporco segnalo dall'outfit del giorno o premi \"L'ho indossato\": lo metto qui da solo."),
    quasi.length ? h("h3", { class: "sotto-titolo" }, "Da lavare presto") : null,
    quasi.length ? h("ul", { class: "lista" }, quasi.slice(0, 8).map(c => h("li", { class: "riga-capo" },
      miniatura(c, "piccola"),
      h("span", { class: "riga-nome" }, h("b", {}, nomeCapo(c)), h("small", {}, `Messo ${c.usi} ${c.usi === 1 ? "volta" : "volte"} su ${lavaggioOgni(c)}`)),
      h("button", { type: "button", class: "btn", onclick: () => segnaSporco(c, true) }, "È sporco")
    ))) : null
  ];
}

// ---------- impostazioni ----------

function paginaImpostazioni() {
  const fred = h("input", { type: "range", min: -3, max: 3, step: 1, value: impostazioni.freddoloso, class: "cursore", "aria-label": "Sensibilità al freddo" });
  const testoFred = v => ["Soffro tantissimo il caldo", "Soffro il caldo", "Ho spesso caldo", "Nella media", "Ho spesso freddo", "Soffro il freddo", "Soffro tantissimo il freddo"][+v + 3];
  const etFred = h("b", {}, testoFred(fred.value));
  fred.addEventListener("input", () => { etFred.textContent = testoFred(fred.value); });
  fred.addEventListener("change", () => {
    impostazioni.freddoloso = +fred.value; salvaImpostazioni();
    for (const k of settimana()) if (piano[k] && !piano[k].indossato && !piano[k].manuale) piano[k].t = null;
    pianifica();
  });

  const stili = [{ id: "", nome: "Qualsiasi" }, ...STILI];
  const segStile = h("div", { class: "segmenti" });
  const ridisegnaStile = () => riempi(segStile, stili.map(s => h("button", {
    type: "button", class: `seg ${impostazioni.stile === s.id ? "attivo" : ""}`,
    onclick: () => {
      impostazioni.stile = s.id; salvaImpostazioni(); ridisegnaStile();
      for (const k of settimana()) if (piano[k] && !piano[k].indossato && !piano[k].manuale) delete piano[k];
      pianifica();
    }
  }, s.nome)));
  ridisegnaStile();

  return [
    h("div", { class: "intesta" }, h("div", {}, h("p", { class: "occhiello" }, "Come preferisci"), h("h1", {}, "Impostazioni"))),
    h("section", { class: "carta" },
      h("h3", {}, "Città"),
      h("button", { type: "button", class: "voce", onclick: () => apriCitta() },
        h("span", { class: "voce-ic" }, "📍"),
        h("span", {}, h("b", {}, impostazioni.citta?.nome || "Scegli la città"), h("small", {}, impostazioni.citta?.dove || "Per le previsioni del meteo")),
        icona("freccia"))
    ),
    h("section", { class: "carta" },
      h("h3", {}, "Freddo o caldo?"),
      h("p", { class: "tenue" }, "Così scelgo capi più caldi o più leggeri per te."),
      fred, h("p", { class: "centro" }, etFred)
    ),
    h("section", { class: "carta" },
      h("h3", {}, "Stile per la settimana"),
      h("p", { class: "tenue" }, "Preferisco i capi di questo stile (per esempio Elegante per l'ufficio)."),
      segStile
    ),
    h("section", { class: "carta" },
      h("h3", {}, "Copia di sicurezza"),
      h("p", { class: "tenue" }, "L'armadio (foto comprese) è salvato solo su questo telefono. Fai ogni tanto una copia: serve anche per passare a un telefono nuovo."),
      h("div", { class: "azioni" },
        h("button", { type: "button", class: "btn", onclick: esportaCopia }, icona("scarica"), "Salva una copia"),
        h("label", { class: "btn" }, icona("carica"), "Ripristina",
          h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: e => importaCopia(e.target) })))
    ),
    h("section", { class: "carta" },
      h("h3", {}, "Come funziona"),
      h("ul", { class: "spiega" },
        h("li", {}, "Ogni giorno da lunedì a venerdì guardo temperatura percepita, minima del mattino e pioggia."),
        h("li", {}, "Combino i capi puliti scegliendo il giusto calore, colori che stanno bene insieme e senza ripetere la stessa maglia nella settimana."),
        h("li", {}, "Se un capo è sporco toccalo nell'outfit: va nel bucato e lo sostituisco in tutti i giorni in cui c'era."),
        h("li", {}, "Con \"L'ho indossato\" conto gli utilizzi: quando un capo arriva al numero di usi impostato va da solo nel bucato."))
    ),
    h("p", { class: "piede" }, "Armadio · funziona anche offline")
  ];
}

async function esportaCopia() {
  toast("Preparo la copia…");
  const blob = await archivio.esporta({ impostazioni });
  const a = h("a", { href: URL.createObjectURL(blob), download: `armadio-${oggi()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importaCopia(input) {
  const f = input.files[0]; input.value = "";
  if (!f) return;
  try {
    const j = await archivio.importa(f);
    if (j.impostazioni && !impostazioni.citta) { impostazioni = { ...impostazioni, ...j.impostazioni }; salvaImpostazioni(); }
    capi = await archivio.tutti();
    rifaiSettimana();
    toast(`Ripristinati ${j.capi.length} capi`);
    await caricaMeteo();
  } catch (e) { toast(e.message || "Copia non valida"); }
}

// ---------- scelta della città ----------

function apriCitta() {
  const d = $("#foglio");
  const input = h("input", { class: "campo", type: "search", placeholder: "Es. Milano", autocomplete: "off", enterkeyhint: "search" });
  const risultati = h("div", { class: "voci" });
  const scegliCitta = async c => {
    impostazioni.citta = c; salvaImpostazioni();
    d.close();
    meteo = null; disegna();
    await caricaMeteo(true);
  };
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { riempi(risultati); return; }
    timer = setTimeout(async () => {
      try {
        const lista = await cercaCitta(q);
        riempi(risultati, lista.length ? lista.map(c => h("button", { type: "button", class: "voce", onclick: () => scegliCitta(c) },
          h("span", { class: "voce-ic" }, "📍"), h("span", {}, h("b", {}, c.nome), h("small", {}, c.dove)))) : h("p", { class: "tenue" }, "Nessuna città trovata"));
      } catch (e) { riempi(risultati, h("p", { class: "tenue" }, e.message)); }
    }, 300);
  });
  riempi(d,
    h("div", { class: "foglio-testa" }, h("div", {}, h("h2", {}, "Dove ti trovi?"), h("p", { class: "tenue" }, "Per le previsioni del meteo")),
      h("button", { type: "button", class: "chiudi", "aria-label": "Chiudi", onclick: () => d.close() }, icona("chiudi"))),
    input,
    h("button", { type: "button", class: "btn pieno", onclick: async () => {
      try { await scegliCitta(await posizioneAttuale()); } catch (e) { toast(e.message); }
    } }, icona("pin"), "Usa la mia posizione"),
    risultati
  );
  d.showModal();
  setTimeout(() => input.focus(), 50);
}

// ---------- avvio ----------

for (const d of document.querySelectorAll("dialog")) {
  // tocco fuori dal foglio = chiudi
  d.addEventListener("click", e => { if (e.target === d) d.close(); });
}

async function avvia() {
  try { capi = await archivio.tutti(); }
  catch { toast("Non riesco ad aprire l'archivio del telefono"); }
  disegna();
  await caricaMeteo();
  // Quando si riapre l'app il giorno dopo, si aggiorna da sola.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) caricaMeteo(); });
}
avvia();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
