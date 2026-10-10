import { CONFIG } from "./config.js";
import { apriServer, provaFirebase, chiaveFamiglia } from "./store.js";
import { REPARTI, reparto, indovinaReparto } from "./reparti.js";

const PERSONE = CONFIG.persone;
const persona = id => PERSONE.find(p => p.id === id);
const $ = s => document.querySelector(s);

let server;                   // Firebase o locale
let store;                    // la lista della famiglia su quel server
let elementi = [];
let pagina = "tutti";
let corrente = null;          // { id, root, aggiorna } della pagina mostrata
let errore = "";
let caricato = false;         // dopo il primo arrivo dei dati
const visti = new Set();      // id già mostrati: i nuovi entrano con un'animazione
const appena = new Map();     // id spuntati da poco: piccolo "pop" della spunta

// ---------- utilità ----------

// Crea elementi HTML; il testo va sempre in textContent (niente HTML iniettato).
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

// Come replaceChildren, ma salta null/false (che altrimenti diventerebbero il testo "null").
function riempi(el, ...figli) {
  el.replaceChildren(...figli.flat().filter(f => f != null && f !== false));
}

const ICONE = {
  carrello: '<path d="M3 4h2.2l2.3 10.6a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L21 8H6.3"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  piu: '<path d="M12 5v14M5 12h14"/>',
  meno: '<path d="M6 12h12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cestino: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  chiudi: '<path d="M6 6l12 12M18 6L6 18"/>',
  nota: '<path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5M8 13h8M8 17h5"/>',
  fiamma: '<path d="M12 3c.8 3.4 5 5.4 5 10.2A5 5 0 0 1 7 13c0-2 1-3.6 2.2-4.6.1 1.8 1 2.9 2.1 3.1-.4-3.1-.6-5.6.7-8.5z"/>',
  nuvola: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 12 3.3 3.3 0 0 0 7 18.5z"/>',
  telefono: '<rect x="7" y="2.5" width="10" height="19" rx="2.8"/><path d="M11 18.5h2"/>',
  freccia: '<path d="M9 6l6 6-6 6"/>',
  scambia: '<path d="M7 7.5h12l-3.5-3.5M17 16.5H5l3.5 3.5"/>',
  orologio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  scopa: '<path d="M14 4l6 6M12.5 8.5l3 3M4 20c1-4 2.5-7 5-9.5l4.5 4.5C11 17.5 8 19 4 20z"/>',
  occhio: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  lucchetto: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  condividi: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6 11.5H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11.5h-1"/>',
  copia: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  esci: '<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l-4-4 4-4M6 12h9"/>',
  stella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>'
};
function icona(nome, cls = "") {
  const t = document.createElement("template");
  t.innerHTML = `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[nome]}</svg>`;
  return t.content.firstChild;
}

// "Latte ", "latte" e "LATTE" sono la stessa cosa.
const chiave = nome => nome.trim().toLowerCase().replace(/\s+/g, " ");
const bello = nome => {
  const t = nome.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const cose = n => n === 1 ? "1 cosa" : `${n} cose`;
const pezzi = n => n === 1 ? "1 pezzo" : `${n} pezzi`;
const vibra = ms => { try { navigator.vibrate?.(ms); } catch {} };

function tempoFa(ts) {
  if (!ts) return "";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "adesso";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const d = new Date(ts);
  const ora = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (ts >= oggi.getTime()) return `oggi alle ${ora}`;
  if (ts >= oggi.getTime() - 86400000) return `ieri alle ${ora}`;
  const giorni = Math.round((oggi.getTime() - ts) / 86400000);
  if (giorni < 7) return `${giorni} giorni fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function saluto() {
  const o = new Date().getHours();
  return o < 6 ? "Buonanotte" : o < 13 ? "Buongiorno" : o < 18 ? "Buon pomeriggio" : "Buonasera";
}

function io() {
  try { return localStorage.getItem("spesa:io"); } catch { return null; }
}
function salvaIo(id) {
  try { localStorage.setItem("spesa:io", id); } catch {}
}

// Cose già aggiunte da questo telefono, per i suggerimenti veloci.
function storia() {
  try { return JSON.parse(localStorage.getItem("spesa:storia")) || {}; } catch { return {}; }
}
function ricorda(nome, categoria) {
  const s = storia();
  const k = chiave(nome);
  s[k] = { nome: bello(nome), categoria, n: (s[k]?.n || 0) + 1, ultimo: Date.now() };
  try { localStorage.setItem("spesa:storia", JSON.stringify(s)); } catch {}
}

const stilePersona = p => `--c1:${p.colore};--c2:${p.colore2}`;
function avatar(p, cls = "") {
  return h("span", { class: `avatar ${cls}`, style: stilePersona(p), "aria-hidden": "true" }, p.nome.charAt(0));
}
function tessera(cat, cls = "") {
  const r = reparto(cat);
  return h("span", { class: `tessera ${cls}`, style: `--t:${r.tinta}`, title: r.nome }, r.icona);
}
const categoriaDi = e => e.categoria || indovinaReparto(e.nome);

// ---------- avvisi in basso ----------

let timerToast;
function toast(testo, azione, fn) {
  const t = $("#toast");
  riempi(t,
    h("span", {}, testo),
    azione ? h("button", { type: "button", onclick: () => { t.classList.remove("su"); fn(); } }, azione) : null
  );
  t.classList.add("su");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove("su"), azione ? 5000 : 2200);
}

// ---------- azioni sui dati ----------

async function azione(promessa) {
  try { await promessa; } catch (err) { mostraErrore(err); }
}

async function aggiungi(personaId, { nome, qta, nota, urgente, categoria }) {
  ricorda(nome, categoria);
  // Se la persona l'ha già chiesto (e non è ancora stato comprato) aumenta la quantità.
  const gia = elementi.find(e => e.persona === personaId && !e.comprato && chiave(e.nome) === chiave(nome));
  if (gia) {
    const campi = { quantita: Math.min(99, gia.quantita + qta) };
    if (nota) campi.nota = nota;
    if (urgente) campi.urgente = true;
    await azione(store.modifica(gia.id, campi));
    toast(`${bello(nome)}: ora sono ${gia.quantita + qta}`);
  } else {
    await azione(store.aggiungi({
      nome: bello(nome), quantita: qta, persona: personaId,
      categoria, nota: nota || "", urgente: !!urgente
    }));
  }
}

function segna(ids, comprato) {
  vibra(comprato ? 12 : 6);
  const campi = comprato
    ? { comprato: true, compratoDa: io() || "", compratoIl: Date.now() }
    : { comprato: false, compratoDa: "", compratoIl: 0 };
  ids.forEach(id => { appena.set(id, Date.now()); azione(store.modifica(id, campi)); });
}

function eliminaConAnnulla(lista, testo) {
  const copie = lista.map(e => ({ ...e }));
  copie.forEach(e => azione(store.elimina(e.id)));
  vibra(8);
  toast(testo, "Annulla", () => copie.forEach(e => azione(store.ripristina(e))));
}

// Trascinare una riga verso sinistra la elimina.
function trascinabile(li, contenuto, onElimina) {
  let x0 = 0, y0 = 0, dx = 0, attivo = false, deciso = false;
  const soglia = () => Math.min(130, li.offsetWidth * 0.35);
  contenuto.addEventListener("pointerdown", e => {
    if (e.button > 0 || e.target.closest(".spunta, .stepper, input, select, textarea")) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; attivo = true; deciso = false;
  });
  contenuto.addEventListener("pointermove", e => {
    if (!attivo) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!deciso) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
        deciso = true;
        contenuto.setPointerCapture(e.pointerId);
        li.classList.add("trascina");
      } else if (Math.abs(my) > 10) { attivo = false; return; } else return;
    }
    dx = Math.min(0, mx);
    contenuto.style.transform = `translateX(${dx}px)`;
    const oltre = dx < -soglia();
    if (oltre !== li.classList.contains("oltre")) { li.classList.toggle("oltre", oltre); if (oltre) vibra(6); }
  });
  const fine = () => {
    if (!attivo) return;
    attivo = false;
    li.classList.remove("trascina");
    if (deciso && dx < -soglia()) {
      li.classList.add("via");
      contenuto.style.transform = "translateX(-105%)";
      setTimeout(onElimina, 200);
    } else {
      contenuto.style.transform = "";
      li.classList.remove("oltre");
    }
  };
  contenuto.addEventListener("pointerup", fine);
  contenuto.addEventListener("pointercancel", fine);
  // dopo un trascinamento non far partire il "tocco"
  contenuto.addEventListener("click", e => { if (deciso) { e.stopPropagation(); e.preventDefault(); deciso = false; } }, true);
}

// ---------- barra in basso ----------

function disegnaTabs() {
  const daComprare = elementi.filter(e => !e.comprato);
  const tutti = new Set(daComprare.map(e => chiave(e.nome))).size;
  riempi($("#tabs"),
    h("button", {
      class: "tab tutti" + (pagina === "tutti" ? " attiva" : ""), style: "--c1:#5b6b82;--c2:#141b26",
      "aria-current": pagina === "tutti" ? "page" : null, onclick: () => vai("tutti")
    },
      h("span", { class: "tab-ico tutti" }, icona("carrello"), tutti ? h("span", { class: "badge" }, String(tutti)) : null),
      h("span", { class: "tab-nome" }, "Tutti")
    ),
    ...PERSONE.map(p => {
      const n = daComprare.filter(e => e.persona === p.id).length;
      return h("button", {
        class: "tab" + (pagina === p.id ? " attiva" : ""), style: stilePersona(p),
        "aria-current": pagina === p.id ? "page" : null, onclick: () => vai(p.id)
      },
        h("span", { class: "tab-ico" }, avatar(p, "piccolo"), n ? h("span", { class: "badge" }, String(n)) : null),
        h("span", { class: "tab-nome" }, p.id === io() ? "Io" : p.nome)
      );
    })
  );
}

function vai(p) {
  if (p === pagina && corrente) return;
  pagina = p;
  try { history.replaceState(null, "", "#" + p); } catch {}
  corrente = null;
  disegna();
  window.scrollTo({ top: 0 });
}

// ---------- pagina di una persona ----------

function costruisciPersona(p) {
  const banner = h("div");
  const sugg = h("div", { class: "suggerimenti" });
  const lista = h("div");

  // --- compositore: scrivi cosa vuoi ---
  let qta = 1, urgente = false, scelto = null;   // scelto = reparto scelto a mano
  const input = h("input", {
    class: "campo", type: "text", placeholder: "Cosa vorresti?", autocomplete: "off",
    autocapitalize: "sentences", enterkeyhint: "done", maxlength: "60", "aria-label": "Cosa vorresti"
  });
  const numero = h("span", { class: "qta" }, "1");
  const cambiaQta = d => { qta = Math.max(1, Math.min(99, qta + d)); numero.textContent = qta; };
  const nota = h("input", {
    class: "campo nota-campo", type: "text", placeholder: "Una nota… (es. marca, gusto, misura)",
    maxlength: "80", "aria-label": "Nota"
  });
  const rigaNota = h("div", { class: "riga-nota nascosta" }, icona("nota"), nota);

  const chipUrgente = h("button", { type: "button", class: "chip-opz chip-urgente", "aria-pressed": "false" }, icona("fiamma"), "Urgente");
  chipUrgente.onclick = () => {
    urgente = !urgente;
    chipUrgente.setAttribute("aria-pressed", String(urgente));
    vibra(5);
  };
  const chipNota = h("button", { type: "button", class: "chip-opz", "aria-pressed": "false" }, icona("nota"), "Nota");
  chipNota.onclick = () => {
    const apri = rigaNota.classList.toggle("nascosta") === false;
    chipNota.setAttribute("aria-pressed", String(apri));
    if (apri) nota.focus(); else nota.value = "";
  };
  const repEmoji = h("span", {}, "🛍️"), repNome = h("span", {}, "Reparto");
  const select = h("select", { "aria-label": "Reparto" },
    h("option", { value: "" }, "Automatico"),
    REPARTI.map(r => h("option", { value: r.id }, `${r.icona} ${r.nome}`))
  );
  const chipRep = h("label", { class: "chip-opz reparto" }, repEmoji, repNome, select);
  const aggiornaRep = () => {
    const id = scelto || (input.value.trim() ? indovinaReparto(input.value) : null);
    const r = id ? reparto(id) : null;
    repEmoji.textContent = r ? r.icona : "🏷️";
    repNome.textContent = r ? r.nome : "Reparto";
    chipRep.classList.toggle("auto", !scelto && !!r);
  };
  select.onchange = () => { scelto = select.value || null; aggiornaRep(); };

  const reset = () => {
    input.value = ""; nota.value = ""; scelto = null; select.value = ""; urgente = false;
    chipUrgente.setAttribute("aria-pressed", "false");
    chipNota.setAttribute("aria-pressed", "false");
    rigaNota.classList.add("nascosta");
    cambiaQta(-99); aggiornaRep(); aggiornaSugg();
  };

  const invia = async () => {
    const nome = input.value;
    if (!chiave(nome)) { input.focus(); composer.classList.add("scuoti"); setTimeout(() => composer.classList.remove("scuoti"), 400); return; }
    const dati = { nome, qta, nota: nota.value.trim(), urgente, categoria: scelto || indovinaReparto(nome) };
    reset();
    input.focus();
    vibra(10);
    await aggiungi(p.id, dati);
  };

  const composer = h("form", { class: "compositore", style: stilePersona(p), onsubmit: e => { e.preventDefault(); invia(); } },
    h("div", { class: "riga-input" },
      input,
      h("button", { class: "aggiungi-btn", type: "submit", "aria-label": "Aggiungi" }, icona("piu"))
    ),
    rigaNota,
    h("div", { class: "opzioni" },
      h("div", { class: "stepper" },
        h("button", { type: "button", "aria-label": "Meno", onclick: () => cambiaQta(-1) }, icona("meno")),
        numero,
        h("button", { type: "button", "aria-label": "Più", onclick: () => cambiaQta(1) }, icona("piu"))
      ),
      chipUrgente, chipNota, chipRep
    )
  );
  input.addEventListener("input", () => { aggiornaRep(); aggiornaSugg(); });
  aggiornaRep();

  // --- suggerimenti veloci ---
  function aggiornaSugg() {
    const miei = new Set(elementi.filter(e => e.persona === p.id && !e.comprato).map(e => chiave(e.nome)));
    const filtro = chiave(input.value);
    const voci = new Map();
    // prima: cose chieste da altri ("anche io!")
    for (const e of elementi) {
      const k = chiave(e.nome);
      if (e.comprato || e.persona === p.id || miei.has(k) || voci.has(k)) continue;
      voci.set(k, { nome: bello(e.nome), categoria: categoriaDi(e), di: persona(e.persona) });
    }
    // poi: cose aggiunte spesso da questo telefono
    Object.entries(storia())
      .sort((a, b) => b[1].n - a[1].n || b[1].ultimo - a[1].ultimo)
      .forEach(([k, v]) => { if (!miei.has(k) && !voci.has(k)) voci.set(k, { nome: v.nome, categoria: v.categoria }); });

    const scelte = [...voci.values()]
      .filter(v => !filtro || chiave(v.nome).includes(filtro))
      .filter(v => chiave(v.nome) !== filtro)
      .slice(0, 10);

    riempi(sugg, ...(scelte.length ? [
      h("div", { class: "titoletto" }, filtro ? "Forse cercavi" : "Aggiungi al volo"),
      h("div", { class: "chips-scorri" }, scelte.map(v =>
        h("button", {
          type: "button", class: "chip-sugg",
          onclick: () => { vibra(8); aggiungi(p.id, { nome: v.nome, qta: 1, nota: "", urgente: false, categoria: v.categoria || indovinaReparto(v.nome) }); input.value = ""; aggiornaRep(); }
        },
          h("span", { class: "chip-emoji" }, reparto(v.categoria || indovinaReparto(v.nome)).icona),
          v.nome,
          v.di ? avatar(v.di, "mini") : null
        )
      ))
    ] : []));
  }

  function aggiorna() {
    const miei = elementi.filter(e => e.persona === p.id);
    const da = miei.filter(e => !e.comprato)
      .sort((a, b) => (b.urgente - a.urgente) || (b.creato - a.creato));
    const fatti = miei.filter(e => e.comprato)
      .sort((a, b) => (b.compratoIl || 0) - (a.compratoIl || 0));

    riempi(banner, bannerPersona(p, da, fatti));
    aggiornaSugg();

    if (!miei.length) {
      riempi(lista, vuoto(
        "Lista vuota",
        p.id === io() ? "Scrivi qui sopra cosa vorresti che venga comprato." : `${p.nome} non ha ancora chiesto niente.`
      ));
      return;
    }
    riempi(lista,
      da.length ? h("div", { class: "intestazione-sezione" }, h("h3", {}, "Da comprare"), h("span", { class: "conta" }, String(da.length))) : null,
      da.length ? h("ul", { class: "lista" }, da.map(e => rigaPersona(e, p))) : h("p", { class: "tutto-fatto" }, "🎉 Hanno comprato tutto!"),
      fatti.length ? h("div", { class: "intestazione-sezione" },
        h("h3", {}, "Comprati"), h("span", { class: "conta" }, String(fatti.length)),
        h("button", { class: "link", onclick: () => eliminaConAnnulla(fatti, `Tolte ${cose(fatti.length)} comprate`) }, icona("scopa"), "Pulisci")
      ) : null,
      fatti.length ? h("ul", { class: "lista" }, fatti.map(e => rigaPersona(e, p))) : null
    );
  }

  return { root: [banner, composer, sugg, lista], aggiorna };
}

function bannerPersona(p, da, fatti) {
  const tot = da.length + fatti.length;
  const mio = p.id === io();
  const pz = da.reduce((s, e) => s + e.quantita, 0);
  return h("section", { class: "banner", style: stilePersona(p) },
    h("div", { class: "banner-riga" },
      avatar(p, "grande"),
      h("div", { class: "banner-testo" },
        h("div", { class: "occhiello" }, mio ? `${saluto()}, ${p.nome}` : "Lista di famiglia"),
        h("h2", {}, mio ? "La tua lista" : `La lista di ${p.nome}`)
      )
    ),
    h("div", { class: "statistiche" },
      stat(String(da.length), da.length === 1 ? "da comprare" : "da comprare"),
      stat(String(pz), pz === 1 ? "pezzo" : "pezzi"),
      stat(String(fatti.length), fatti.length === 1 ? "comprato" : "comprati")
    ),
    tot ? h("div", { class: "barra-prog", role: "progressbar", "aria-valuenow": String(Math.round(fatti.length / tot * 100)), "aria-valuemin": "0", "aria-valuemax": "100" },
      h("span", { style: `width:${fatti.length / tot * 100}%` })) : null
  );
}
const stat = (n, etichetta) => h("div", { class: "stat" }, h("b", {}, n), h("span", {}, etichetta));

function rigaPersona(e, p) {
  const contenuto = h("div", { class: "contenuto" },
    spunta(e.comprato, `--c1:${p.colore};--c2:${p.colore2}`, () => segna([e.id], !e.comprato), appena.has(e.id)),
    tessera(categoriaDi(e)),
    h("button", { class: "testo", type: "button", onclick: () => apriModifica(e.id) },
      h("span", { class: "nome-riga" },
        h("span", { class: "nome" }, bello(e.nome)),
        e.urgente && !e.comprato ? h("span", { class: "pill urgente" }, icona("fiamma"), "Urgente") : null
      ),
      e.nota ? h("span", { class: "nota" }, `“${e.nota}”`) : null,
      h("span", { class: "meta" },
        e.comprato
          ? [icona("check"), e.compratoDa && persona(e.compratoDa) ? `Comprato da ${persona(e.compratoDa).nome}` : "Comprato", e.compratoIl ? ` · ${tempoFa(e.compratoIl)}` : ""]
          : [icona("orologio"), `Chiesto ${tempoFa(e.creato)}`]
      )
    ),
    e.comprato
      ? h("span", { class: "qta-statica" }, `×${e.quantita}`)
      : h("div", { class: "stepper piccolo" },
          h("button", {
            type: "button", "aria-label": "Meno",
            onclick: () => e.quantita > 1 ? azione(store.modifica(e.id, { quantita: e.quantita - 1 })) : eliminaConAnnulla([e], `Tolto “${bello(e.nome)}”`)
          }, icona("meno")),
          h("span", { class: "qta" }, String(e.quantita)),
          h("button", { type: "button", "aria-label": "Più", onclick: () => azione(store.modifica(e.id, { quantita: Math.min(99, e.quantita + 1) })) }, icona("piu"))
        )
  );
  return rigaScorrevole(e.id, e.comprato, contenuto, () => eliminaConAnnulla([e], `Tolto “${bello(e.nome)}”`));
}

function rigaScorrevole(id, comprato, contenuto, onElimina, extra = "") {
  const li = h("li", { class: `riga ${extra}` + (comprato ? " comprato" : "") + (caricato && !visti.has(id) ? " entra" : "") },
    h("div", { class: "sotto" }, icona("cestino"), h("span", {}, "Elimina")),
    contenuto
  );
  trascinabile(li, contenuto, onElimina);
  return li;
}

function spunta(fatto, stile, onclick, pop) {
  return h("button", {
    type: "button", class: "spunta" + (fatto ? " si" : "") + (pop ? " pop" : ""), style: stile,
    "aria-label": fatto ? "Segna da comprare" : "Segna comprato", "aria-pressed": String(fatto), onclick
  }, icona("check"));
}

function vuoto(titolo, testo) {
  return h("div", { class: "vuoto" },
    h("div", { class: "vuoto-ico" }, icona("carrello")),
    h("h3", {}, titolo),
    h("p", {}, testo)
  );
}

// ---------- lista generale ----------

function raggruppa(lista) {
  const gruppi = new Map();
  for (const e of lista) {
    const k = chiave(e.nome);
    if (!gruppi.has(k)) gruppi.set(k, { k, nome: bello(e.nome), totale: 0, per: new Map(), richieste: [], categorie: {} });
    const g = gruppi.get(k);
    g.totale += e.quantita;
    g.per.set(e.persona, (g.per.get(e.persona) || 0) + e.quantita);
    g.richieste.push(e);
    const c = categoriaDi(e);
    g.categorie[c] = (g.categorie[c] || 0) + 1;
  }
  for (const g of gruppi.values()) {
    g.ids = g.richieste.map(e => e.id);
    g.urgente = g.richieste.some(e => e.urgente);
    g.categoria = Object.entries(g.categorie).sort((a, b) => b[1] - a[1])[0][0];
    g.compratoIl = Math.max(...g.richieste.map(e => e.compratoIl || 0));
    g.compratoDa = g.richieste.find(e => e.compratoDa)?.compratoDa;
    g.creato = Math.min(...g.richieste.map(e => e.creato || Date.now()));
  }
  return [...gruppi.values()];
}

function costruisciTutti() {
  const hero = h("div");
  const lista = h("div");

  function aggiorna() {
    const da = raggruppa(elementi.filter(e => !e.comprato));
    const fatti = raggruppa(elementi.filter(e => e.comprato))
      .sort((a, b) => b.compratoIl - a.compratoIl);
    riempi(hero, heroTutti(da, fatti));

    if (!da.length && !fatti.length) {
      riempi(lista, vuoto("Nessuna richiesta", "Quando qualcuno aggiunge qualcosa alla sua lista, la trovi qui."));
      return;
    }

    const blocchi = [];
    if (!da.length) blocchi.push(h("p", { class: "tutto-fatto" }, "🎉 Tutto comprato! Bravi."));
    for (const r of REPARTI) {
      const qui = da.filter(g => g.categoria === r.id)
        .sort((a, b) => (b.urgente - a.urgente) || (b.per.size - a.per.size) || a.nome.localeCompare(b.nome, "it"));
      if (!qui.length) continue;
      blocchi.push(
        h("div", { class: "intestazione-sezione reparto-titolo" },
          tessera(r.id, "piccola"), h("h3", {}, r.nome), h("span", { class: "conta" }, String(qui.length))),
        h("ul", { class: "lista" }, qui.map(g => rigaGruppo(g, false)))
      );
    }
    if (fatti.length) {
      const richieste = fatti.flatMap(g => g.richieste);
      blocchi.push(
        h("div", { class: "intestazione-sezione" },
          h("h3", {}, "Nel carrello"), h("span", { class: "conta" }, String(fatti.length)),
          h("button", { class: "link", onclick: () => eliminaConAnnulla(richieste, `Tolte ${cose(fatti.length)} dalle liste`) }, icona("scopa"), "Svuota")
        ),
        h("ul", { class: "lista" }, fatti.map(g => rigaGruppo(g, true)))
      );
    }
    riempi(lista, ...blocchi);
  }

  return { root: [hero, lista], aggiorna };
}

function heroTutti(da, fatti) {
  const totale = da.length + fatti.length;
  const perc = totale ? fatti.length / totale : 0;
  const pz = da.reduce((s, g) => s + g.totale, 0);
  const C = 2 * Math.PI * 34;
  const anello = document.createElement("template");
  const colori = PERSONE.map((p, i) => `<stop offset="${i / Math.max(1, PERSONE.length - 1)}" stop-color="${p.colore}"/>`).join("");
  anello.innerHTML = `<svg viewBox="0 0 80 80" class="anello" aria-hidden="true">
    <defs><linearGradient id="anelloGrad" x1="0" y1="0" x2="1" y2="1">${colori}</linearGradient></defs>
    <circle cx="40" cy="40" r="34" class="anello-fondo"/>
    <circle cx="40" cy="40" r="34" class="anello-pieno" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - perc)}"/>
  </svg>`;

  return h("section", { class: "hero" },
    h("div", { class: "hero-riga" },
      h("div", { class: "hero-testo" },
        h("div", { class: "occhiello" }, `${saluto()}${io() && persona(io()) ? ", " + persona(io()).nome : ""}`),
        h("h2", {}, h("span", { class: "numerone" }, String(da.length)), da.length === 1 ? " cosa da comprare" : " cose da comprare"),
        h("p", {}, pz ? `${pezzi(pz)} in tutto` : "La lista è vuota")
      ),
      h("div", { class: "anello-box" },
        anello.content.firstChild,
        h("div", { class: "anello-testo" }, h("b", {}, `${Math.round(perc * 100)}%`), h("span", {}, "nel carrello"))
      )
    ),
    h("div", { class: "hero-persone" }, PERSONE.map(p => {
      const n = elementi.filter(e => e.persona === p.id && !e.comprato).length;
      return h("button", { type: "button", class: "hero-persona" + (n ? "" : " zero"), onclick: () => vai(p.id) },
        avatar(p, "medio"), h("span", { class: "hp-nome" }, p.nome), h("span", { class: "hp-n" }, n ? cose(n) : "—"));
    }))
  );
}

function rigaGruppo(g, comprato) {
  const chi = [...g.per.entries()].map(([id, q]) => {
    const p = persona(id) || { nome: id, colore: "#888", colore2: "#555" };
    return h("span", { class: "chip-persona", style: stilePersona(p) }, avatar(p, "mini"), p.nome, h("b", {}, `×${q}`));
  });
  const note = g.richieste.filter(e => e.nota).map(e => {
    const p = persona(e.persona);
    return h("span", { class: "nota" }, `“${e.nota}”`, p ? h("span", { class: "nota-chi" }, ` — ${p.nome}`) : null);
  });
  const pop = g.ids.some(id => appena.has(id));
  const contenuto = h("div", { class: "contenuto" },
    spunta(comprato, "--c1:#5b6b82;--c2:#141b26", () => segna(g.ids, !comprato), pop),
    h("div", { class: "testo" },
      h("span", { class: "nome-riga" },
        h("span", { class: "nome forte" }, g.nome),
        g.urgente && !comprato ? h("span", { class: "pill urgente" }, icona("fiamma"), "Urgente") : null,
        g.per.size > 1 ? h("span", { class: "pill multi" }, `Chiesto da ${g.per.size}`) : null
      ),
      h("span", { class: "chi" }, chi),
      note.length ? h("span", { class: "note" }, note) : null,
      comprato && g.compratoIl ? h("span", { class: "meta" }, icona("check"),
        g.compratoDa && persona(g.compratoDa) ? `Preso da ${persona(g.compratoDa).nome}` : "Preso", ` · ${tempoFa(g.compratoIl)}`) : null
    ),
    h("div", { class: "totale" }, h("b", {}, String(g.totale)), h("span", {}, g.totale === 1 ? "pezzo" : "pezzi"))
  );
  return rigaScorrevole(g.ids.join("|"), comprato, contenuto,
    () => eliminaConAnnulla(g.richieste, `Tolto “${g.nome}” dalle liste`), "gruppo");
}

// ---------- foglio "modifica" ----------

let inModifica = null;

function apriModifica(id) {
  const e = elementi.find(x => x.id === id);
  if (!e) return;
  inModifica = id;
  const p = persona(e.persona) || PERSONE[0];
  let qta = e.quantita, urgente = !!e.urgente, cat = categoriaDi(e);

  const nome = h("input", { class: "campo grande", value: e.nome, maxlength: "60", "aria-label": "Nome" });
  const nota = h("textarea", { class: "campo", rows: "2", maxlength: "80", placeholder: "Marca, gusto, misura…", "aria-label": "Nota" });
  nota.value = e.nota || "";
  const numero = h("span", { class: "qta" }, String(qta));
  const cambia = d => { qta = Math.max(1, Math.min(99, qta + d)); numero.textContent = qta; };
  const interr = h("button", { type: "button", class: "interruttore", role: "switch", "aria-checked": String(urgente), "aria-label": "Urgente" }, h("span"));
  interr.onclick = () => { urgente = !urgente; interr.setAttribute("aria-checked", String(urgente)); vibra(5); };

  const griglia = h("div", { class: "griglia-reparti" }, REPARTI.map(r => {
    const b = h("button", { type: "button", class: "rep" + (r.id === cat ? " scelto" : ""), style: `--t:${r.tinta}` },
      h("span", { class: "rep-ico" }, r.icona), h("span", {}, r.nome));
    b.onclick = () => { cat = r.id; griglia.querySelectorAll(".rep").forEach(x => x.classList.remove("scelto")); b.classList.add("scelto"); };
    return b;
  }));

  const d = $("#modifica");
  d.style.cssText = stilePersona(p);
  riempi(d,
    h("div", { class: "maniglia" }),
    h("div", { class: "foglio-testa" },
      h("div", {}, h("div", { class: "occhiello" }, `Lista di ${p.nome}`), h("h2", {}, "Modifica")),
      h("button", { type: "button", class: "tondo", "aria-label": "Chiudi", onclick: () => d.close() }, icona("chiudi"))
    ),
    h("label", { class: "etichetta" }, "Cosa"), nome,
    h("div", { class: "riga-campi" },
      h("div", {}, h("label", { class: "etichetta" }, "Quantità"),
        h("div", { class: "stepper" },
          h("button", { type: "button", "aria-label": "Meno", onclick: () => cambia(-1) }, icona("meno")), numero,
          h("button", { type: "button", "aria-label": "Più", onclick: () => cambia(1) }, icona("piu")))),
      h("div", { class: "urgente-box" }, h("label", { class: "etichetta" }, icona("fiamma"), "Urgente"), interr)
    ),
    h("label", { class: "etichetta" }, "Nota"), nota,
    h("label", { class: "etichetta" }, "Reparto"), griglia,
    h("div", { class: "foglio-azioni" },
      h("button", { type: "button", class: "btn pericolo", onclick: () => { d.close(); eliminaConAnnulla([e], `Tolto “${bello(e.nome)}”`); } }, icona("cestino"), "Elimina"),
      h("button", {
        type: "button", class: "btn primario", onclick: () => {
          if (!chiave(nome.value)) { nome.focus(); return; }
          azione(store.modifica(e.id, { nome: bello(nome.value), quantita: qta, nota: nota.value.trim(), urgente, categoria: cat }));
          d.close(); toast("Salvato");
        }
      }, icona("check"), "Salva")
    )
  );
  d.showModal();
}

// ---------- "Chi sei?" e stato ----------

function chiediChiSei(primaVolta) {
  const d = $("#chiSei");
  riempi(d,
    primaVolta ? h("img", { class: "logo-grande", src: "icons/icon-512.png", alt: "" }) : h("div", { class: "maniglia" }),
    h("h2", {}, primaVolta ? "Benvenuto nella spesa di famiglia" : "Chi sta usando il telefono?"),
    h("p", { class: "sotto-titolo" }, primaVolta ? "Dimmi chi sei: l'app si aprirà sempre sulla tua lista." : "L'app si aprirà sulla lista che scegli."),
    h("div", { class: "scelta" }, PERSONE.map(p =>
      h("button", {
        type: "button", class: "persona-scelta" + (io() === p.id ? " attuale" : ""), style: stilePersona(p),
        onclick: () => { salvaIo(p.id); d.close(); vibra(10); corrente = null; vai(p.id); disegnaIo(); }
      }, avatar(p, "grande"), h("span", {}, p.nome))
    ))
  );
  d.onclick = primaVolta ? null : e => { if (e.target === d) d.close(); };
  d.addEventListener("cancel", e => { if (!io()) e.preventDefault(); });
  d.showModal();
}

function disegnaIo() {
  const p = persona(io());
  const b = $("#io");
  riempi(b, p ? avatar(p, "piccolo") : icona("scambia"));
  b.onclick = () => chiediChiSei(false);
}

function disegnaStato() {
  const b = $("#stato");
  if (server.condiviso) {
    const on = navigator.onLine;
    riempi(b, h("span", { class: "punto" }), on ? "Sincronizzata" : "Offline");
    b.className = "stato " + (on ? "ok" : "off");
  } else {
    riempi(b, icona("telefono"), "Solo qui");
    b.className = "stato locale";
  }
  b.onclick = apriInfo;
}

const chiudiFuori = d => { d.onclick = e => { if (e.target === d) d.close(); }; };

function apriInfo() {
  const d = $("#info");
  const c = server.condiviso;
  riempi(d,
    h("div", { class: "maniglia" }),
    h("div", { class: "info-ico" + (c ? " ok" : "") }, icona(c ? "nuvola" : "telefono")),
    h("h2", {}, c ? "Famiglia sincronizzata" : "Lista solo su questo telefono"),
    c
      ? h("p", { class: "sotto-titolo" }, "Quello che scrive ognuno compare subito sui telefoni di tutti. Funziona anche senza internet: le modifiche partono appena torna la connessione.")
      : h("p", { class: "sotto-titolo" }, "Per avere la stessa lista su tutti i telefoni collega il server (gratis, una volta sola). Ci vogliono 5 minuti."),
    c ? invito() : h("button", { type: "button", class: "btn primario largo", onclick: () => { d.close(); apriServer2(); } }, icona("nuvola"), "Collega il server"),
    h("div", { class: "info-righe" },
      c ? h("button", { type: "button", class: "info-riga", onclick: () => { d.close(); apriServer2(); } },
        icona("nuvola"), h("span", {}, "Server", h("small", {}, server.nome)), icona("freccia")) : null,
      h("button", {
        type: "button", class: "info-riga rossa", onclick: () => {
          if (!confirm("Uscire dalla famiglia su questo telefono? Per rientrare servirà la password.")) return;
          try { localStorage.removeItem("spesa:famiglia"); } catch {}
          location.reload();
        }
      }, icona("esci"), h("span", {}, "Esci dalla famiglia"), icona("freccia"))
    )
  );
  chiudiFuori(d);
  d.showModal();
}

// ---------- invito: link e QR per collegare gli altri telefoni ----------

function linkInvito() {
  const cfg = JSON.stringify(serverSalvato() || CONFIG.firebase);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(cfg))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return location.origin + location.pathname + "#invito=" + b64;
}

let qrPronto;
function caricaQr() {
  qrPronto ??= new Promise((ok, no) => {
    const sc = document.createElement("script");
    sc.src = "lib/qrcode.js"; sc.onload = () => ok(window.qrcode); sc.onerror = no;
    document.head.append(sc);
  });
  return qrPronto;
}

function invito() {
  const link = linkInvito();
  const qr = h("div", { class: "qr" });
  caricaQr().then(qrcode => {
    const q = qrcode(0, "M"); q.addData(link); q.make();
    qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }).catch(() => qr.remove());
  return h("div", { class: "invito" },
    h("div", { class: "invito-testo" },
      h("h3", {}, "Invita la famiglia"),
      h("p", {}, "Fai inquadrare il codice con la fotocamera (oppure manda il link). Poi serve la password della famiglia.")
    ),
    qr,
    h("div", { class: "invito-azioni" },
      navigator.share ? h("button", {
        type: "button", class: "btn primario", onclick: () => navigator.share({ title: "La nostra spesa", text: "Entra nella nostra lista della spesa:", url: link }).catch(() => {})
      }, icona("condividi"), "Manda il link") : null,
      h("button", {
        type: "button", class: "btn secondario", onclick: async () => {
          try { await navigator.clipboard.writeText(link); toast("Link copiato"); } catch { prompt("Copia questo link:", link); }
        }
      }, icona("copia"), "Copia")
    )
  );
}

function leggiInvito() {
  const m = location.hash.match(/^#invito=([\w-]+)/);
  if (!m) return false;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const cfg = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
    if (cfg && cfg.apiKey && cfg.projectId) salvaServer(cfg);
  } catch (e) { console.error("Invito non valido", e); }
  try { history.replaceState(null, "", location.pathname); } catch {}
  return true;
}

// ---------- server e famiglia salvati su questo telefono ----------

function serverSalvato() {
  try { return JSON.parse(localStorage.getItem("spesa:server")); } catch { return null; }
}
function salvaServer(cfg) {
  try {
    if (cfg) localStorage.setItem("spesa:server", JSON.stringify(cfg));
    else localStorage.removeItem("spesa:server");
    localStorage.removeItem("spesa:famiglia");   // la famiglia va ritrovata sul nuovo server
  } catch {}
}
function famigliaSalvata() {
  try {
    const f = JSON.parse(localStorage.getItem("spesa:famiglia"));
    return f && f.server === server.nome ? f.id : null;
  } catch { return null; }
}
function salvaFamiglia(id) {
  try { localStorage.setItem("spesa:famiglia", JSON.stringify({ server: server.nome, id })); } catch {}
}

// Legge il riquadro firebaseConfig incollato (va bene anche con "const firebaseConfig = {...}").
function leggiConfig(testo) {
  const cfg = {};
  for (const k of ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]) {
    const m = testo.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    if (m) cfg[k] = m[1].trim();
  }
  return cfg.apiKey && cfg.projectId ? cfg : null;
}

const REGOLE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /famiglie/{famiglia}/{documento=**} {
      allow read, write: if famiglia.size() == 64;
    }
  }
}`;

function apriServer2() {
  const d = $("#server");
  const c = server.condiviso;
  const area = h("textarea", { class: "campo codice", rows: "6", placeholder: "const firebaseConfig = {\n  apiKey: \"…\",\n  projectId: \"…\",\n  …\n};", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": "Dati firebaseConfig" });
  const msg = h("p", { class: "msg-errore", role: "alert" });
  const btn = h("button", { type: "button", class: "btn primario" }, icona("nuvola"), "Collega");
  btn.onclick = async () => {
    msg.textContent = "";
    const cfg = leggiConfig(area.value);
    if (!cfg) { msg.textContent = "Non trovo apiKey e projectId: incolla tutto il riquadro firebaseConfig."; return; }
    btn.disabled = true; btn.lastChild.textContent = "Provo il collegamento…";
    const err = await provaFirebase(cfg);
    btn.disabled = false; btn.lastChild.textContent = "Collega";
    if (err) { msg.textContent = err; return; }
    salvaServer(cfg);
    vibra(15);
    location.reload();
  };
  const passo = (n, titolo, ...corpo) => h("li", { class: "passo" },
    h("span", { class: "passo-n" }, String(n)),
    h("div", {}, h("h4", {}, titolo), ...corpo));

  riempi(d,
    h("div", { class: "maniglia" }),
    h("div", { class: "foglio-testa" },
      h("div", {}, h("div", { class: "occhiello" }, c ? `Collegato a ${server.nome}` : "Una volta sola, poi basta"), h("h2", {}, "Collega il server")),
      h("button", { type: "button", class: "tondo", "aria-label": "Chiudi", onclick: () => d.close() }, icona("chiudi"))
    ),
    h("p", { class: "sotto-titolo" }, "Il server è un piccolo database gratuito di Google (Firebase) dove l'app tiene la lista di tutta la famiglia. Lo prepara una persona sola; gli altri si collegano col codice QR."),
    h("ol", { class: "passi" },
      passo(1, "Crea il progetto",
        h("p", {}, "Apri Firebase, entra con un account Google e premi «Crea un progetto». Chiamalo per esempio ", h("b", {}, "spesa-famiglia"), ". Google Analytics non serve."),
        h("a", { class: "btn secondario piccolo", href: "https://console.firebase.google.com/", target: "_blank", rel: "noopener" }, "Apri Firebase", icona("freccia"))),
      passo(2, "Crea il database",
        h("p", {}, "Nel menu: ", h("b", {}, "Build → Firestore Database → Crea database"), ". Posizione ", h("b", {}, "eur3 (Europa)"), ", modalità ", h("b", {}, "produzione"), ".")),
      passo(3, "Incolla le regole",
        h("p", {}, "Nella scheda ", h("b", {}, "Regole"), " cancella tutto, incolla queste e premi ", h("b", {}, "Pubblica"), ":"),
        h("pre", { class: "regole" }, REGOLE),
        h("button", {
          type: "button", class: "btn secondario piccolo", onclick: async () => {
            try { await navigator.clipboard.writeText(REGOLE); toast("Regole copiate"); } catch { prompt("Copia le regole:", REGOLE); }
          }
        }, icona("copia"), "Copia le regole")),
      passo(4, "Copia i dati del progetto",
        h("p", {}, "Torna alla pagina del progetto, premi l'icona ", h("b", {}, "</>"), " (app Web), scrivi un nome e premi ", h("b", {}, "Registra"), ". Copia il riquadro ", h("b", {}, "firebaseConfig"), " e incollalo qui:"),
        area)
    ),
    msg,
    h("div", { class: "foglio-azioni" },
      c ? h("button", {
        type: "button", class: "btn pericolo", onclick: () => {
          if (!confirm("Scollegare questo telefono dal server? La lista tornerà solo su questo telefono.")) return;
          salvaServer(null); location.reload();
        }
      }, "Scollega") : null,
      btn)
  );
  chiudiFuori(d);
  d.showModal();
}

// ---------- accesso con la password della famiglia ----------

function chiediPassword() {
  return new Promise(fine => {
    const d = $("#accesso");
    let crea = false;

    const campo = (ph, auto) => {
      const inp = h("input", { class: "campo", type: "password", placeholder: ph, autocomplete: auto, enterkeyhint: "go", "aria-label": ph });
      const occhio = h("button", { type: "button", class: "occhio", "aria-label": "Mostra password" }, icona("occhio"));
      occhio.onclick = () => { inp.type = inp.type === "password" ? "text" : "password"; inp.focus(); };
      return { inp, el: h("div", { class: "campo-password" }, icona("lucchetto"), inp, occhio) };
    };

    function disegnaAccesso() {
      const p1 = campo(crea ? "Scegli una password" : "Password della famiglia", crea ? "new-password" : "current-password");
      const p2 = campo("Ripeti la password", "new-password");
      const msg = h("p", { class: "msg-errore", role: "alert" });
      const btn = h("button", { type: "submit", class: "btn primario largo" }, crea ? "Crea la famiglia" : "Entra");
      const form = h("form", {
        class: "accesso-form", onsubmit: async e => {
          e.preventDefault();
          msg.textContent = "";
          const pw = p1.inp.value.trim();
          if (crea) {
            if (pw.length < 6) { msg.textContent = "Usa almeno 6 caratteri."; p1.inp.focus(); return; }
            if (pw !== p2.inp.value.trim()) { msg.textContent = "Le due password non sono uguali."; p2.inp.focus(); return; }
          } else if (!pw) { p1.inp.focus(); return; }
          btn.disabled = true; btn.textContent = "Un attimo…";
          try {
            const id = await chiaveFamiglia(pw);
            const c = await server.esiste(id);
            if (!c && !crea) {
              msg.textContent = "Password sbagliata. Riprova.";
              form.classList.add("scuoti"); setTimeout(() => form.classList.remove("scuoti"), 400);
              vibra([20, 60, 20]);
              btn.disabled = false; btn.textContent = "Entra";
              p1.inp.select();
              return;
            }
            if (!c) await server.crea(id);
            salvaFamiglia(id);
            vibra(15);
            d.close();
            fine(id);
          } catch (err) {
            console.error(err);
            msg.textContent = server.condiviso
              ? "Non riesco a contattare il server: per entrare la prima volta serve internet."
              : "Qualcosa è andato storto. Riprova.";
            btn.disabled = false; btn.textContent = crea ? "Crea la famiglia" : "Entra";
          }
        }
      },
        p1.el, crea ? p2.el : null,
        crea ? h("p", { class: "suggerimento" }, "Almeno 6 caratteri. Dilla solo a Gio, Bea, Luca e Ori: chi non la sa non può vedere né cambiare la lista.") : null,
        msg, btn
      );

      riempi(d,
        h("img", { class: "logo-grande", src: "icons/icon-512.png", alt: "" }),
        h("h2", {}, crea ? "Crea la famiglia" : "La nostra spesa"),
        h("p", { class: "sotto-titolo" }, crea
          ? "Scegli la password che userete tutti per entrare."
          : "Inserisci la password della famiglia per entrare."),
        form,
        h("button", { type: "button", class: "link-tenue", onclick: () => { crea = !crea; disegnaAccesso(); } },
          crea ? "Ho già una password" : "È la prima volta? Crea la famiglia"),
        h("div", { class: "accesso-server" + (server.condiviso ? " ok" : "") },
          server.condiviso
            ? [h("span", { class: "punto" }), `Server collegato · ${server.nome}`]
            : [icona("telefono"), "Server non collegato · ", h("button", { type: "button", onclick: () => apriServer2() }, "Collega")]
        )
      );
      setTimeout(() => p1.inp.focus(), 50);
    }

    d.addEventListener("cancel", e => e.preventDefault());
    disegnaAccesso();
    d.showModal();
  });
}

// ---------- disegno generale ----------

function disegna() {
  const p = persona(pagina);
  document.documentElement.style.setProperty("--c1", p ? p.colore : "#5b6b82");
  document.documentElement.style.setProperty("--c2", p ? p.colore2 : "#141b26");
  if (!corrente || corrente.id !== pagina) {
    const pag = p ? costruisciPersona(p) : costruisciTutti();
    corrente = { id: pagina, ...pag, err: h("div") };
    riempi($("#pagina"), corrente.err, ...pag.root);
    $("#pagina").classList.remove("cambia"); void $("#pagina").offsetWidth; $("#pagina").classList.add("cambia");
  }
  riempi(corrente.err, ...(errore ? [h("p", { class: "errore" }, errore)] : []));
  corrente.aggiorna();
  disegnaTabs();
  if (caricato) elementi.forEach(e => visti.add(e.id));
  // le chiavi dei gruppi (lista Tutti) contano come viste
  raggruppa(elementi).forEach(g => visti.add(g.ids.join("|")));
  const ora = Date.now();
  for (const [id, t] of appena) if (ora - t > 1500) appena.delete(id);

  if (inModifica && !elementi.some(e => e.id === inModifica)) { $("#modifica").close(); inModifica = null; }
}

function mostraErrore(err) {
  console.error(err);
  errore = "Non riesco a salvare: controlla la connessione o le impostazioni di Firebase.";
  disegna();
}

async function avvia() {
  const daHash = location.hash.slice(1);
  pagina = daHash === "tutti" || persona(daHash) ? daHash : (io() || "tutti");
  const invitato = leggiInvito();
  // link d'invito aperto con l'app già aperta: ricarica col nuovo server
  addEventListener("hashchange", () => { if (location.hash.startsWith("#invito=")) { leggiInvito(); location.reload(); } });

  server = await apriServer(serverSalvato() || CONFIG.firebase);
  disegnaStato();
  disegnaIo();
  addEventListener("online", disegnaStato);
  addEventListener("offline", disegnaStato);
  $("#modifica").addEventListener("close", () => { inModifica = null; });
  $("#modifica").addEventListener("click", e => { if (e.target === $("#modifica")) $("#modifica").close(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  const famiglia = famigliaSalvata() || await chiediPassword();
  if (invitato && server.condiviso) toast("Telefono collegato alla famiglia");
  store = server.famiglia(famiglia);

  store.ascolta(lista => {
    elementi = lista.map(e => ({
      ...e, quantita: Number(e.quantita) || 1, creato: e.creato || 0,
      urgente: !!e.urgente, comprato: !!e.comprato
    }));
    errore = "";
    if (!caricato) { elementi.forEach(e => visti.add(e.id)); }
    disegna();
    caricato = true;
  }, err => mostraErrore(err));

  if (!corrente) disegna();
  if (!io()) chiediChiSei(true);

  // aggiorna i "5 min fa" ogni minuto
  setInterval(() => corrente && corrente.aggiorna(), 60000);
}

avvia();
