// Alimenti di base (valori medi per 100 g o 100 ml, da tabelle CREA/USDA ed etichette comuni)
// e pasti preimpostati della scheda. Servono anche senza internet.

import { ALIMENTI_EXTRA } from './alimenti-extra.js';

/** I pasti della giornata. */
export const PASTI = [
  { key: 'colazione', nome: 'Colazione', icona: 'sunrise' },
  { key: 'spuntino', nome: 'Spuntino a scuola', icona: 'bag' },
  { key: 'pranzo', nome: 'Pranzo', sotto: 'Pre-allenamento', icona: 'sun' },
  { key: 'merenda', nome: 'Merenda', sotto: 'Post-allenamento', icona: 'cup' },
  { key: 'cena', nome: 'Cena', icona: 'forkKnife' },
  { key: 'notte', nome: 'Prima di dormire', icona: 'moon' },
];

export const nomePasto = key => PASTI.find(p => p.key === key)?.nome || 'Pasto';

/** Pasto "naturale" per l'ora del giorno (per proporre dove aggiungere). */
export function pastoPerOra(ora = new Date().getHours()) {
  if (ora < 9) return 'colazione';
  if (ora < 12) return 'spuntino';
  if (ora < 15) return 'pranzo';
  if (ora < 18) return 'merenda';
  if (ora < 22) return 'cena';
  return 'notte';
}

const a = (id, nome, kcal, prot, carb, grassi, porzioni = [], unita = 'g') =>
  ({ id: 'db-' + id, nome, kcal, prot, carb, grassi, unita, porzioni, alias: ALIAS[id] || '', base: true, fonte: 'db' });

// parole simili per trovare gli alimenti di base anche con altri nomi
const ALIAS = {
  manzo: 'bistecca carne rossa fettina', macinato: 'carne trita ragu', pollo: 'carne bianca', tacchino: 'carne bianca',
  uova: 'uovo', pasta: 'spaghetti penne fusilli rigatoni maccheroni', riso: 'risotto', pane: 'panino rosetta baguette',
  cornetto: 'brioche croissant', pizza: 'margherita', latte: 'cappuccino', 'yogurt-greco': 'fage', barretta: 'protein bar',
  'crema-nocciole': 'nutella', olio: 'evo condimento', patate: 'patata', verdure: 'contorno', 'frutti-bosco': 'mirtilli lamponi',
  ceci: 'legumi', fagioli: 'legumi', lenticchie: 'legumi', 'tonno-olio': 'tonno', 'tonno-naturale': 'tonno', wurstel: 'wurstel',
};
const P = (nome, g) => ({ nome, g });

export const ALIMENTI = [
  // Cereali, pane, pasta
  a('pasta', 'Pasta di semola (cruda)', 359, 13, 71, 2, [P('Porzione', 100), P('Porzione abbondante', 120)]),
  a('pasta-cotta', 'Pasta cotta', 158, 5.8, 31, 0.9, [P('Piatto', 220)]),
  a('pasta-integrale', 'Pasta integrale (cruda)', 345, 13.5, 64, 2.5, [P('Porzione', 100)]),
  a('riso', 'Riso bianco (crudo)', 358, 7, 79, 0.6, [P('Porzione', 100), P('Porzione abbondante', 120)]),
  a('riso-basmati', 'Riso basmati (crudo)', 354, 8.5, 78, 0.6, [P('Porzione', 100)]),
  a('gnocchi', 'Gnocchi di patate', 150, 3.5, 32, 0.5, [P('Porzione', 250)]),
  a('couscous', 'Cous cous (crudo)', 376, 12.8, 77, 0.6, [P('Porzione', 90)]),
  a('pane', 'Pane bianco', 270, 8.5, 56, 1.2, [P('Fetta', 35), P('Panino', 90)]),
  a('pane-integrale', 'Pane integrale', 250, 11, 43, 3.4, [P('Fetta', 35), P('Panino', 90)]),
  a('pancarre', 'Pane in cassetta', 275, 8.5, 49, 4.5, [P('Fetta', 25)]),
  a('fette-biscottate', 'Fette biscottate', 410, 11, 73, 6.5, [P('Fetta', 9)]),
  a('crackers', 'Crackers', 428, 9.5, 72, 10, [P('Pacchetto', 25)]),
  a('avena', 'Fiocchi d\'avena', 370, 13, 60, 7, [P('Porzione', 50), P('Porzione abbondante', 70)]),
  a('muesli', 'Muesli', 365, 9.5, 64, 6.5, [P('Porzione', 50)]),
  a('cereali', 'Cereali da colazione (corn flakes)', 378, 7, 84, 0.9, [P('Porzione', 40)]),
  a('biscotti', 'Biscotti secchi', 430, 7.5, 72, 12, [P('Biscotto', 8), P('Porzione', 40)]),
  a('cornetto', 'Cornetto', 400, 8, 45, 21, [P('Cornetto', 60)]),
  a('pizza', 'Pizza margherita', 250, 10.5, 33, 8.5, [P('Pizza intera', 350), P('Trancio', 120)]),
  // Proteine
  a('uova', 'Uova', 143, 12.6, 0.7, 9.5, [P('1 uovo', 55), P('2 uova', 110), P('3 uova', 165)]),
  a('albume', 'Albume d\'uovo', 52, 11, 0.7, 0.2, [P('Porzione', 100)]),
  a('pollo', 'Petto di pollo (crudo)', 110, 23.3, 0, 1.5, [P('Porzione', 120), P('Porzione abbondante', 150)]),
  a('tacchino', 'Petto di tacchino (crudo)', 107, 24, 0, 1.2, [P('Porzione', 120)]),
  a('manzo', 'Manzo magro (crudo)', 130, 21, 0, 5, [P('Porzione', 120), P('Bistecca', 180)]),
  a('macinato', 'Macinato magro di manzo (crudo)', 137, 20.5, 0, 6, [P('Porzione', 100)]),
  a('salmone', 'Salmone (crudo)', 185, 20, 0, 12, [P('Trancio', 120)]),
  a('merluzzo', 'Merluzzo (crudo)', 82, 18, 0, 0.7, [P('Porzione', 150)]),
  a('tonno-olio', 'Tonno sott\'olio (sgocciolato)', 192, 25, 0, 10, [P('Scatoletta', 80)]),
  a('tonno-naturale', 'Tonno al naturale (sgocciolato)', 103, 23.5, 0, 1, [P('Scatoletta', 80)]),
  a('prosciutto-cotto', 'Prosciutto cotto', 145, 19, 1, 7, [P('Porzione', 50)]),
  a('prosciutto-crudo', 'Prosciutto crudo', 250, 26, 0, 16, [P('Porzione', 50)]),
  a('bresaola', 'Bresaola', 151, 32, 0.4, 2.6, [P('Porzione', 50)]),
  a('wurstel', 'Würstel', 270, 13, 2, 24, [P('1 würstel', 50)]),
  a('ceci', 'Ceci in scatola (sgocciolati)', 120, 7, 16, 2.6, [P('Porzione', 120)]),
  a('fagioli', 'Fagioli in scatola (sgocciolati)', 95, 6.5, 14, 0.5, [P('Porzione', 120)]),
  a('lenticchie', 'Lenticchie (cotte)', 116, 9, 20, 0.4, [P('Porzione', 150)]),
  a('tofu', 'Tofu', 120, 13, 2, 7, [P('Porzione', 100)]),
  // Latte e derivati
  a('latte', 'Latte intero', 64, 3.3, 4.8, 3.6, [P('Bicchiere', 200), P('Tazza', 250)], 'ml'),
  a('latte-ps', 'Latte parzialmente scremato', 46, 3.4, 5, 1.5, [P('Bicchiere', 200), P('Tazza', 250)], 'ml'),
  a('yogurt-greco', 'Yogurt greco 2%', 73, 9.9, 3.9, 2, [P('Vasetto', 150), P('Porzione', 200)]),
  a('yogurt-greco-0', 'Yogurt greco 0%', 57, 10.3, 3.5, 0.2, [P('Vasetto', 150), P('Porzione', 200)]),
  a('yogurt', 'Yogurt bianco intero', 61, 3.5, 4.7, 3.3, [P('Vasetto', 125)]),
  a('parmigiano', 'Parmigiano', 392, 33, 0, 28, [P('Cucchiaio', 10), P('Porzione', 20)]),
  a('mozzarella', 'Mozzarella', 250, 18.5, 1, 19.5, [P('Mozzarella', 125)]),
  a('ricotta', 'Ricotta', 146, 8.8, 3.5, 10.9, [P('Porzione', 100)]),
  a('fiocchi-latte', 'Fiocchi di latte', 100, 12, 3, 4.5, [P('Vasetto', 150)]),
  a('formaggio', 'Formaggio stagionato (fette)', 380, 27, 0.5, 30, [P('Fetta', 20), P('Porzione', 30)]),
  // Frutta e verdura
  a('banana', 'Banana', 89, 1.1, 22.8, 0.3, [P('Banana media', 120)]),
  a('mela', 'Mela', 52, 0.3, 14, 0.2, [P('Mela media', 180)]),
  a('arancia', 'Arancia', 47, 0.9, 12, 0.1, [P('Arancia media', 200)]),
  a('kiwi', 'Kiwi', 61, 1.1, 15, 0.5, [P('Kiwi', 75)]),
  a('pera', 'Pera', 57, 0.4, 15, 0.1, [P('Pera media', 180)]),
  a('frutti-bosco', 'Frutti di bosco', 45, 0.9, 10, 0.4, [P('Porzione', 100)]),
  a('avocado', 'Avocado', 160, 2, 8.5, 14.7, [P('Mezzo avocado', 80)]),
  a('patate', 'Patate (crude)', 80, 2, 17.5, 0.1, [P('Porzione', 250)]),
  a('patate-forno', 'Patate al forno (con olio)', 130, 2.5, 20, 4.5, [P('Porzione', 250)]),
  a('verdure', 'Verdure miste', 25, 1.5, 4, 0.3, [P('Porzione', 200)]),
  a('insalata', 'Insalata', 15, 1.3, 2, 0.2, [P('Porzione', 80)]),
  a('pomodori', 'Pomodori', 18, 0.9, 3.9, 0.2, [P('Porzione', 150)]),
  a('passata', 'Passata di pomodoro', 30, 1.3, 5, 0.2, [P('Porzione', 100)]),
  a('zucchine', 'Zucchine', 17, 1.2, 3.1, 0.3, [P('Porzione', 200)]),
  a('broccoli', 'Broccoli', 34, 2.8, 7, 0.4, [P('Porzione', 200)]),
  a('spinaci', 'Spinaci', 23, 2.9, 3.6, 0.4, [P('Porzione', 200)]),
  // Grassi, frutta secca, dolci
  a('olio', 'Olio extravergine d\'oliva', 884, 0, 0, 100, [P('Cucchiaio', 10), P('Cucchiaino', 5)], 'ml'),
  a('burro', 'Burro', 717, 0.9, 0.1, 81, [P('Porzione', 10)]),
  a('burro-arachidi', 'Burro d\'arachidi', 588, 25, 20, 50, [P('Cucchiaio', 15), P('Porzione', 30)]),
  a('mandorle', 'Mandorle', 579, 21, 22, 50, [P('Manciata', 20)]),
  a('noci', 'Noci', 654, 15, 14, 65, [P('Manciata', 15)]),
  a('frutta-secca', 'Frutta secca mista', 600, 18, 20, 52, [P('Manciata', 20)]),
  a('miele', 'Miele', 304, 0.3, 82, 0, [P('Cucchiaino', 10), P('Cucchiaio', 20)]),
  a('marmellata', 'Marmellata', 250, 0.4, 60, 0.1, [P('Cucchiaino', 15)]),
  a('cioccolato', 'Cioccolato fondente 70%', 598, 7.8, 46, 43, [P('Quadretti', 20)]),
  a('crema-nocciole', 'Crema alle nocciole', 539, 6.3, 57.5, 30.9, [P('Cucchiaio', 15)]),
  a('barretta', 'Barretta proteica', 350, 33, 30, 11.7, [P('Barretta', 60)]),
  a('gelato', 'Gelato alla crema', 200, 3.5, 24, 10, [P('Coppetta', 100)]),
  a('succo', 'Succo d\'arancia', 45, 0.7, 10.4, 0.2, [P('Bicchiere', 200)], 'ml'),
  a('hummus', 'Hummus', 177, 7.9, 14, 9.6, [P('Porzione', 50)]),
];

ALIMENTI.push(...ALIMENTI_EXTRA.filter(x => !ALIMENTI.some(y => y.id === x.id)));

/** Pasti preimpostati della scheda (kcal e proteine dalla scheda, carboidrati e grassi stimati). */
const m = (pasto, n, nome, descrizione, kcal, prot, carb, grassi) =>
  ({ id: `preset-${pasto}-${n}`, pasto, nome, descrizione, kcal, prot, carb, grassi, fonte: 'preset' });

export const PRESET = [
  m('colazione', 1, 'Uova, pane, banana e latte', '3 uova, 2 fette di pane, 1 banana, 200 ml di latte', 680, 33, 85, 23),
  m('colazione', 2, 'Porridge con banana', '70 g di avena, 250 ml di latte, 1 banana, 15 g di burro d\'arachidi', 610, 21, 82, 22),
  m('colazione', 3, 'Yogurt greco e muesli', '200 g di yogurt greco, 60 g di muesli, 20 g di mandorle, miele', 570, 26, 76, 18),
  m('spuntino', 1, 'Barretta, banana e frutta secca', '1 barretta proteica, 1 banana, 20 g di frutta secca', 445, 25, 46, 18),
  m('spuntino', 2, 'Panino cotto e formaggio', 'Panino con 40 g di prosciutto cotto e 30 g di formaggio, 1 frutto', 440, 22, 57, 14),
  m('spuntino', 3, 'Panino burro d\'arachidi e banana', 'Panino con 30 g di burro d\'arachidi, 1 banana', 500, 16, 73, 16),
  m('pranzo', 1, 'Pasta al pomodoro e pollo', '110 g di pasta al pomodoro, 80 g di pollo, verdure, olio, 1 frutto', 710, 34, 114, 13),
  m('pranzo', 2, 'Riso e salmone', '120 g di riso, 100 g di salmone, verdure', 705, 30, 104, 19),
  m('pranzo', 3, 'Pasta al ragù', '110 g di pasta al ragù con 80 g di macinato magro, 15 g di parmigiano, insalata', 715, 36, 87, 25),
  m('merenda', 1, 'Pane, burro d\'arachidi e banana', '2 fette di pane, 30 g di burro d\'arachidi, 1 banana', 440, 14, 62, 15),
  m('merenda', 2, 'Yogurt greco, cereali e banana', '150 g di yogurt greco, 40 g di cereali, 1 banana, miele', 465, 16, 89, 5),
  m('merenda', 3, 'Frullato latte, banana e avena', '250 ml di latte, 1 banana, 30 g di avena, 15 g di burro d\'arachidi', 465, 17, 59, 18),
  m('cena', 1, 'Frittata e pane', 'Frittata di 3 uova, 120 g di pane, verdure, olio', 700, 32, 82, 27),
  m('cena', 2, 'Manzo e patate al forno', '120 g di manzo magro, 450 g di patate al forno, verdure', 660, 36, 91, 17),
  m('cena', 3, 'Riso, tonno e parmigiano', '120 g di riso, 1 scatoletta di tonno, 20 g di parmigiano, verdure', 715, 36, 101, 19),
  m('notte', 1, 'Latte e cereali', '250 ml di latte, 40 g di cereali', 310, 11, 46, 9),
  m('notte', 2, 'Yogurt greco e noci', '150 g di yogurt greco, 15 g di noci, miele', 280, 14, 25, 14),
  m('notte', 3, 'Pane, burro d\'arachidi e latte', '1 fetta di pane, 15 g di burro d\'arachidi, 200 ml di latte', 300, 13, 31, 14),
];

/** Toglie accenti e maiuscole per la ricerca. */
export const normalizza = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// radice della parola: "bistecche" e "bistecca" → "bistecc", "polli" e "pollo" → "poll"
const radice = w => (w.length > 3 ? w.replace(/(he|hi|e|i|a|o)$/, '') : w);

/**
 * Ricerca negli alimenti di base: ogni parola cercata deve trovarsi nel nome o nelle parole simili
 * (anche al plurale o scritta a metà). Prima i nomi che iniziano con quello che cerchi.
 */
export function cercaLocale(testo, lista = ALIMENTI, max = 20) {
  const q = normalizza(testo);
  if (!q) return [];
  const parole = q.split(' ');
  return lista
    .map(x => {
      const n = normalizza(x.nome);
      const al = normalizza(x.alias);
      const pn = n.split(' '), pa = al ? al.split(' ') : [];
      const trova = (p, ws) => ws.some(w => w.startsWith(p) || (p.length > 3 && radice(w).startsWith(radice(p))));
      let score = 0;
      for (const p of parole) {
        if (trova(p, pn) || n.includes(p)) continue;
        if (trova(p, pa)) { score += 2; continue; }
        return null;
      }
      if (n.startsWith(q)) score -= 1;
      else if (!pn[0].startsWith(parole[0]) && !radice(pn[0]).startsWith(radice(parole[0]))) score += 0.5;
      if (x.piatto) score += 2; // prima i cibi semplici, poi i piatti pronti
      if (x.base) score -= 1.6;  // e tra i semplici quelli di tutti i giorni (petto di pollo, riso bianco…)
      return { x, score: score + n.length / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map(r => r.x);
}
