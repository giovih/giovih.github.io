// Il "cervello" dell'app: dato il meteo di un giorno e i capi puliti dell'armadio,
// trova le combinazioni migliori. Niente DOM qui dentro: si prova anche con node.

export const CATEGORIE = [
  { id: "sopra",      nome: "Maglie e camicie",  uno: "Maglia",     icona: "👕", usi: 1 },
  { id: "strato",     nome: "Maglioni e felpe",  uno: "Maglione",   icona: "🧶", usi: 3 },
  { id: "sotto",      nome: "Pantaloni e gonne", uno: "Pantaloni",  icona: "👖", usi: 3 },
  { id: "intero",     nome: "Vestiti interi",    uno: "Vestito",    icona: "👗", usi: 1 },
  { id: "capospalla", nome: "Giacche e cappotti", uno: "Giacca",    icona: "🧥", usi: 15 },
  { id: "scarpe",     nome: "Scarpe",            uno: "Scarpe",     icona: "👟", usi: 0 }
];
export const categoria = id => CATEGORIE.find(c => c.id === id);

export const CALORE = ["", "Leggerissimo", "Leggero", "Medio", "Caldo", "Molto caldo"];
export const STILI = [
  { id: "casual",   nome: "Casual" },
  { id: "elegante", nome: "Elegante" },
  { id: "sportivo", nome: "Sportivo" }
];

// Ordine in cui i pezzi si mostrano nella card del giorno.
export const ORDINE = ["capospalla", "strato", "sopra", "intero", "sotto", "scarpe"];

// ---------- meteo → di cosa c'è bisogno ----------

// Temperatura "da vestirsi": conta di più il pomeriggio, ma la mattina presto si esce col fresco.
export function bisogni(meteo, freddoloso = 0) {
  const min = (meteo.percMin ?? meteo.tMin) - freddoloso * 1.5;
  const max = (meteo.percMax ?? meteo.tMax) - freddoloso * 1.5;
  const t = (min + 2 * max) / 3;
  const pioggia = (meteo.pioggiaProb ?? 0) >= 50 || (meteo.pioggiaMm ?? 0) >= 2;
  return {
    t, min, max, pioggia,
    caloreSopra: clamp((29 - t) / 2, 1, 13),       // somma di maglia + maglione + giacca
    caloreSotto: clamp((34 - t) / 5, 1, 5),       // 29° pantaloncini, 19° jeans, 9° lana
    caloreGiacca: clamp((24 - min) / 4, 1, 5),     // la giacca si sceglie sul fresco del mattino
    giacca: min < 14 || pioggia ? "serve" : max >= 25 ? "no" : "forse",
    strato: t < 20
  };
}

// ---------- colori ----------

export function hsl(hex) {
  const n = parseInt((hex || "#808080").slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

// Neri, bianchi, grigi, beige e i blu del jeans stanno con tutto.
export function neutro(hex) {
  const { h, s, l } = hsl(hex);
  if (l < .16 || l > .9 || s < .2) return true;
  if (h >= 25 && h <= 50 && s < .45 && l > .55) return true;   // beige, cammello chiaro
  if (h >= 200 && h <= 235 && s < .5 && l < .5) return true;    // denim, blu navy
  return false;
}

const NOMI_COLORE = [
  [0, "rosso"], [18, "arancione"], [42, "giallo"], [70, "verde oliva"], [95, "verde"],
  [165, "turchese"], [195, "azzurro"], [220, "blu"], [255, "viola"], [290, "fucsia"], [330, "rosa"], [350, "rosso"]
];
export function nomeColore(hex) {
  const { h, s, l } = hsl(hex);
  if (l < .14) return "nero";
  if (l > .9) return "bianco";
  if (s < .14) return l < .4 ? "grigio scuro" : "grigio";
  if (h >= 18 && h < 45 && l < .4) return "marrone";
  if (h >= 25 && h < 50 && s < .45 && l > .55) return "beige";
  if (h >= 200 && h <= 235 && l < .3) return "blu scuro";
  let nome = "rosso";
  for (const [da, n] of NOMI_COLORE) if (h >= da) nome = n;
  if (nome === "rosso" && l > .7) return "rosa";
  return nome;
}

function distanzaTinta(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Penalità per i colori che stanno male insieme.
export function penalitaColori(colori) {
  const accesi = colori.filter(c => c && !neutro(c)).map(c => hsl(c).h);
  let p = 0;
  if (accesi.length > 2) p += 3 * (accesi.length - 2);
  for (let i = 0; i < accesi.length; i++) {
    for (let j = i + 1; j < accesi.length; j++) {
      const d = distanzaTinta(accesi[i], accesi[j]);
      // stessa famiglia (< 30°) o complementari (> 150°) vanno bene; in mezzo stonano
      if (d >= 30 && d <= 150) p += 2.5;
    }
  }
  return p;
}

// ---------- punteggio ----------

const GIORNO = 86400000;
const giorniDa = (data, oggi) => data ? Math.round((new Date(oggi) - new Date(data)) / GIORNO) : 99;

// Quanto pesa rimettere lo stesso capo due volte nella stessa settimana.
const RIPETIZIONE = { sopra: 9, intero: 9, strato: 2.5, sotto: 2, capospalla: 0, scarpe: .6 };

// Penalità di un capo da solo (serve a scegliere i candidati migliori per ogni categoria).
function penalitaCapo(c, b, ctx) {
  let p = 0;
  const cal = c.calore || 3;
  if (c.categoria === "sotto" || c.categoria === "scarpe") p += (cal - b.caloreSotto) ** 2 * (c.categoria === "sotto" ? 1.5 : .5);
  if (c.categoria === "intero") p += (cal - b.caloreSotto) ** 2;
  if (c.categoria === "capospalla") p += (cal - b.caloreGiacca) ** 2 * 1.2;
  if (b.pioggia && (c.categoria === "capospalla" || c.categoria === "scarpe") && !c.impermeabile) p += c.categoria === "capospalla" ? 6 : 3;
  const fa = giorniDa(c.ultimoUso, ctx.data);
  if (fa >= 0 && fa < 2) p += 3; else if (fa >= 0 && fa < 5) p += 1;
  p += (ctx.usati.get(c.id) || 0) * (RIPETIZIONE[c.categoria] ?? 1);
  if (ctx.stile && c.stile && c.stile !== ctx.stile) p += 1.5;
  if (c.preferito) p -= .5;
  return p;
}

export function valuta(outfit, meteo, ctx) {
  const b = bisogni(meteo, ctx.freddoloso || 0);
  const pezzi = Object.values(outfit).filter(Boolean);
  let p = 0;
  for (const c of pezzi) p += penalitaCapo(c, b, ctx);

  const sopra = (outfit.sopra?.calore || 0) + (outfit.intero?.calore || 0) + (outfit.strato?.calore || 0) + (outfit.capospalla?.calore || 0);
  p += (sopra - b.caloreSopra) ** 2;

  if (outfit.capospalla && b.giacca === "no") p += 6;
  if (!outfit.capospalla && b.giacca === "serve") p += b.pioggia ? 10 : 6;
  if (outfit.strato && !b.strato) p += 5;

  const stili = new Set(pezzi.map(c => c.stile).filter(Boolean));
  if (stili.has("elegante") && stili.has("sportivo")) p += 4;

  p += penalitaColori(pezzi.map(c => c.colore));
  return p;
}

// ---------- ricerca delle combinazioni ----------

const CANDIDATI = 7;

function migliori(capi, cat, b, ctx) {
  return capi.filter(c => c.categoria === cat)
    .map(c => [penalitaCapo(c, b, ctx), c])
    .sort((x, y) => x[0] - y[0])
    .slice(0, CANDIDATI)
    .map(x => x[1]);
}

// Restituisce le combinazioni ordinate dalla migliore, tutte diverse tra loro
// in almeno due pezzi (così "altro outfit" propone davvero qualcosa di nuovo).
export function proponi(capi, meteo, ctx = {}) {
  ctx = { usati: new Map(), esclusi: [], data: new Date().toISOString().slice(0, 10), ...ctx };
  const b = bisogni(meteo, ctx.freddoloso || 0);
  const ok = capi.filter(c => c.categoria && c.stato !== "sporco" && !ctx.esclusi.includes(c.id));

  const sopra = migliori(ok, "sopra", b, ctx);
  const sotto = migliori(ok, "sotto", b, ctx);
  const interi = migliori(ok, "intero", b, ctx);
  const strati = [null, ...migliori(ok, "strato", b, ctx)];
  const giacche = [null, ...migliori(ok, "capospalla", b, ctx)];
  const piedi = migliori(ok, "scarpe", b, ctx);

  const basi = [];
  for (const s of sopra) for (const g of sotto) basi.push({ sopra: s, sotto: g });
  for (const v of interi) basi.push({ intero: v });

  const tutte = [];
  for (const base of basi)
    for (const st of strati)
      for (const gi of giacche)
        for (const sc of piedi) {
          const o = { ...base, strato: st, capospalla: gi, scarpe: sc };
          tutte.push({ outfit: o, punti: valuta(o, meteo, ctx) });
        }
  tutte.sort((x, y) => x.punti - y.punti);

  const scelte = [];
  for (const t of tutte) {
    const ids = idsDi(t.outfit);
    if (scelte.every(s => differenza(s.ids, ids) >= 2)) scelte.push({ ...t, ids });
    if (scelte.length >= 12) break;
  }
  return scelte;
}

export const idsDi = o => ORDINE.map(k => o[k]?.id).filter(Boolean);
function differenza(a, b) {
  const sa = new Set(a);
  return b.filter(x => !sa.has(x)).length + a.filter(x => !b.includes(x)).length / 2;
}

// Cosa manca nell'armadio per poter proporre un outfit.
export function mancanze(capi) {
  const puliti = capi.filter(c => c.categoria && c.stato !== "sporco");
  const ha = cat => puliti.some(c => c.categoria === cat);
  const m = [];
  if (!(ha("sopra") && ha("sotto")) && !ha("intero")) m.push("almeno una maglia e un paio di pantaloni (o un vestito intero)");
  if (!ha("scarpe")) m.push("un paio di scarpe");
  return m;
}

// Due righe per spiegare perché ha scelto così.
export function spiegazione(meteo, freddoloso = 0) {
  const b = bisogni(meteo, freddoloso);
  const parti = [];
  if (b.t >= 26) parti.push("Fa caldo: capi leggeri e traspiranti");
  else if (b.t >= 20) parti.push("Temperatura piacevole");
  else if (b.t >= 14) parti.push("Fresco: meglio avere uno strato in più");
  else if (b.t >= 7) parti.push("Freddo: vestiti a strati");
  else parti.push("Molto freddo: copriti bene");
  if (b.min < 12 && b.max >= 20) parti.push("la mattina è fresca");
  if (b.pioggia) parti.push("porta qualcosa contro la pioggia");
  return parti.join(", ") + ".";
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
