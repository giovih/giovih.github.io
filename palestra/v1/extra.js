// Progressi (corpo, foto, diario), Coach AI e salvataggio online (Supabase).
"use strict";

// ====================================================================
// PROGRESSI: tre sotto-schede
// ====================================================================

let sottoProgressi = "corpo";

function progressi() {
  const tab = (k, t) => `<button class="${sottoProgressi === k ? "on" : ""}" data-a="sotto" data-v="${k}">${t}</button>`;
  const corpo = sottoProgressi === "corpo" ? vistaCorpo()
    : sottoProgressi === "diario" ? vistaDiario() : storico();
  return `<header class="testa"><h1>Progressi</h1></header>
    <div class="segmenti">${tab("corpo", "Corpo")}${tab("allenamenti", "Allenamenti")}${tab("diario", "Diario")}</div>
    ${corpo}`;
}

// ---------- Corpo: peso grande, grafico, foto ----------

function vistaCorpo() {
  initCibo();
  const p = [...S.peso].sort((a, b) => a.data.localeCompare(b.data));
  const ult = p.at(-1), primo = p[0];
  const diff = ult && primo ? ult.kg - primo.kg : 0;
  const settimane = ult && primo ? Math.max(1, (new Date(ult.data) - new Date(primo.data)) / (7 * GIORNO)) : 1;
  const media = p.length > 1 ? diff / settimane : 0;
  return `<section class="body-hero">
      <div class="body-titolo">BODY.</div>
      <div class="body-peso">${ult ? kgTxt(ult.kg) : "–"}<small>kg</small></div>
      <div class="body-info">${p.length > 1
        ? `${diff >= 0 ? "+" : ""}${kgTxt(+diff.toFixed(2))} kg dall'inizio · media ${media >= 0 ? "+" : ""}${kgTxt(+media.toFixed(2))} kg/settimana`
        : "Obiettivo: +0,25-0,5 kg a settimana"}</div>
      ${graficoPeso()}
      <div class="peso-riga"><input id="peso" class="campo" inputmode="decimal" placeholder="Peso di oggi, a digiuno"><button data-a="salva-peso">Salva</button></div>
      <p class="nota">${consiglioPeso()}</p>
    </section>
    <section class="card"><div class="card-testa"><h2>Foto di progresso</h2><span>1 al mese</span></div>
      <p class="nota">Restano <b>solo su questo telefono</b>: non vanno nel backup né online.</p>
      ${vistaFoto()}
      <div class="scelte">
        <label class="bottone">Scatta<input type="file" accept="image/*" capture="user" data-a="nuova-foto" hidden></label>
        <label class="bottone">Libreria<input type="file" accept="image/*" data-a="nuova-foto" hidden></label>
      </div>
    </section>`;
}

// Le foto stanno in IndexedDB (localStorage è troppo piccolo per le immagini).
let fotoCache = null; // [{ id, data, img, mini }]

function dbFoto() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("palestra-foto", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("foto", { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function caricaFoto() {
  try {
    const db = await dbFoto();
    fotoCache = await new Promise(ok => {
      const q = db.transaction("foto").objectStore("foto").getAll();
      q.onsuccess = () => ok(q.result.sort((a, b) => a.data.localeCompare(b.data)));
      q.onerror = () => ok([]);
    });
  } catch { fotoCache = []; }
  if (vista === "progressi") disegna();
}
async function salvaFoto(rec, elimina = false) {
  const db = await dbFoto();
  await new Promise((ok, ko) => {
    const tx = db.transaction("foto", "readwrite");
    elimina ? tx.objectStore("foto").delete(rec) : tx.objectStore("foto").put(rec);
    tx.oncomplete = ok; tx.onerror = () => ko(tx.error);
  });
  await caricaFoto();
}

let confronto = null; // [idPrima, idDopo]

function vistaFoto() {
  if (fotoCache === null) { caricaFoto(); return `<p class="nota">Carico le foto…</p>`; }
  if (!fotoCache.length) return `<p class="nota">Nessuna foto. Fanne una oggi: stessa luce, stessa posa, ogni 4 settimane.</p>`;
  const f = fotoCache;
  const [a, b] = confronto && f.find(x => x.id === confronto[0]) && f.find(x => x.id === confronto[1])
    ? confronto.map(id => f.find(x => x.id === id)) : [f[0], f.at(-1)];
  const giorni = Math.round((new Date(b.data) - new Date(a.data)) / GIORNO);
  return `${f.length > 1 ? `<div class="confronto">
      <figure><img src="${a.img}" alt=""><figcaption>Prima · ${dataTxt(a.data + "T12:00")}</figcaption></figure>
      <figure><img src="${b.img}" alt=""><figcaption>Dopo · ${dataTxt(b.data + "T12:00")}</figcaption></figure>
    </div><p class="nota">${giorni} giorni di differenza. Tocca le miniature per scegliere cosa confrontare.</p>` :
    `<div class="confronto uno"><figure><img src="${a.img}" alt=""><figcaption>${dataTxt(a.data + "T12:00")}</figcaption></figure></div>`}
    <div class="miniature">${f.map(x => `<button data-a="foto" data-v="${x.id}" class="${x.id === a.id || x.id === b.id ? "on" : ""}">
      <img src="${x.mini}" alt=""><span>${x.data.slice(5).split("-").reverse().join("/")}</span></button>`).join("")}</div>`;
}

function apriFoto(id) {
  const x = fotoCache.find(f => f.id === id);
  const d = $("#dialogo");
  d.innerHTML = `<h2>Foto del ${dataTxt(x.data + "T12:00")}</h2>
    <img src="${x.img}" class="anteprima" style="max-height:50vh;object-fit:contain" alt="">
    <button class="grande" data-a="confronta" data-v="prima" data-i="${id}">Usa come PRIMA</button>
    <button class="grande" data-a="confronta" data-v="dopo" data-i="${id}">Usa come DOPO</button>
    <button class="secondario" data-a="elimina-foto" data-v="${id}">Elimina foto</button>
    <button class="secondario" style="color:var(--grigio)" data-a="chiudi">Chiudi</button>`;
  d.showModal();
}

// ---------- Diario ogni 4 settimane ----------

/** Miglior serie (peso più alto, poi più ripetizioni) di un esercizio. */
function migliore(nome) {
  let top = null;
  for (const s of S.sedute) for (const v of s.voci) if (v.ex === nome)
    for (const x of v.sets) if (x.fatto && (!top || x.kg > top.kg || (x.kg === top.kg && x.reps > top.reps))) top = x;
  return top ? `${kgTxt(top.kg)} kg × ${top.reps}` : "";
}

function vistaDiario() {
  S.diario ||= [];
  const w = settimana();
  return `${w.n === 1 || w.n % 4 === 0
      ? `<div class="avviso giallo">Settimana ${w.n}: è settimana di diario!</div>`
      : `<p class="nota">Il diario si compila nelle settimane 1, 4, 8, 12… (ora sei alla ${w.n}).</p>`}
    <button class="grande" data-a="nuovo-diario">+ Compila il diario</button>
    ${[...S.diario].reverse().map((e, i) => `<section class="card pad diario">
      <b>Settimana ${e.settimana} · ${dataTxt(e.data + "T12:00")}</b>
      <div>Peso: ${kgTxt(e.peso)} kg</div>
      <div>Panca: ${esc(e.panca || "–")}</div>
      <div>Squat: ${esc(e.squat || "–")}</div>
      <div>Rematore: ${esc(e.rematore || "–")}</div>
      ${e.note ? `<div class="nota">${esc(e.note)}</div>` : ""}
      <button class="secondario" data-a="elimina-diario" data-v="${S.diario.length - 1 - i}">Elimina</button>
    </section>`).join("")}`;
}

function apriDiario() {
  initCibo();
  const p = [...S.peso].sort((a, b) => a.data.localeCompare(b.data)).at(-1);
  const d = $("#dialogo");
  d.innerHTML = `<h2>Diario · settimana ${settimana().n}</h2>
    <label class="etichetta">Peso corporeo (kg)<input id="d-peso" class="campo" inputmode="decimal" value="${p ? kgTxt(p.kg) : ""}"></label>
    <label class="etichetta">Panca<input id="d-panca" class="campo" value="${esc(migliore("Panca piana"))}"></label>
    <label class="etichetta">Squat<input id="d-squat" class="campo" value="${esc(migliore("Squat"))}"></label>
    <label class="etichetta">Rematore<input id="d-rematore" class="campo" value="${esc(migliore("Rematore con bilanciere"))}"></label>
    <label class="etichetta">Note (come ti senti, cosa è cambiato)<textarea id="d-note" class="campo" rows="3"></textarea></label>
    <button class="grande verde" data-a="salva-diario">Salva</button>
    <button class="secondario" data-a="chiudi">Annulla</button>`;
  d.showModal();
}

// ====================================================================
// COACH: chat con l'AI che legge i tuoi dati
// ====================================================================

let chat = [];          // [{ io: bool, testo }]
let chatInCorso = false;
let chatErrore = "";

function coach() {
  const esempi = ["Come sta andando la panca?", "Quanto ho mangiato questa settimana?",
    "Cosa devo fare oggi in palestra?", "Sto salendo di peso abbastanza?"];
  return `<header class="testa"><h1>Coach</h1>
      ${chat.length ? `<button class="piccolo" data-a="chat-nuova">Nuova chat</button>` : ""}</header>
    ${chat.length ? "" : `<p class="nota">Chiedimi qualsiasi cosa sui tuoi allenamenti, sul cibo o sul peso: guardo i dati dell'app.</p>
      <div class="esempi">${esempi.map(q => `<button data-a="chat-esempio" data-v="${esc(q)}">${q}</button>`).join("")}</div>`}
    <div class="chat">${chat.map(m => `<div class="bolla ${m.io ? "io" : ""}">${esc(m.testo).replace(/\n/g, "<br>")}</div>`).join("")}
      ${chatInCorso ? `<div class="bolla">Sto pensando…</div>` : ""}
      ${chatErrore ? `<div class="avviso giallo">${esc(chatErrore)}</div>` : ""}</div>
    <div class="chat-input"><textarea id="chat-testo" class="campo" rows="1" placeholder="Scrivi al coach…"></textarea>
      <button data-a="chat-invia" ${chatInCorso ? "disabled" : ""}>Invia</button></div>`;
}

/** Riassunto dei dati dell'app da dare al coach. */
function riassuntoDati() {
  initCibo();
  const w = settimana(), out = [];
  out.push(`Oggi: ${new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}. Settimana ${w.n}, ciclo ${w.ciclo}/8${w.ciclo === 8 ? " (scarico)" : ""}.`);
  out.push("Calendario: " + [1, 2, 3, 4, 5, 6, 7].map(d => `${NOMI_GIORNI[d]} ${S.calendario[d] ? S.schede[S.calendario[d]].nome : "riposo"}`).join(", "));
  out.push("\nALLENAMENTI (ultime 6 settimane, dal più recente):");
  const da = Date.now() - 42 * GIORNO;
  const sed = [...S.sedute].reverse().filter(s => new Date(s.data) >= da).slice(0, 24);
  for (const s of sed) {
    out.push(`- ${s.data.slice(0, 10)} ${s.nome}${s.scarico ? " (scarico)" : ""}: ` + s.voci
      .filter(v => v.sets.some(x => x.fatto))
      .map(v => `${v.ex} ${v.sets.filter(x => x.fatto).map(x => `${kgTxt(x.kg)}x${x.reps}`).join(",")}`).join("; "));
  }
  if (!sed.length) out.push("nessuno");
  out.push("\nCIBO (ultimi 7 giorni):");
  for (let i = 0; i < 7; i++) {
    const g = isoData(new Date(Date.now() - i * GIORNO));
    if (!S.cibo[g]) continue;
    const t = totali(g);
    out.push(`- ${g}: ${t.kcal} kcal, P ${t.prot} g, C ${t.carb} g, G ${t.grassi} g, acqua ${S.cibo[g].acqua} ml, creatina ${S.cibo[g].creatina ? "sì" : "no"}`);
  }
  out.push(`Obiettivi: ${S.obiettivi.kcalMin}-${S.obiettivi.kcalMax} kcal, proteine ≥${S.obiettivi.prot} g.`);
  out.push("\nPESO (partenza 56,1 kg): " + [...S.peso].sort((a, b) => a.data.localeCompare(b.data)).slice(-8).map(p => `${p.data} ${kgTxt(p.kg)} kg`).join(", "));
  if (S.diario?.length) out.push("\nDIARIO: " + S.diario.map(e => `sett. ${e.settimana}: ${kgTxt(e.peso)} kg, panca ${e.panca}, squat ${e.squat}, rematore ${e.rematore}`).join(" | "));
  return out.join("\n");
}

async function inviaChat(testo) {
  // il Coach ora è solo nella nuova app (la chiave dell'AI sta sul server, non sul telefono)
  if (!testo.trim()) return;
  chatErrore = "Il Coach ora è nella nuova app: torna alla nuova versione.";
  disegna();
}
const scrollaChat = () => window.scrollTo(0, document.body.scrollHeight);

// ====================================================================
// SALVATAGGIO ONLINE (Supabase, facoltativo)
// ====================================================================
// Una riga per utente nella tabella "stato" con tutti i dati (foto escluse).
// L'indirizzo e la chiave pubblica ("anon") si incollano in Altro: non sono nel codice.

const SYNC_KEY = "palestra-sync";
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } })();
let syncStato = "";
let syncTimer = null;
const salvaSync = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch {} };
const syncAttivo = () => !!(sync.url && sync.anon && sync.refresh);

async function supa(percorso, opzioni = {}, conToken = true) {
  if (conToken && sync.scade && Date.now() > sync.scade - 60000) await rinnovaToken();
  const r = await fetch(sync.url.replace(/\/$/, "") + percorso, {
    ...opzioni,
    headers: {
      apikey: sync.anon, "content-type": "application/json",
      ...(conToken && sync.token ? { authorization: "Bearer " + sync.token } : {}),
      ...(opzioni.headers || {})
    }
  });
  const testo = await r.text();
  const dati = testo ? JSON.parse(testo) : null;
  if (!r.ok) throw new Error(dati?.msg || dati?.error_description || dati?.message || `Errore ${r.status}`);
  return dati;
}

function salvaSessione(d) {
  sync.token = d.access_token; sync.refresh = d.refresh_token;
  sync.scade = Date.now() + d.expires_in * 1000; sync.utente = d.user?.id || sync.utente;
  sync.email = d.user?.email || sync.email;
  salvaSync();
}
async function rinnovaToken() {
  const d = await supa("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: sync.refresh })
  }, false);
  salvaSessione(d);
}

async function accedi(registrati) {
  sync.url = $("#s-url").value.trim(); sync.anon = $("#s-anon").value.trim();
  const email = $("#s-email").value.trim(), password = $("#s-pw").value;
  if (!sync.url || !sync.anon || !email || password.length < 6) {
    syncStato = "Compila tutti i campi (password di almeno 6 caratteri)."; return disegna();
  }
  salvaSync();
  try {
    if (registrati) {
      const d = await supa("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) }, false);
      if (!d.access_token) { syncStato = "Controlla la tua email e conferma l'account, poi premi Accedi."; return disegna(); }
      salvaSessione(d);
    } else {
      salvaSessione(await supa("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }, false));
    }
    await scarica(true);
    syncStato = "Collegato.";
  } catch (e) { syncStato = "" + e.message; }
  disegna();
}

/** Dati da mandare online: tutto tranne foto dei pasti e timer. */
function datiDaInviare() {
  const copia = JSON.parse(JSON.stringify(S));
  delete copia.timerFine;
  for (const g of Object.values(copia.cibo || {}))
    for (const lista of Object.values(g.pasti || {})) for (const x of lista) delete x.foto;
  return copia;
}

async function carica() {
  if (!syncAttivo()) return;
  try {
    await supa("/rest/v1/stato?on_conflict=user_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: sync.utente, dati: datiDaInviare(), aggiornato: new Date(S.aggiornato || Date.now()).toISOString() })
    });
    sync.ultimo = Date.now(); salvaSync();
  } catch (e) { syncStato = "Salvataggio online non riuscito: " + e.message; }
}

/** Scarica i dati online: se sono più recenti di quelli del telefono, li usa. */
async function scarica(primaVolta = false) {
  if (!syncAttivo()) return;
  try {
    const righe = await supa(`/rest/v1/stato?select=dati,aggiornato&user_id=eq.${sync.utente}`);
    const remoto = righe?.[0];
    if (!remoto) return carica();          // primo collegamento: carico i dati del telefono
    const tRemoto = new Date(remoto.aggiornato).getTime();
    if (tRemoto > (S.aggiornato || 0)) {
      // tengo le foto dei pasti che ho sul telefono
      const fotoLocali = {};
      for (const [g, v] of Object.entries(S.cibo || {})) fotoLocali[g] = v.pasti;
      S = remoto.dati;
      for (const [g, pasti] of Object.entries(fotoLocali)) {
        const nuovo = S.cibo?.[g]?.pasti;
        if (!nuovo) continue;
        for (const [k, lista] of Object.entries(nuovo)) lista.forEach((x, i) => { x.foto ||= pasti?.[k]?.[i]?.foto; });
      }
      S.aggiornato = tRemoto;
      salva(true);
      disegna();
    } else if (primaVolta || (S.aggiornato || 0) > tRemoto) {
      await carica();
    }
  } catch (e) { syncStato = "" + e.message; }
}

/** Chiamata da salva(): manda online dopo 3 secondi di pausa. */
window.dopoSalva = () => {
  if (!syncAttivo()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(carica, 3000);
};

function avviaSync() {
  scarica();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearTimeout(syncTimer); carica(); } else scarica();
  });
}

const SQL_SUPABASE = `create table stato (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  dati jsonb not null,
  aggiornato timestamptz not null default now()
);
alter table stato enable row level security;
create policy "solo i miei dati" on stato for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

function sezioneSync() {
  if (syncAttivo()) {
    return `<section class="card"><div class="card-testa"><h2>Salvataggio online</h2><span>attivo</span></div>
      <p class="nota">Collegato come <b>${esc(sync.email || "")}</b>. I dati si salvano da soli
      ${sync.ultimo ? `(ultimo: ${new Date(sync.ultimo).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` : ""}.
      Le foto restano solo sul telefono. ${esc(syncStato)}</p>
      <div class="scelte"><button data-a="sync-ora">Sincronizza ora</button><button data-a="sync-esci">Scollega</button></div></section>`;
  }
  return `<section class="card"><details><summary>Salvataggio online (facoltativo)</summary>
    <p class="nota">Così non perdi i dati se cambi telefono o cancelli Safari. Gratis con <b>Supabase</b>:</p>
    <ol class="passi">
      <li>Vai su <b>supabase.com</b> → Start your project → accedi con GitHub → <b>New project</b> (piano Free, regione Europa).</li>
      <li>Apri <b>SQL Editor</b>, incolla questo testo e premi <b>Run</b>:
        <pre class="codice">${esc(SQL_SUPABASE)}</pre><button class="piccolo" data-a="copia-sql">Copia</button></li>
      <li>In <b>Project Settings → API</b> copia <b>Project URL</b> e la chiave <b>anon public</b> qui sotto.</li>
      <li>Scegli email e password e premi <b>Crea account</b> (poi conferma l'email).</li>
    </ol>
    <div class="pad">
      <input id="s-url" class="campo" placeholder="https://xxxx.supabase.co" value="${esc(sync.url || "")}">
      <input id="s-anon" class="campo" placeholder="chiave anon public" value="${esc(sync.anon || "")}">
      <input id="s-email" class="campo" type="email" placeholder="email" value="${esc(sync.email || "")}">
      <input id="s-pw" class="campo" type="password" placeholder="password (min 6 caratteri)">
    </div>
    <div class="scelte"><button data-a="sync-registra">Crea account</button><button data-a="sync-accedi">Accedi</button></div>
    ${syncStato ? `<p class="nota">${esc(syncStato)}</p>` : ""}
  </details></section>`;
}

// ====================================================================
// Eventi (chiamati da app.js)
// ====================================================================

function azioneExtra(a, b) {
  const v = b.dataset.v;
  switch (a) {
    case "sotto": sottoProgressi = v; return disegna();
    case "foto": return apriFoto(v);
    case "confronta": {
      const id = b.dataset.i;
      const f = fotoCache;
      confronto = confronto || [f[0].id, f.at(-1).id];
      confronto[v === "prima" ? 0 : 1] = id;
      $("#dialogo").close(); return disegna();
    }
    case "elimina-foto":
      if (confirm("Eliminare questa foto?")) { $("#dialogo").close(); confronto = null; salvaFoto(v, true); }
      return;
    case "nuovo-diario": return apriDiario();
    case "salva-diario":
      S.diario ||= [];
      S.diario.push({
        data: isoData(new Date()), settimana: settimana().n,
        peso: num($("#d-peso").value.replace(",", ".")) || 0,
        panca: $("#d-panca").value, squat: $("#d-squat").value, rematore: $("#d-rematore").value,
        note: $("#d-note").value.trim()
      });
      salva(); $("#dialogo").close(); return disegna();
    case "elimina-diario":
      if (confirm("Eliminare questa voce del diario?")) { S.diario.splice(+v, 1); salva(); disegna(); }
      return;
    case "chat-esempio": return inviaChat(v);
    case "chat-invia": return inviaChat($("#chat-testo").value);
    case "chat-nuova": chat = []; chatErrore = ""; return disegna();
    case "sync-registra": return accedi(true);
    case "sync-accedi": return accedi(false);
    case "sync-ora": syncStato = ""; disegna(); return scarica(true).then(() => { syncStato = "Fatto."; disegna(); });
    case "sync-esci":
      if (confirm("Scollegare il salvataggio online? I dati restano sul telefono.")) { sync = { url: sync.url, anon: sync.anon }; salvaSync(); syncStato = ""; disegna(); }
      return;
    case "copia-sql": navigator.clipboard?.writeText(SQL_SUPABASE).then(() => { b.textContent = "Copiato ✓"; }); return;
  }
}

function cambioExtra(t) {
  if (t.dataset.a === "nuova-foto" && t.files[0]) {
    const file = t.files[0];
    (async () => {
      // foto grande per il confronto, miniatura per la griglia
      const img = await ridimensiona(file, 1280), mini = await ridimensiona(file, 200);
      confronto = null;
      await salvaFoto({ id: String(Date.now()), data: isoData(new Date()), img, mini });
    })().catch(() => alert("Non riesco a salvare la foto."));
  }
}

function ridimensiona(file, lato) {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, lato / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(im.src);
      ok(c.toDataURL("image/jpeg", 0.85));
    };
    im.onerror = ko;
    im.src = URL.createObjectURL(file);
  });
}

// Invio con il tasto ↵ nella chat
document.addEventListener("keydown", e => {
  if (e.target.id === "chat-testo" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); inviaChat(e.target.value); }
});
