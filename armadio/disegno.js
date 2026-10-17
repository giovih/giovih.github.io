// Trasforma la foto di un capo in un disegno stile cartone: stesso capo, stessa forma e stessi
// colori, ma senza lo sfondo, con colori pieni e il contorno ripassato.
// Lavora tutto sul telefono, su un canvas: niente internet.

export const VERSIONE_DISEGNO = 1;
const LATO = 420;

const dist = (d, i, r, g, b) => Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);

// Operazioni sulla maschera del capo (1 = capo): allarga/restringe di r pixel con somme cumulative.
function morfologia(m, w, h, r, allarga) {
  const passa = (src, lungo, corto, idx) => {
    const out = new Uint8Array(src.length), somma = new Int32Array(lungo + 1);
    for (let j = 0; j < corto; j++) {
      for (let i = 0; i < lungo; i++) somma[i + 1] = somma[i] + src[idx(i, j)];
      for (let i = 0; i < lungo; i++) {
        const a = Math.max(0, i - r), b = Math.min(lungo, i + r + 1), s = somma[b] - somma[a];
        out[idx(i, j)] = allarga ? (s > 0 ? 1 : 0) : (s === b - a ? 1 : 0);
      }
    }
    return out;
  };
  const o = passa(m, w, h, (i, j) => j * w + i);
  return passa(o, h, w, (i, j) => i * w + j);
}

// Tiene solo il pezzo connesso più grande; con "buchi" riempie ciò che non tocca il bordo.
function piuGrande(m, w, h) {
  const n = w * h, et = new Int32Array(n), coda = new Int32Array(n);
  let meglio = 0, quanti = 0, id = 0;
  for (let s = 0; s < n; s++) {
    if (!m[s] || et[s]) continue;
    id++; let c = 0, t = 0, f = 0; coda[f++] = s; et[s] = id;
    while (t < f) {
      const p = coda[t++], x = p % w; c++;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= n || !m[q] || et[q]) continue;
        et[q] = id; coda[f++] = q;
      }
    }
    if (c > quanti) { quanti = c; meglio = id; }
  }
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p++) out[p] = et[p] === meglio ? 1 : 0;
  return { out, quanti };
}
function riempiBuchi(m, w, h) {
  const n = w * h, fuori = new Uint8Array(n), coda = new Int32Array(n);
  let t = 0, f = 0;
  const semina = p => { if (!m[p] && !fuori[p]) { fuori[p] = 1; coda[f++] = p; } };
  for (let x = 0; x < w; x++) { semina(x); semina((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semina(y * w); semina(y * w + w - 1); }
  while (t < f) {
    const p = coda[t++], x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
      if (q >= 0 && q < n && !m[q] && !fuori[q]) { fuori[q] = 1; coda[f++] = q; }
  }
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p++) out[p] = fuori[p] ? 0 : 1;
  return out;
}

// Un'ombra (o una zona più illuminata) è lo sfondo con la stessa tinta ma più scuro o più chiaro.
function ombraDi(d, j, bg) {
  const a = d[j] / (bg[0] + 1), b = d[j + 1] / (bg[1] + 1), c = d[j + 2] / (bg[2] + 1);
  const mx = Math.max(a, b, c), mn = Math.min(a, b, c);
  return mn > .35 && mx < 1.3 && mx - mn < .07 * Math.max(1, mx);
}

// Lo sfondo è ciò che si raggiunge dai bordi della foto passando per colori molto vicini tra loro
// e simili al colore tipico del bordo (pavimento, letto, muro…). Si lavora sull'immagine già
// sfocata, così la grana della foto non apre "varchi" dentro il capo.
function scontorna(d, w, h, passo = 9) {
  const n = w * h;
  const bordo = [];
  for (let x = 0; x < w; x++) bordo.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) bordo.push(y * w, y * w + w - 1);
  const mediana = k => { const v = bordo.map(p => d[p * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [mediana(0), mediana(1), mediana(2)];

  const sfondo = new Uint8Array(n), coda = new Int32Array(n);
  let testa = 0, fine = 0;
  for (const p of bordo) if (!sfondo[p] && dist(d, p * 4, ...bg) < 90) { sfondo[p] = 1; coda[fine++] = p; }
  while (testa < fine) {
    const p = coda[testa++], x = p % w, i = p * 4;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q < 0 || q >= n || sfondo[q]) continue;
      const j = q * 4;
      if (dist(d, j, d[i], d[i + 1], d[i + 2]) < passo && (dist(d, j, ...bg) < 110 || ombraDi(d, j, bg))) { sfondo[q] = 1; coda[fine++] = q; }
    }
  }
  let capo = new Uint8Array(n);
  for (let p = 0; p < n; p++) capo[p] = sfondo[p] ? 0 : 1;

  const r = Math.max(2, Math.round(Math.max(w, h) * .017));
  capo = morfologia(morfologia(capo, w, h, 1, false), w, h, 1, true);        // via righe sottili (fughe del parquet)
  capo = piuGrande(capo, w, h).out;
  capo = morfologia(morfologia(capo, w, h, r, true), w, h, r, false);        // richiude i pezzi del capo simili allo sfondo
  capo = riempiBuchi(capo, w, h);
  // la chiusura riempie anche le fessure tra manica e corpo: lì è ombra sul pavimento, si rimette sfondo
  // (solo le zone d'ombra collegate all'esterno: le righe chiare in ombra dentro il capo restano)
  const ombra = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!capo[p] || !sfondo[p]) continue;
    const j = p * 4;
    if (ombraDi(d, j, bg) && d[j] + d[j + 1] + d[j + 2] < (bg[0] + bg[1] + bg[2]) * .97) ombra[p] = 1;
  }
  testa = 0; fine = 0;
  for (let p = 0; p < n; p++) if (!capo[p]) coda[fine++] = p;
  while (testa < fine) {
    const p = coda[testa++], x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
      if (q >= 0 && q < n && capo[q] && ombra[q]) { capo[q] = 0; coda[fine++] = q; }
  }
  const { out, quanti } = piuGrande(capo, w, h);

  // se lo scontorno non convince si tiene tutta la foto (meglio la foto intera che un capo a pezzi)
  const parte = quanti / n;
  return { capo: out, riuscito: parte >= 0.06 && parte <= 0.92 };
}

// Sfoca un po' (passate di media 5×5) per avere colori puliti da appiattire.
function sfoca(d, w, h, passi = 2) {
  let a = Float32Array.from(d), b = new Float32Array(d.length);
  for (let passo = 0; passo < passi; passo++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bl = 0, c = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const i = (yy * w + xx) * 4; r += a[i]; g += a[i + 1]; bl += a[i + 2]; c++;
        }
      }
      const i = (y * w + x) * 4; b[i] = r / c; b[i + 1] = g / c; b[i + 2] = bl / c;
    }
    [a, b] = [b, a];
  }
  return a;
}

// Come sfoca, ma media solo i vicini di colore simile: pieghe e grana spariscono,
// righe, stampe e cuciture restano nette.
function liscia(d, w, h, passi = 3, soglia = 70) {
  let a = Float32Array.from(d), b = new Float32Array(d.length);
  for (let passo = 0; passo < passi; passo++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r0 = a[i], g0 = a[i + 1], b0 = a[i + 2];
      let r = 0, g = 0, bl = 0, c = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const j = (yy * w + xx) * 4;
          if (Math.abs(a[j] - r0) + Math.abs(a[j + 1] - g0) + Math.abs(a[j + 2] - b0) > soglia) continue;
          r += a[j]; g += a[j + 1]; bl += a[j + 2]; c++;
        }
      }
      b[i] = r / c; b[i + 1] = g / c; b[i + 2] = bl / c;
    }
    [a, b] = [b, a];
  }
  return a;
}

// Pochi colori pieni (k-means), come in un cartone animato.
function appiattisci(col, capo, n, k = 8) {
  const punti = [];
  for (let p = 0; p < n; p += 3) if (capo[p]) punti.push(p * 4);
  if (!punti.length) return { centri: [[128, 128, 128]], gruppo: new Uint8Array(n), conta: [n] };
  const media = [0, 1, 2].map(c => punti.reduce((t, j) => t + col[j + c], 0) / punti.length);
  let centri = [media];
  const vicino = new Float32Array(punti.length).fill(Infinity);
  while (centri.length < k) {
    const c = centri[centri.length - 1];
    let lontano = 0;
    punti.forEach((j, i) => {
      const dd = Math.abs(col[j] - c[0]) + Math.abs(col[j + 1] - c[1]) + Math.abs(col[j + 2] - c[2]);
      if (dd < vicino[i]) vicino[i] = dd;
      if (vicino[i] > vicino[lontano]) lontano = i;
    });
    if (vicino[lontano] < 40) break;
    const j = punti[lontano];
    centri.push([col[j], col[j + 1], col[j + 2]]);
  }
  for (let giro = 0; giro < 8; giro++) {
    const somme = centri.map(() => [0, 0, 0, 0]);
    for (const j of punti) {
      let m = 0, md = Infinity;
      centri.forEach((c, i) => { const dd = (col[j] - c[0]) ** 2 + (col[j + 1] - c[1]) ** 2 + (col[j + 2] - c[2]) ** 2; if (dd < md) { md = dd; m = i; } });
      const s = somme[m]; s[0] += col[j]; s[1] += col[j + 1]; s[2] += col[j + 2]; s[3]++;
    }
    centri = centri.map((c, i) => somme[i][3] ? [somme[i][0] / somme[i][3], somme[i][1] / somme[i][3], somme[i][2] / somme[i][3]] : c);
  }
  // colori quasi uguali, o la stessa stoffa in luce e in ombra (stessa tinta, solo più scura), diventano uno solo
  const stessaStoffa = (a, b) => {
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 75) return true;
    const sa = a[0] + a[1] + a[2] + 1, sb = b[0] + b[1] + b[2] + 1, r = sb / sa;
    const tinta = Math.abs(a[0] / sa - b[0] / sb) + Math.abs(a[1] / sa - b[1] / sb) + Math.abs(a[2] / sa - b[2] / sb);
    return tinta < .05 && r > .7 && r < 1.43;
  };
  // conteggio per scartare i colori di pochi pixel (puntini, sbavature): li assorbe il colore più vicino
  const quanti = new Array(centri.length).fill(0);
  for (const j of punti) {
    let m = 0, md = Infinity;
    centri.forEach((c, i) => { const dd = (col[j] - c[0]) ** 2 + (col[j + 1] - c[1]) ** 2 + (col[j + 2] - c[2]) ** 2; if (dd < md) { md = dd; m = i; } });
    quanti[m]++;
  }
  centri = centri.filter((c, i) => quanti[i] >= punti.length * .006 || i === quanti.indexOf(Math.max(...quanti)));
  for (let i = 0; i < centri.length; i++) for (let j = centri.length - 1; j > i; j--) if (stessaStoffa(centri[i], centri[j])) centri.splice(j, 1);
  {
    const somme = centri.map(() => [0, 0, 0, 0]);
    for (const j of punti) {
      let m = 0, md = Infinity;
      centri.forEach((c, i) => { const dd = (col[j] - c[0]) ** 2 + (col[j + 1] - c[1]) ** 2 + (col[j + 2] - c[2]) ** 2; if (dd < md) { md = dd; m = i; } });
      const s = somme[m]; s[0] += col[j]; s[1] += col[j + 1]; s[2] += col[j + 2]; s[3]++;
    }
    centri = centri.map((c, i) => somme[i][3] ? [somme[i][0] / somme[i][3], somme[i][1] / somme[i][3], somme[i][2] / somme[i][3]] : c);
  }
  const gruppo = new Uint8Array(n), conta = new Array(centri.length).fill(0);
  for (let p = 0; p < n; p++) {
    if (!capo[p]) continue;
    const j = p * 4;
    let m = 0, md = Infinity;
    centri.forEach((c, i) => { const dd = (col[j] - c[0]) ** 2 + (col[j + 1] - c[1]) ** 2 + (col[j + 2] - c[2]) ** 2; if (dd < md) { md = dd; m = i; } });
    gruppo[p] = m; conta[m]++;
  }
  return { centri, gruppo, conta };
}

const scuro = (c, f) => c.map(v => Math.round(v * f));

// Prende un canvas con la foto e restituisce { disegno: Blob PNG trasparente, colore: "#rrggbb" }.
export async function disegnaCapo(sorgente) {
  const W = sorgente.naturalWidth || sorgente.width, H = sorgente.naturalHeight || sorgente.height;
  const k = Math.min(1, LATO / Math.max(W, H));
  const w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(sorgente, 0, 0, w, h);
  const img = cx.getImageData(0, 0, w, h), d = img.data, n = w * h;

  const base = sfoca(d, w, h, 1);
  let capo = null;
  for (const passo of [9, 5, 3]) {
    const t = scontorna(base, w, h, passo);
    if (t.riuscito) { capo = t.capo; break; }
  }
  if (!capo) return { disegno: null, colore: null };     // capo e sfondo troppo simili: si userà la foto
  const col = liscia(d, w, h, 4);
  const { centri, gruppo, conta } = appiattisci(col, capo, n);

  // contorno esterno spesso: pixel del capo vicini (entro 2px) allo sfondo
  const fuori = p => p < 0 || p >= n || !capo[p];
  const out = cx.createImageData(w, h), o = out.data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let p = 0; p < n; p++) {
    if (!capo[p]) continue;
    const x = p % w, y = (p / w) | 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    const c = centri[gruppo[p]];
    let bordo = false;
    for (let dy = -2; dy <= 2 && !bordo; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || fuori(yy * w + xx)) { bordo = true; break; }
    }
    // linee interne dove cambia il colore in modo netto (cuciture, tasche, righe)
    let linea = false;
    if (!bordo) for (const q of [p + 1, p + w]) {
      if (q >= n || !capo[q] || gruppo[q] === gruppo[p]) continue;
      const c2 = centri[gruppo[q]];
      const lum = (c[0] * .3 + c[1] * .59 + c[2] * .11) - (c2[0] * .3 + c2[1] * .59 + c2[2] * .11);
      if (Math.abs(lum) > 38) linea = true;
    }
    const v = bordo ? scuro(c, .35) : linea ? scuro(c, .6) : c;
    const i = p * 4; o[i] = v[0]; o[i + 1] = v[1]; o[i + 2] = v[2]; o[i + 3] = 255;
  }

  // ritaglio attorno al capo, con un po' di margine
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * .05) + 2;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  cx.clearRect(0, 0, w, h);
  cx.putImageData(out, 0, 0);
  const ritaglio = document.createElement("canvas");
  ritaglio.width = x1 - x0 + 1; ritaglio.height = y1 - y0 + 1;
  ritaglio.getContext("2d").drawImage(cv, x0, y0, ritaglio.width, ritaglio.height, 0, 0, ritaglio.width, ritaglio.height);
  const disegno = await new Promise(ok => ritaglio.toBlob(ok, "image/png"));

  // colore principale del capo (serve solo per gli abbinamenti, non si mostra)
  let principale = 0;
  conta.forEach((c, i) => { if (c > conta[principale]) principale = i; });
  const colore = "#" + centri[principale].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  return { disegno, colore };
}
