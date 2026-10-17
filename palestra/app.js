// Scheda Palestra — versione web di prova. Tutti i dati restano sul telefono (localStorage).
"use strict";

// ---------- Dati salvati ----------

const CHIAVE = "palestra-v1";
const GIORNO = 86400000;
const NOMI_GIORNI = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function lunedi(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const isoData = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function statoIniziale() {
  return {
    v: 1,
    inizio: isoData(lunedi(new Date())), // lunedì della settimana 1
    calendario: { ...CALENDARIO_BASE },
    schede: JSON.parse(JSON.stringify(SCHEDE)),
    esercizi: [],      // esercizi creati da te
    sedute: [],        // allenamenti finiti
    attiva: null,      // allenamento in corso
    timerFine: null
  };
}

let S;
try { S = JSON.parse(localStorage.getItem(CHIAVE)) || statoIniziale(); } catch { S = statoIniziale(); }
// Salva sul telefono; se il salvataggio online è attivo, lo manda anche a Supabase (vedi extra.js).
const salva = (daRemoto = false) => {
  if (!daRemoto) S.aggiornato = Date.now();
  try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch {}
  if (!daRemoto) window.dopoSalva?.();
};

// ---------- Utilità ----------

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
const kgTxt = k => k == null ? "–" : String(+k.toFixed(2)).replace(".", ",");
const arrot = (k, passo = 0.5) => Math.round(k / passo) * passo;
const recTxt = (a, b) => (a >= 120 && a % 60 === 0 && b % 60 === 0)
  ? (a === b ? `${a / 60} min` : `${a / 60}-${b / 60} min`)
  : (a === b ? `${a} s` : `${a}-${b} s`);
const ripTxt = r => r.min === r.max ? `${r.serie} × ${r.min}` : `${r.serie} × ${r.min}-${r.max}`;
const dataTxt = iso => new Date(iso).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });

function tuttiEsercizi() { return [...CATALOGO, ...S.esercizi]; }
function attrezzo(nome) { return (tuttiEsercizi().find(e => e.nome === nome) || { eq: "mac" }).eq; }
function gruppo(nome) { return (tuttiEsercizi().find(e => e.nome === nome) || {}).gruppo; }

/** Settimana del programma: n = settimana totale, ciclo = 1..8 (8 = scarico). */
function settimana(d = new Date()) {
  const [y, m, g] = S.inizio.split("-").map(Number);
  const n = Math.max(0, Math.floor((lunedi(d) - new Date(y, m - 1, g)) / (7 * GIORNO) + 0.5)) + 1;
  return { n, ciclo: ((n - 1) % 8) + 1 };
}
const oggiNum = () => ((new Date().getDay() + 6) % 7) + 1;

// ---------- Doppia progressione ----------

/** Sedute normali (non di scarico) in cui c'è questo esercizio, dalla più recente. */
function storia(nome) {
  const out = [];
  for (const s of [...S.sedute].reverse()) {
    if (s.scarico) continue; // dopo lo scarico si riparte dai pesi di prima
    const v = s.voci.find(v => v.ex === nome);
    if (!v) continue;
    const fatte = v.sets.filter(x => x.fatto && x.reps > 0);
    if (fatte.length) out.push({ data: s.data, pulita: v.pulita !== false, sets: fatte });
  }
  return out;
}
const punti = h => h.sets.reduce((t, x) => t + x.reps, 0);

/** Cosa fare la prossima volta: { kg, reps[], msg }. */
function suggerisci(riga, scarico) {
  const eq = attrezzo(riga.ex);
  const A = ATTREZZI[eq];
  const h = storia(riga.ex);
  let kg = null, reps = Array(riga.serie).fill(riga.min), msg;

  if (!h.length) {
    msg = `Prima volta: scegli un peso con cui fai ${riga.min} ripetizioni pulite.`;
  } else {
    const ult = h[0];
    const kgU = ult.sets[0].kg ?? 0;
    const tuttoMax = ult.sets.length >= riga.serie && ult.sets.every(x => x.reps >= riga.max) && ult.pulita;
    const fermo = h.length >= 3 && h.slice(0, 3).every(x => (x.sets[0].kg ?? 0) === kgU) && punti(h[0]) <= punti(h[2]);

    if (tuttoMax) {
      kg = kgU + A.passo;
      msg = `Massimo in tutte le serie 💪 Sali di peso (${A.consiglio}) e riparti da ${riga.min}.`;
    } else if (fermo && kgU > 0) {
      kg = arrot(kgU * 0.9);
      msg = `Fermo da 3 sedute: scendi del 10% (${kgTxt(kg)} kg) e risali.`;
    } else {
      kg = kgU;
      reps = reps.map((_, i) => Math.min((ult.sets[i] ?? ult.sets[ult.sets.length - 1]).reps + 1, riga.max));
      const migliorato = h.length < 2 || punti(h[0]) > punti(h[1]);
      msg = migliorato
        ? "Stesso peso, +1 ripetizione per serie."
        : "L'ultima volta non hai aggiunto ripetizioni: stesso peso, riprova +1.";
      if (eq === "cl" && kgU === 0) msg += " (Al massimo in tutte le serie si aggiunge zavorra.)";
    }
  }
  if (scarico) {
    if (kg) kg = arrot(kg * 0.9);
    reps = reps.slice(0, Math.ceil(riga.serie / 2));
    msg = "Settimana di scarico: metà serie e -10% di peso. " + msg;
  }
  return { kg, reps, msg };
}

// ---------- Allenamento in corso ----------

function creaVoce(riga, scarico) {
  const sug = suggerisci(riga, scarico);
  return {
    ...riga, pulita: true, msg: sug.msg,
    sets: sug.reps.map(rp => ({ kg: sug.kg ?? "", reps: rp, fatto: false }))
  };
}

function inizia(codice) {
  const sc = S.schede[codice];
  const w = settimana();
  const scarico = w.ciclo === 8;
  S.attiva = {
    id: Date.now(), data: new Date().toISOString(), codice, nome: sc.nome, colore: sc.colore,
    settimana: w.n, ciclo: w.ciclo, scarico,
    voci: sc.righe.map(r => creaVoce(r, scarico))
  };
  salva();
  tieniSchermoAcceso();
  vai("allenamento");
}

function fine() {
  const a = S.attiva;
  const fatte = a.voci.reduce((t, v) => t + v.sets.filter(x => x.fatto).length, 0);
  if (!fatte && !confirm("Non hai spuntato nessuna serie. Chiudere senza salvare?")) return;
  if (fatte) {
    a.fine = new Date().toISOString();
    // nel diario vanno solo le serie fatte, con numeri veri
    a.voci.forEach(v => v.sets.forEach(x => { x.kg = num(x.kg); x.reps = num(x.reps) ?? 0; }));
    S.sedute.push(a);
  }
  S.attiva = null; S.timerFine = null;
  salva(); blocco?.release();
  fatte ? vai("riepilogo", a.id) : vai("oggi");
}

// ---------- Durata e schermo acceso ----------

// Lo schermo resta acceso durante l'allenamento: così il timer suona sempre.
let blocco = null;
async function tieniSchermoAcceso() {
  try { if (S.attiva && !blocco && navigator.wakeLock) { blocco = await navigator.wakeLock.request("screen"); blocco.addEventListener("release", () => blocco = null); } } catch {}
}
let tickDurata;
function aggiornaDurata() {
  clearInterval(tickDurata);
  if (!S.attiva || vista !== "allenamento") return;
  const agg = () => {
    const el = $("#durata"); if (!el) return clearInterval(tickDurata);
    const sec = Math.floor((Date.now() - new Date(S.attiva.data)) / 1000);
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = String(sec % 60).padStart(2, "0");
    el.textContent = h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  };
  agg(); tickDurata = setInterval(agg, 1000);
}

// ---------- Timer di recupero ----------

let audio, tick;
function sbloccaAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
}
function bip() {
  if (!audio) return;
  [0, 0.3, 0.6, 1.2, 1.5, 1.8].forEach(t => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = "square"; o.frequency.value = 1046; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.6, audio.currentTime + t);
    o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.2);
  });
  navigator.vibrate?.([200, 100, 200]);
}
function avviaTimer(sec) { S.timerFine = Date.now() + sec * 1000; salva(); disegnaTimer(); }
function disegnaTimer() {
  const el = $("#timer");
  clearInterval(tick);
  if (!S.timerFine || !S.attiva) { el.classList.add("nascosto"); return; }
  const agg = () => {
    const rest = Math.round((S.timerFine - Date.now()) / 1000);
    if (rest <= 0) {
      clearInterval(tick); S.timerFine = null; salva(); bip();
      el.innerHTML = `<div class="t-num pronto">VIA! Prossima serie</div><button data-a="timer-chiudi">OK</button>`;
      return;
    }
    const m = Math.floor(rest / 60), s = String(rest % 60).padStart(2, "0");
    el.innerHTML = `<button data-a="timer-piu" data-v="-15">−15</button>
      <div class="t-num">Recupero ${m}:${s}</div>
      <button data-a="timer-piu" data-v="15">+15</button>
      <button data-a="timer-chiudi">Salta</button>`;
  };
  el.classList.remove("nascosto");
  agg(); tick = setInterval(agg, 250);
}

// ---------- Viste ----------

let vista = "oggi", param = null;
function vai(v, p = null) {
  vista = v; param = p;
  document.querySelectorAll(".tab button").forEach(b => b.classList.toggle("on", b.dataset.tab === v));
  disegna(); window.scrollTo(0, 0);
}

function disegna() {
  const V = { oggi, allenamento, riepilogo, scheda, storico, impostazioni, cibo: window.cibo, progressi: window.progressi, coach: window.coach }[vista] || oggi;
  $("#vista").innerHTML = V();
  disegnaTimer();
  aggiornaDurata();
}

function avvisiSettimana(w) {
  const out = [];
  if (w.ciclo === 8) out.push(`<div class="avviso giallo">⚠️ <b>Settimana 8: SCARICO.</b> Metà serie e -10% di peso. Dalla prossima riparti dai pesi di prima.</div>`);
  else if (w.ciclo === 7) out.push(`<div class="avviso">La prossima settimana è di scarico.</div>`);
  if (w.ciclo >= 5 && w.ciclo < 8) out.push(`<div class="avviso">🔥 Drop set attivi: ultima serie di alzate laterali, croci e curl inclinato.</div>`);
  if (w.ciclo === 1 || w.ciclo === 4 || w.ciclo === 8) out.push(`<div class="avviso">📓 Settimana ${w.n}: è settimana di diario (peso, panca, squat, rematore).</div>`);
  return out.join("");
}

function oggi() {
  const w = settimana();
  const g = oggiNum();
  const cod = S.calendario[g];
  const fattoOggi = S.sedute.some(s => new Date(s.data).toDateString() === new Date().toDateString());
  let h = `<header class="testa"><h1>${NOMI_GIORNI[g]}</h1>
    <div class="sotto">Settimana ${w.n} · ciclo ${w.ciclo}/8</div></header>`;

  h += `<div class="giorni">${[1, 2, 3, 4, 5, 6, 7].map(d => {
    const c = S.calendario[d]; const sc = c && S.schede[c];
    return `<div class="g ${d === g ? "oggi" : ""}" style="${sc ? `background:${sc.colore}` : ""}">
      <b>${NOMI_GIORNI[d].slice(0, 3).toUpperCase()}</b><span>${sc ? sc.nome.replace("Upper ", "") : "–"}</span></div>`;
  }).join("")}</div>`;
  h += avvisiSettimana(w);

  const cr = S.cibo?.[isoData(new Date())]?.creatina;
  if (!cr) h += `<button class="avviso promemoria" data-a="vai" data-v="cibo">💊 Ricordati la creatina (5 g, anche nei giorni di riposo)</button>`;
  if (S.attiva) {
    h += `<button class="grande" style="background:${S.attiva.colore}" data-a="riprendi">▶︎ Riprendi ${esc(S.attiva.nome)}</button>`;
    return h;
  }
  if (cod) {
    const sc = S.schede[cod];
    h += `<section class="card"><div class="card-testa" style="background:${sc.colore}">
      <h2>${sc.nome}</h2><span>${sc.sotto}</span></div>
      ${sc.righe.map(r => `<div class="riga"><span>${esc(r.ex)}${r.ss ? ' <i class="ss">SS</i>' : ""}</span>
        <b>${ripTxt(r)}</b><em>${recTxt(r.recMin, r.recMax)}</em></div>`).join("")}</section>`;
    if (fattoOggi) h += `<div class="avviso verde">✅ Allenamento di oggi già fatto.</div>`;
    h += `<button class="grande" style="background:${sc.colore}" data-a="inizia" data-v="${cod}">Inizia allenamento</button>`;
  } else {
    h += `<section class="card riposo"><h2>😴 Oggi riposo</h2>
      <p>Mangia bene, dormi e prendi la creatina.</p></section>`;
  }
  h += `<details class="altro"><summary>Fai un altro allenamento</summary>
    <p class="nota">Se hai saltato un allenamento, riprendi dal successivo senza raddoppiare.</p>
    <div class="scelte">${Object.entries(S.schede).map(([c, sc]) =>
      `<button style="background:${sc.colore}" data-a="inizia" data-v="${c}">${sc.nome}</button>`).join("")}</div></details>`;
  return h;
}

function allenamento() {
  const a = S.attiva;
  if (!a) return oggi();
  const tot = a.voci.reduce((t, v) => t + v.sets.length, 0);
  const fatte = a.voci.reduce((t, v) => t + v.sets.filter(x => x.fatto).length, 0);
  const pct = tot ? Math.round(fatte / tot * 100) : 0;
  let h = `<div class="barra-all">
      <div class="ba-riga"><b>${esc(a.nome)}</b><span>⏱ <span id="durata">0:00</span></span></div>
      <div class="ba-riga piccola"><span>${fatte}/${tot} serie</span><span>${pct}%</span></div>
      <div class="progresso"><div style="width:${pct}%;background:${a.colore}"></div></div>
    </div>
    <div class="sotto" style="margin:8px 4px">Settimana ${a.settimana} · ciclo ${a.ciclo}/8${a.scarico ? " · SCARICO" : ""}</div>
    <details class="regole"><summary>📌 Regole di esecuzione</summary><ul>${REGOLE.map(x => `<li>${x}</li>`).join("")}</ul></details>`;

  a.voci.forEach((v, i) => {
    const eq = attrezzo(v.ex), A = ATTREZZI[eq];
    const h0 = storia(v.ex)[0];
    const ultima = h0 ? h0.sets.map(x => `${kgTxt(x.kg)}×${x.reps}`).join(" · ") : "mai fatto";
    const conSucc = v.ss && a.voci[i + 1]?.ss === v.ss;
    const conPrec = v.ss && a.voci[i - 1]?.ss === v.ss;
    const dropOn = v.drop && a.ciclo >= 5 && !a.scarico;
    h += `<section class="card es ${conSucc ? "ss-su" : ""} ${conPrec ? "ss-giu" : ""}">
      <div class="es-testa"><h3>${esc(v.ex)}${v.ss ? ` <i class="ss">SUPERSERIE ${conSucc ? "→ poi " + esc(a.voci[i + 1].ex) : ""}</i>` : ""}</h3>
</div>
      <div class="es-info"><b>${ripTxt({ serie: v.sets.length, min: v.min, max: v.max })}</b> · rec ${recTxt(v.recMin, v.recMax)}${conSucc ? " (a fine coppia)" : ""}
        · <span class="${eq === "man" ? "evid" : ""}">${A.nome}: ${A.peso}</span></div>
      <div class="ultima">Ultima volta: ${ultima}</div>
      <div class="sug">💡 ${esc(v.msg)}</div>
      <div class="serie-testa"><span>#</span><span>${eq === "man" ? "kg / manubrio" : eq === "cl" ? "zavorra kg" : "kg"}</span><span>rip</span><span></span></div>
      ${v.sets.map((x, j) => `
        <div class="serie ${x.fatto ? "fatta" : ""}">
          <span class="n">${j + 1}</span>
          <input inputmode="decimal" data-i="${i}" data-j="${j}" data-k="kg" value="${x.kg}" placeholder="kg">
          <input inputmode="numeric" data-i="${i}" data-j="${j}" data-k="reps" value="${x.reps}" placeholder="${v.min}">
          <button class="spunta" data-a="spunta" data-i="${i}" data-j="${j}">✓</button>
        </div>
        ${dropOn && j === v.sets.length - 1 ? `<div class="drop">🔥 DROP SET: cedimento → -25% (${kgTxt(arrot((num(x.kg) || 0) * 0.75))} kg) → di nuovo cedimento. Nel diario segna solo la serie normale.</div>` : ""}`).join("")}
      <label class="pulita"><input type="checkbox" data-a="pulita" data-v="${i}" ${v.pulita ? "checked" : ""}> Tecnica pulita in tutte le serie</label>
      <button class="cambia" data-a="sostituisci" data-v="${i}">⇄ Macchina occupata? Cambia esercizio</button>
    </section>`;
  });
  h += `<button class="grande verde" data-a="fine">Fine allenamento</button>
    <button class="secondario" data-a="annulla">Annulla allenamento</button>`;
  return h;
}

function riepilogo() {
  const s = S.sedute.find(x => x.id === param);
  if (!s) return oggi();
  const min = s.fine ? Math.round((new Date(s.fine) - new Date(s.data)) / 60000) : null;
  const sc = S.schede[s.codice];
  const prossimo = sc ? sc.righe.map(r => ({ r, sug: suggerisci(r, false) })) : [];
  return `<header class="testa"><h1>Fatto! 🎉</h1><div class="sotto">${esc(s.nome)}${min ? ` · ${min} min` : ""}</div></header>
    <section class="card"><div class="card-testa" style="background:${s.colore}"><h2>Prossima volta</h2></div>
    ${prossimo.map(({ r, sug }) => `<div class="riga col"><b>${esc(r.ex)}</b>
      <span>${sug.kg != null ? kgTxt(sug.kg) + " kg × " : ""}${sug.reps.join(" / ")}</span><em>${esc(sug.msg)}</em></div>`).join("")}
    </section><button class="grande" data-a="vai" data-v="oggi">OK</button>`;
}

function scheda() {
  const opzioni = sel => `<option value="">Riposo</option>` + Object.entries(S.schede)
    .map(([c, sc]) => `<option value="${c}" ${sel === c ? "selected" : ""}>${sc.nome}</option>`).join("");
  return `<header class="testa"><h1>Scheda</h1><div class="sotto">3 giorni upper + 1 gambe · ipertrofia</div></header>
    <section class="card"><div class="card-testa"><h2>Calendario</h2></div>
    ${[1, 2, 3, 4, 5, 6, 7].map(d => `<label class="riga"><span>${NOMI_GIORNI[d]}</span>
      <select data-a="cal" data-v="${d}">${opzioni(S.calendario[d])}</select></label>`).join("")}
    <div class="scelte"><button data-a="cal-base">Lun A · Mer B · Ven G · Sab C</button>
    <button data-a="cal-alt">Lun G · Mer A · Ven B · Dom C</button></div></section>
    <p class="nota">Tocca un esercizio per cambiarlo nella scheda.</p>
    ${Object.entries(S.schede).map(([cod, sc]) => `<section class="card"><div class="card-testa" style="background:${sc.colore}">
      <h2>${sc.nome}</h2><span>${sc.sotto}</span></div>
      ${sc.righe.map((r, k) => `<div class="riga tocca" data-a="sostituisci-scheda" data-v="${cod}" data-i="${k}"><span>${esc(r.ex)}${r.ss ? ' <i class="ss">SS</i>' : ""}${attrezzo(r.ex) === "man" ? '<small>peso per manubrio</small>' : ""}</span>
        <b>${ripTxt(r)}</b><em>${recTxt(r.recMin, r.recMax)}</em></div>`).join("")}</section>`).join("")}
    <p class="nota">SS = superserie: i due esercizi di fila senza pausa, poi recuperi.</p>`;
}

function grafico(punti, chiave, colore, etichetta) {
  if (punti.length < 2) return `<p class="nota">${etichetta}: servono almeno 2 valori per il grafico.</p>`;
  const W = 320, H = 120, p = 24;
  const vals = punti.map(x => x[chiave]);
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
  const xy = vals.map((v, i) => [p + i * (W - 2 * p) / (vals.length - 1), H - p - (v - lo) / sp * (H - 2 * p)]);
  return `<div class="graf"><div class="graf-t">${etichetta}: <b>${kgTxt(vals[0])} → ${kgTxt(vals.at(-1))}</b></div>
    <svg viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="${colore}" stroke-width="3" points="${xy.map(q => q.join(",")).join(" ")}"/>
    ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="${colore}"/><text x="${x}" y="${y - 8}" text-anchor="middle">${kgTxt(vals[i])}</text>`).join("")}</svg></div>`;
}

function storico() {
  const nomi = [...new Set(S.sedute.flatMap(s => s.voci.filter(v => v.sets.some(x => x.fatto)).map(v => v.ex)))];
  const scelto = param && nomi.includes(param) ? param : nomi[0];
  let h = `<div class="sotto" style="margin:4px">${S.sedute.length} allenamenti</div>`;
  if (!nomi.length) return h + `<section class="card riposo"><p>Ancora niente: fai il primo allenamento!</p></section>`;
  const pts = storia(scelto).reverse().map(x => ({
    kg: Math.max(...x.sets.map(s => s.kg ?? 0)), reps: x.sets.reduce((t, s) => t + s.reps, 0)
  }));
  h += `<section class="card"><select class="largo" data-a="storico-es">${nomi.map(n => `<option ${n === scelto ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    ${grafico(pts, "kg", "#F97316", "Peso migliore (kg)")}${grafico(pts, "reps", "#60A5FA", "Ripetizioni totali")}</section>`;
  h += [...S.sedute].reverse().map(s => `<details class="card seduta"><summary><span style="color:${s.colore}">●</span> ${dataTxt(s.data)} · <b>${esc(s.nome)}</b>${s.scarico ? " · scarico" : ""}</summary>
    ${s.voci.filter(v => v.sets.some(x => x.fatto)).map(v => `<div class="riga col"><b>${esc(v.ex)}</b>
      <span>${v.sets.filter(x => x.fatto).map(x => `${kgTxt(x.kg)}×${x.reps}`).join(" · ")}</span></div>`).join("")}
    <button class="secondario" data-a="elimina" data-v="${s.id}">Elimina allenamento</button></details>`).join("");
  return h;
}

function impostazioni() {
  return `<header class="testa"><h1>Altro</h1></header>
    <button class="grande" data-a="vai" data-v="scheda">📋 Scheda e calendario</button>
    ${window.sezioneSync?.() ?? ""}
    <section class="card"><div class="card-testa"><h2>Programma</h2></div>
    <label class="riga"><span>Inizio settimana 1</span><input type="date" data-a="inizio" value="${S.inizio}"></label>
    <p class="nota">Ora sei alla settimana ${settimana().n} (ciclo ${settimana().ciclo}/8).</p></section>
    <section class="card"><div class="card-testa"><h2>Backup</h2></div>
    <p class="nota">I dati sono solo in questo telefono. Fai un backup ogni tanto: servirà anche per passarli all'app iPhone.</p>
    <div class="scelte"><button data-a="esporta">Salva backup</button>
    <label class="bottone">Carica backup<input type="file" accept=".json,application/json" data-a="importa" hidden></label></div></section>
    <section class="card"><div class="card-testa"><h2>Chiave AI (cibo e coach)</h2></div>
    <p class="nota">Incolla la chiave API di Anthropic. Resta solo su questo telefono, non va nel backup e non è nel codice del sito.
    ${(() => { try { return localStorage.getItem("palestra-api-key") ? "✅ Chiave salvata." : "Nessuna chiave."; } catch { return ""; } })()}</p>
    <div style="padding:0 12px"><input id="chiave" class="campo" type="password" placeholder="sk-ant-..." autocomplete="off"></div>
    <div class="scelte"><button data-a="salva-chiave">Salva chiave</button></div></section>
    <section class="card"><div class="card-testa"><h2>Blocco app</h2></div>
    <p class="nota">Un sito non può bloccare altre app: lo può fare solo l'app Swift vera, con le API Screen Time di Apple. Per ora puoi farlo con le funzioni dell'iPhone:</p>
    <ol class="passi">
      <li><b>Durante l'allenamento</b>: app <b>Comandi → Automazione → + → App</b> → scegli TikTok, Instagram… → <b>È aperta</b> → <b>Esegui subito</b> → azione <b>Apri app → Palestra</b>. Ogni volta che apri TikTok si riapre la Palestra. Disattiva l'automazione quando non ti serve.</li>
      <li><b>Fasce orarie (studio, notte)</b>: <b>Impostazioni → Tempo di utilizzo → Tempo di inattività</b> → Programmato, con gli orari che vuoi. Fuori dalle app consentite tutto resta bloccato.</li>
      <li><b>Limite giornaliero</b>: <b>Tempo di utilizzo → Limitazioni app</b> → Social → per esempio 30 min.</li>
    </ol></section>
    <button class="secondario" data-a="reset">Cancella tutti i dati</button>`;
}

// ---------- Dialogo sostituzione ----------

let doveCambio = null; // { tipo: "attiva", i } oppure { tipo: "scheda", codice, i }
function apriSostituzione(i, codice) {
  doveCambio = codice ? { tipo: "scheda", codice, i } : { tipo: "attiva", i };
  const v = codice ? S.schede[codice].righe[i] : S.attiva.voci[i];
  const g = gruppo(v.ex);
  const alt = tuttiEsercizi().filter(e => e.gruppo === g && e.nome !== v.ex);
  const d = $("#dialogo");
  d.innerHTML = `<h2>Sostituisci ${esc(v.ex)}</h2><p class="nota">${GRUPPI[g] || ""} · stesse serie e ripetizioni</p>
    ${codice ? "" : `<label class="pulita"><input type="checkbox" id="sempre"> Cambia anche nella scheda (per sempre)</label>`}
    <div class="lista">${alt.map(e => `<button data-a="scegli" data-i="${i}" data-v="${esc(e.nome)}">${esc(e.nome)}<small>${ATTREZZI[e.eq].nome}</small></button>`).join("")}</div>
    <h3>Crea esercizio</h3>
    <input id="nuovo-nome" placeholder="Nome esercizio">
    <select id="nuovo-gruppo">${Object.entries(GRUPPI).map(([k, n]) => `<option value="${k}" ${k === g ? "selected" : ""}>${n}</option>`).join("")}</select>
    <select id="nuovo-eq">${Object.entries(ATTREZZI).map(([k, a]) => `<option value="${k}">${a.nome}</option>`).join("")}</select>
    <button class="grande" data-a="crea" data-i="${i}">Crea e usa</button>
    <button class="secondario" data-a="chiudi">Chiudi</button>`;
  d.showModal();
}

function sostituisci(i, nome) {
  if (doveCambio?.tipo === "scheda") {
    S.schede[doveCambio.codice].righe[i].ex = nome;
    salva(); $("#dialogo").close(); return disegna();
  }
  const a = S.attiva, v = a.voci[i];
  if ($("#sempre")?.checked) {
    const riga = S.schede[a.codice].righe.find(r => r.ex === v.ex);
    if (riga) riga.ex = nome;
  }
  const nuova = creaVoce({ ex: nome, serie: v.serie, min: v.min, max: v.max, recMin: v.recMin, recMax: v.recMax, ss: v.ss, drop: v.drop }, a.scarico);
  a.voci[i] = nuova;
  salva(); $("#dialogo").close(); disegna();
}

// ---------- Eventi ----------

document.addEventListener("click", e => {
  const b = e.target.closest("[data-a], .tab button");
  if (!b) return;
  if (b.dataset.tab) return vai(S.attiva && b.dataset.tab === "oggi" ? "allenamento" : b.dataset.tab);
  const a = b.dataset.a, v = b.dataset.v, i = +b.dataset.i, j = +b.dataset.j;
  switch (a) {
    case "inizia": sbloccaAudio(); return inizia(v);
    case "riprendi": sbloccaAudio(); tieniSchermoAcceso(); return vai("allenamento");
    case "vai": return vai(v);
    case "fine": return fine();
    case "annulla":
      if (confirm("Annullare l'allenamento? Le serie di oggi non verranno salvate.")) { S.attiva = null; S.timerFine = null; salva(); vai("oggi"); }
      return;
    case "spunta": {
      sbloccaAudio();
      const voce = S.attiva.voci[i], x = voce.sets[j];
      x.fatto = !x.fatto;
      if (x.fatto) {
        const succ = S.attiva.voci[i + 1];
        if (voce.ss && succ?.ss === voce.ss) S.timerFine = null; // superserie: subito il prossimo esercizio
        else avviaTimer(voce.recMax);
      }
      salva(); disegna(); return;
    }
    case "timer-piu": S.timerFine += +v * 1000; salva(); return disegnaTimer();
    case "timer-chiudi": S.timerFine = null; salva(); return disegnaTimer();
    case "sostituisci": return apriSostituzione(+v);
    case "sostituisci-scheda": return apriSostituzione(i, v);
    case "scegli": return sostituisci(i, v);
    case "crea": {
      const nome = $("#nuovo-nome").value.trim();
      if (!nome) return;
      if (!tuttiEsercizi().some(x => x.nome === nome)) S.esercizi.push({ nome, gruppo: $("#nuovo-gruppo").value, eq: $("#nuovo-eq").value });
      return sostituisci(i, nome);
    }
    case "chiudi": return $("#dialogo").close();
    case "cal-base": S.calendario = { ...CALENDARIO_BASE }; salva(); return disegna();
    case "cal-alt": S.calendario = { ...CALENDARIO_ALT }; salva(); return disegna();
    case "elimina":
      if (confirm("Eliminare questo allenamento dallo storico?")) { S.sedute = S.sedute.filter(s => s.id !== +v); salva(); disegna(); }
      return;
    case "esporta": {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
      const f = new File([blob], `palestra-backup-${isoData(new Date())}.json`, { type: "application/json" });
      if (navigator.canShare?.({ files: [f] })) navigator.share({ files: [f] }).catch(() => {});
      else { const l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = f.name; l.click(); }
      return;
    }
    case "salva-chiave":
      try { localStorage.setItem("palestra-api-key", $("#chiave").value.trim()); } catch {}
      alert("Chiave salvata solo su questo telefono."); return disegna();
    case "reset":
      if (confirm("Cancellare TUTTI i dati? Non si può annullare.")) { S = statoIniziale(); salva(); vai("oggi"); }
      return;
    default: window.azioneCibo?.(a, b); window.azioneExtra?.(a, b);
  }
});

document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.k && S.attiva) {
    S.attiva.voci[+t.dataset.i].sets[+t.dataset.j][t.dataset.k] = t.value.replace(",", ".");
    salva();
  }
});

document.addEventListener("change", e => {
  const t = e.target, a = t.dataset.a;
  if (a === "cal") { S.calendario[t.dataset.v] = t.value || null; salva(); }
  if (a === "pulita") { S.attiva.voci[+t.dataset.v].pulita = t.checked; salva(); }
  if (a === "inizio" && t.value) { S.inizio = isoData(lunedi(new Date(t.value + "T12:00"))); salva(); disegna(); }
  if (a === "storico-es") { param = t.value; disegna(); }
  window.cambioCibo?.(t); window.cambioExtra?.(t);
  if (a === "importa" && t.files[0]) {
    t.files[0].text().then(txt => {
      const d = JSON.parse(txt);
      if (!d.sedute || !d.schede) throw new Error();
      S = d; salva(); alert("Backup caricato."); vai("oggi");
    }).catch(() => alert("File non valido."));
  }
});

// Quando torni nell'app il timer si aggiorna (il tempo è calcolato dall'ora di fine).
document.addEventListener("visibilitychange", () => { if (!document.hidden) { disegnaTimer(); tieniSchermoAcceso(); } });

function avvia() {
  window.avviaSync?.();
  vai(S.attiva ? "allenamento" : "oggi");
  if (S.attiva) tieniSchermoAcceso();
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
