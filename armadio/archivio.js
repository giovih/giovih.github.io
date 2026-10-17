import { disegnaCapo } from "./disegno.js";

// L'armadio vive nel telefono (IndexedDB): le foto restano qui e funzionano anche offline.

const DB = "armadio";
let db;

function apri() {
  if (db) return Promise.resolve(db);
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("capi", { keyPath: "id" });
    r.onsuccess = () => { db = r.result; ok(db); };
    r.onerror = () => ko(r.error);
  });
}

function richiesta(modo, fn) {
  return apri().then(d => new Promise((ok, ko) => {
    const tx = d.transaction("capi", modo);
    const r = fn(tx.objectStore("capi"));
    tx.oncomplete = () => ok(r?.result);
    tx.onerror = () => ko(tx.error);
  }));
}

export const tutti = () => richiesta("readonly", s => s.getAll());
export const salva = capo => richiesta("readwrite", s => s.put(capo));
export const elimina = id => richiesta("readwrite", s => s.delete(id));
export const salvaTanti = capi => richiesta("readwrite", s => { capi.forEach(c => s.put(c)); });

export const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- foto ----------

function leggiImmagine(file) {
  return new Promise((ok, ko) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Questa foto non si apre")); };
    img.src = url;
  });
}

// Rimpicciolisce la foto (così l'armadio non riempie il telefono) e ne indovina il colore.
export async function preparaFoto(file, lato = 900) {
  const img = await leggiImmagine(file);
  const k = Math.min(1, lato / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), hh = Math.round(img.naturalHeight * k);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = hh;
  const cx = cv.getContext("2d");
  cx.drawImage(img, 0, 0, w, hh);
  const foto = await new Promise(ok => cv.toBlob(ok, "image/jpeg", .82));
  try {
    const { disegno, colore } = await disegnaCapo(cv);
    return { foto, disegno, colore: colore || coloreDominante(cx, w, hh) };
  } catch {
    return { foto, disegno: null, colore: coloreDominante(cx, w, hh) };
  }
}

// Il disegno per i capi fotografati prima che esistesse.
export async function disegnoDi(foto) {
  const img = await leggiImmagine(foto);
  return disegnaCapo(img);
}

// Il colore del capo: si scarta lo sfondo (il colore dei bordi) e si prende il più frequente al centro.
function coloreDominante(cx, w, h) {
  const { data } = cx.getImageData(0, 0, w, h);
  const px = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const bordo = [0, 0, 0]; let nb = 0;
  for (let x = 0; x < w; x += 4) for (const y of [0, h - 1]) { const p = px(x, y); bordo[0] += p[0]; bordo[1] += p[1]; bordo[2] += p[2]; nb++; }
  for (let y = 0; y < h; y += 4) for (const x of [0, w - 1]) { const p = px(x, y); bordo[0] += p[0]; bordo[1] += p[1]; bordo[2] += p[2]; nb++; }
  bordo.forEach((v, i) => bordo[i] = v / nb);

  const secchi = new Map();
  const passo = Math.max(2, Math.round(Math.min(w, h) / 120));
  for (let y = Math.round(h * .2); y < h * .8; y += passo) {
    for (let x = Math.round(w * .2); x < w * .8; x += passo) {
      const p = px(x, y);
      const d = Math.hypot(p[0] - bordo[0], p[1] - bordo[1], p[2] - bordo[2]);
      if (d < 45) continue;
      const k = (p[0] >> 5) << 6 | (p[1] >> 5) << 3 | (p[2] >> 5);
      const s = secchi.get(k) || [0, 0, 0, 0];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      secchi.set(k, s);
    }
  }
  let meglio = null;
  for (const s of secchi.values()) if (!meglio || s[3] > meglio[3]) meglio = s;
  const rgb = meglio ? meglio.slice(0, 3).map(v => v / meglio[3]) : bordo;
  return "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

// ---------- copia di sicurezza ----------

const aBase64 = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
const daBase64 = url => fetch(url).then(r => r.blob());

export async function esporta(extra) {
  const capi = await tutti();
  const lista = [];
  for (const c of capi) lista.push({ ...c, foto: c.foto ? await aBase64(c.foto) : null, disegno: c.disegno ? await aBase64(c.disegno) : null });
  return new Blob([JSON.stringify({ app: "armadio", versione: 1, capi: lista, ...extra })], { type: "application/json" });
}

export async function importa(file) {
  const j = JSON.parse(await file.text());
  if (j.app !== "armadio" || !Array.isArray(j.capi)) throw new Error("Questo file non è una copia dell'armadio");
  const capi = [];
  for (const c of j.capi) capi.push({ ...c, foto: c.foto ? await daBase64(c.foto) : null, disegno: c.disegno ? await daBase64(c.disegno) : null });
  await salvaTanti(capi);
  return j;
}
