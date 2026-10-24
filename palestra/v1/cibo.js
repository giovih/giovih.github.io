// Conta cibo con foto (stima AI), acqua, creatina e peso corporeo.
"use strict";

const PASTI = [
  ["colazione", "Colazione", ""],
  ["spuntino", "Spuntino a scuola", ""],
  ["pranzo", "Pranzo · pre-allenamento (1-1,5 h prima)", ""],
  ["merenda", "Merenda · post-allenamento", ""],
  ["cena", "Cena", ""],
  ["notte", "Prima di dormire", ""]
];

// Crea i campi del cibo se mancano (anche dopo "cancella dati" o un backup vecchio).
function initCibo() {
  S.cibo ||= {};
  S.peso ||= [{ data: isoData(new Date()), kg: 56.1 }];
  S.obiettivi ||= { kcalMin: 3000, kcalMax: 3300, prot: 120, carb: 400, grassi: 85 };
}

let giornoCibo = isoData(new Date());
let bozza = null; // pasto in preparazione nel dialogo

function giornata(g = giornoCibo) {
  initCibo();
  S.cibo[g] ||= { pasti: {}, acqua: 0, creatina: false };
  return S.cibo[g];
}
function totali(g) {
  const t = { kcal: 0, prot: 0, carb: 0, grassi: 0 };
  Object.values(giornata(g).pasti).flat().forEach(x => { for (const k in t) t[k] += x[k] || 0; });
  return t;
}
function barra(nome, val, obiettivo, unita, colore, testoObiettivo) {
  const pct = Math.min(100, Math.round(val / obiettivo * 100));
  return `<div class="macro"><div class="ba-riga piccola"><span><b style="color:var(--testo)">${nome}</b></span>
    <span>${unita === "L" ? kgTxt(val) : Math.round(val)} / ${testoObiettivo ?? obiettivo} ${unita}</span></div>
    <div class="progresso"><div style="width:${pct}%;background:${colore}"></div></div></div>`;
}

/** Consigli sulle calorie in base al peso settimanale. */
function consiglioPeso() {
  initCibo();
  const p = [...S.peso].sort((a, b) => a.data.localeCompare(b.data));
  if (p.length < 3) return "Pesati una volta a settimana, al mattino a digiuno. Obiettivo: +0,25-0,5 kg a settimana.";
  const [a, b, c] = p.slice(-3);
  if (c.kg - a.kg <= 0) return "Da 2 settimane non sali di peso: aggiungi <b>+250 kcal al giorno</b>.";
  if (b.kg - a.kg > 0.7 && c.kg - b.kg > 0.7) return "Sali più di 0,7 kg a settimana da più settimane: togli <b>200 kcal al giorno</b>.";
  return "Stai salendo bene. Continua così.";
}

function graficoPeso() {
  const p = [...S.peso].sort((a, b) => a.data.localeCompare(b.data)).map(x => ({ kg: x.kg }));
  return grafico(p, "kg", "#34D399", "Peso corporeo (kg)");
}

function cibo() {
  initCibo();
  const g = giornata(), t = totali(giornoCibo), o = S.obiettivi;
  const oggiIso = isoData(new Date());
  const titolo = giornoCibo === oggiIso ? "Oggi" : dataTxt(giornoCibo + "T12:00");
  let h = `<header class="testa"><h1>Cibo</h1></header>
    <div class="nav-giorno"><button data-a="giorno" data-v="-1">‹</button><b>${titolo}</b>
      <button data-a="giorno" data-v="1" ${giornoCibo >= oggiIso ? "disabled" : ""}>›</button></div>
    <section class="card pad">
      ${barra("Calorie", t.kcal, o.kcalMax, "kcal", "#F97316", `${o.kcalMin}-${o.kcalMax}`)}
      ${barra("Proteine", t.prot, o.prot, "g", "#60A5FA", `≥${o.prot}`)}
      ${barra("Carboidrati", t.carb, o.carb, "g", "#FACC15")}
      ${barra("Grassi", t.grassi, o.grassi, "g", "#A78BFA")}
    </section>
    <section class="card pad">
      ${barra("Acqua", g.acqua / 1000, 3, "L", "#38BDF8", "2-3")}
      <div class="scelte"><button data-a="acqua" data-v="-250">−</button><button data-a="acqua" data-v="250">+ 250 ml</button><button data-a="acqua" data-v="500">+ 500 ml</button></div>
      <button class="creatina ${g.creatina ? "presa" : ""}" data-a="creatina">${g.creatina ? "Creatina 5 g presa" : "Creatina 5 g — tocca quando la prendi"}</button>
    </section>`;

  for (const [k, nome, icona] of PASTI) {
    const lista = g.pasti[k] || [];
    const kcal = lista.reduce((s, x) => s + (x.kcal || 0), 0);
    h += `<section class="card"><div class="card-testa"><h2 class="pasto">${icona} ${nome}</h2><span>${kcal ? kcal + " kcal" : ""}</span></div>
      ${lista.map((x, i) => `<div class="cibo-riga" data-a="togli-cibo" data-v="${k}" data-i="${i}">
        ${x.foto ? `<img src="${x.foto}" alt="">` : `<div class="noimg"></div>`}
        <div><div>${esc(x.desc || "Pasto")}</div><small>${x.kcal} kcal · P ${x.prot} · C ${x.carb} · G ${x.grassi}</small></div></div>`).join("")}
      <button class="aggiungi" data-a="nuovo-cibo" data-v="${k}">+ Aggiungi</button></section>`;
  }

  h += `<button class="secondario" style="color:var(--grigio)" data-a="vai" data-v="progressi">Peso corporeo e foto → Progressi</button>`;
  return h;
}

// ---------- Dialogo aggiunta pasto ----------

function apriNuovoCibo(pasto) {
  bozza = { pasto, fotoAI: null, foto: null };
  const nome = PASTI.find(p => p[0] === pasto)[1];
  const d = $("#dialogo");
  d.innerHTML = `<h2>${nome}</h2>
    <div class="scelte" style="padding:10px 0">
      <label class="bottone">Scatta<input type="file" accept="image/*" capture="environment" data-a="foto-cibo" hidden></label>
      <label class="bottone">Libreria<input type="file" accept="image/*" data-a="foto-cibo" hidden></label>
    </div>
    <img id="anteprima" class="anteprima nascosto" alt="">
    <textarea id="desc-cibo" class="campo" rows="3" placeholder="Es. 110 g di pasta con 80 g di pollo, 1 cucchiaio d'olio"></textarea>
    <button class="grande" data-a="stima">Stima con AI</button>
    <div id="esito" class="nota"></div>
    <div class="macro-campi">
      <label>kcal<input id="m-kcal" inputmode="numeric"></label>
      <label>Proteine g<input id="m-prot" inputmode="numeric"></label>
      <label>Carboidrati g<input id="m-carb" inputmode="numeric"></label>
      <label>Grassi g<input id="m-grassi" inputmode="numeric"></label>
    </div>
    <button class="grande verde" data-a="salva-cibo">Salva</button>
    <button class="secondario" data-a="chiudi">Annulla</button>`;
  d.showModal();
}

/** Riduce la foto: una media per l'AI e una piccolina da salvare. */
function leggiFoto(file) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const fai = lato => {
        const s = Math.min(1, lato / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.8);
      };
      ok({ ai: fai(1024), mini: fai(160) });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = ko;
    img.src = URL.createObjectURL(file);
  });
}

const SCHEMA_CIBO = {
  type: "object",
  additionalProperties: false,
  required: ["descrizione", "kcal", "kcal_min", "kcal_max", "proteine", "carboidrati", "grassi", "note"],
  properties: {
    descrizione: { type: "string" },
    kcal: { type: "integer" }, kcal_min: { type: "integer" }, kcal_max: { type: "integer" },
    proteine: { type: "integer" }, carboidrati: { type: "integer" }, grassi: { type: "integer" },
    note: { type: "string" }
  }
};

/** La stima con AI ora è solo nella nuova app: la chiave dell'AI sta sul server, non sul telefono. */
async function stima() {
  $("#esito").innerHTML = "La stima con AI ora è nella nuova app: torna alla nuova versione e usa <b>Cibo, Foto AI</b>.";
}

// ---------- Eventi (chiamati da app.js) ----------

function azioneCibo(a, b) {
  const v = b.dataset.v, g = giornata();
  switch (a) {
    case "giorno": {
      const d = new Date(giornoCibo + "T12:00"); d.setDate(d.getDate() + +v);
      giornoCibo = isoData(d); return disegna();
    }
    case "acqua": g.acqua = Math.max(0, g.acqua + +v); salva(); return disegna();
    case "creatina": g.creatina = !g.creatina; salva(); return disegna();
    case "nuovo-cibo": return apriNuovoCibo(v);
    case "stima": return stima();
    case "salva-cibo": {
      const n = id => Math.round(num($(id).value.replace(",", ".")) || 0);
      const voce = { desc: $("#desc-cibo").value.trim(), foto: bozza.foto,
        kcal: n("#m-kcal"), prot: n("#m-prot"), carb: n("#m-carb"), grassi: n("#m-grassi") };
      if (!voce.kcal && !voce.prot) { $("#esito").textContent = "Inserisci almeno le calorie (o usa la stima AI)."; return; }
      (g.pasti[bozza.pasto] ||= []).push(voce);
      salva(); $("#dialogo").close(); return disegna();
    }
    case "togli-cibo":
      if (confirm("Eliminare questo cibo?")) { g.pasti[v].splice(+b.dataset.i, 1); salva(); disegna(); }
      return;
    case "salva-peso": {
      const kg = num($("#peso").value.replace(",", "."));
      if (!kg || kg < 30 || kg > 150) return alert("Scrivi il peso in kg, es. 56,4");
      const oggiIso = isoData(new Date());
      S.peso = S.peso.filter(x => x.data !== oggiIso).concat({ data: oggiIso, kg });
      salva(); return disegna();
    }
  }
}

function cambioCibo(t) {
  if (t.dataset.a === "foto-cibo" && t.files[0]) {
    leggiFoto(t.files[0]).then(f => {
      bozza.fotoAI = f.ai; bozza.foto = f.mini;
      const img = $("#anteprima"); img.src = f.ai; img.classList.remove("nascosto");
    }).catch(() => alert("Non riesco a leggere la foto."));
  }
}
