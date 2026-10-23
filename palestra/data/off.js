// Open Food Facts: ricerca alimenti e codici a barre (dati aperti, licenza ODbL).
// Funziona direttamente dal telefono (l'API permette le richieste dal browser).

import { normalizza } from '../core/foods.js';

const BASE = 'https://world.openfoodfacts.org';
const CAMPI = 'code,product_name,product_name_it,generic_name_it,brands,nutriments,serving_size,serving_quantity,quantity,image_front_small_url';
const cache = new Map();

const num = v => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return isFinite(n) ? n : null;
};

/** Converte un prodotto di Open Food Facts nel formato dell'app (valori per 100 g/ml). */
export function daProdottoOFF(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n.energy_100g) != null) kcal = num(n.energy_100g) / 4.184; // kJ → kcal
  if (kcal == null) kcal = num(n['energy-kcal']);
  const nome = (p.product_name_it || p.product_name || p.generic_name_it || '').trim();
  if (!nome || kcal == null) return null;
  const marca = (Array.isArray(p.brands) ? p.brands[0] : (p.brands || '').split(',')[0] || '').trim();
  const porz = num(p.serving_quantity);
  const unita = /ml|cl|l\b/i.test(p.serving_size || p.quantity || '') && !/g\b/i.test(p.serving_size || '') ? 'ml' : 'g';
  return {
    id: 'off-' + (p.code || normalizza(nome).replace(/ /g, '-')),
    nome, marca,
    kcal: Math.round(kcal),
    prot: Math.round((num(n.proteins_100g) || 0) * 10) / 10,
    carb: Math.round((num(n.carbohydrates_100g) || 0) * 10) / 10,
    grassi: Math.round((num(n.fat_100g) || 0) * 10) / 10,
    unita,
    porzioni: porz && porz > 0 && porz < 2000 ? [{ nome: p.serving_size ? `Porzione (${p.serving_size})` : 'Porzione', g: Math.round(porz) }] : [],
    barcode: p.code || null,
    immagine: p.image_front_small_url || null,
    fonte: 'off',
  };
}

async function chiedi(url, signal) {
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Open Food Facts non risponde (' + r.status + ')');
  return r.json();
}

/** Cerca prodotti per nome. Restituisce [] se non c'è rete. */
export async function cercaProdotti(testo, signal) {
  const q = (testo || '').trim();
  if (q.length < 3) return [];
  const k = 'q:' + normalizza(q);
  if (cache.has(k)) return cache.get(k);
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1`
    + `&page_size=24&sort_by=unique_scans_n&lc=it&cc=it&fields=${CAMPI}`;
  const d = await chiedi(url, signal);
  const lista = (d.products || []).map(daProdottoOFF).filter(Boolean);
  // tolgo i doppioni (stesso nome e marca)
  const visti = new Set();
  const out = lista.filter(x => { const kk = normalizza(x.nome + ' ' + x.marca); if (visti.has(kk)) return false; visti.add(kk); return true; });
  cache.set(k, out);
  return out;
}

/** Prodotto da codice a barre. null se non c'è nel database. */
export async function prodottoDaCodice(codice, signal) {
  const c = String(codice || '').replace(/\D/g, '');
  if (c.length < 6) return null;
  if (cache.has('c:' + c)) return cache.get('c:' + c);
  const d = await chiedi(`${BASE}/api/v2/product/${c}.json?fields=${CAMPI}`, signal);
  const p = d && (d.status === 1 || d.status === 'success' || d.product) ? daProdottoOFF({ code: c, ...d.product }) : null;
  cache.set('c:' + c, p);
  return p;
}
