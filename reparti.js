// Reparti del supermercato, nell'ordine in cui di solito si incontrano.
// L'app indovina il reparto dal nome (si può sempre cambiare a mano).

export const REPARTI = [
  { id: "frutta",    nome: "Frutta e verdura",       icona: "🍎", tinta: "#22c55e" },
  { id: "pane",      nome: "Pane e forno",           icona: "🥖", tinta: "#d97706" },
  { id: "colazione", nome: "Colazione",              icona: "🥣", tinta: "#f59e0b" },
  { id: "dolci",     nome: "Dolci e snack",          icona: "🍫", tinta: "#a16207" },
  { id: "dispensa",  nome: "Pasta, riso e dispensa", icona: "🍝", tinta: "#ea580c" },
  { id: "latticini", nome: "Latte, uova e formaggi", icona: "🧀", tinta: "#eab308" },
  { id: "carne",     nome: "Carne, pesce e salumi",  icona: "🥩", tinta: "#e11d48" },
  { id: "surgelati", nome: "Surgelati",              icona: "🧊", tinta: "#0ea5e9" },
  { id: "bevande",   nome: "Bevande",                icona: "🥤", tinta: "#06b6d4" },
  { id: "igiene",    nome: "Igiene e cura",          icona: "🧴", tinta: "#8b5cf6" },
  { id: "casa",      nome: "Casa e pulizia",         icona: "🧽", tinta: "#14b8a6" },
  { id: "scuola",    nome: "Scuola e cartoleria",    icona: "✏️", tinta: "#6366f1" },
  { id: "altro",     nome: "Altro",                  icona: "🛍️", tinta: "#64748b" }
];

const PAROLE = {
  frutta: "frutta verdura mela mele pera pere banana banane arancia arance mandarini clementine limone limoni kiwi uva fragole ciliegie pesche albicocche melone anguria ananas mirtilli lamponi avocado insalata lattuga rucola spinaci pomodori pomodorini patate carote cipolla cipolle aglio zucchine melanzane peperoni cetrioli broccoli cavolfiore cavolo finocchi sedano funghi basilico prezzemolo zucca piselli fagiolini mais",
  pane: "pane panini pancarrè pan carrè piadina piadine pizza focaccia grissini crackers cracker taralli friselle tramezzini baguette rosette",
  colazione: "cereali corn flakes biscotti fette biscottate marmellata confettura miele nutella crema spalmabile caffè caffe cialde capsule tè te tisana camomilla orzo cacao muesli brioche cornetti plumcake",
  dolci: "cioccolato cioccolata cioccolatini caramelle merendine merendina patatine chips popcorn pop corn snack torta crostata wafer gomme da masticare chewing gum ovetto kinder nutella biscready pringles salatini noccioline arachidi pistacchi mandorle",
  dispensa: "pasta spaghetti penne fusilli rigatoni maccheroni lasagne gnocchi tortellini ravioli riso farina zucchero sale olio aceto pelati passata sugo pesto tonno legumi fagioli ceci lenticchie spezie pepe dado brodo maionese ketchup senape lievito pangrattato olive capperi sottaceti",
  latticini: "latte yogurt yoghurt burro formaggio formaggi mozzarella mozzarelle parmigiano grana ricotta panna uova uovo stracchino mascarpone philadelphia scamorza provola gorgonzola emmental sottilette pecorino budino",
  carne: "carne pollo petto di pollo manzo vitello maiale tacchino salsiccia salsicce hamburger macinato prosciutto salame mortadella bresaola wurstel würstel speck pancetta affettati cotoletta cotolette arrosto bistecca pesce salmone gamberi merluzzo orata branzino calamari cozze vongole",
  surgelati: "surgelati surgelato gelato gelati ghiaccioli ghiaccio bastoncini sofficini patatine fritte pizza surgelata minestrone surgelato",
  bevande: "acqua acqua frizzante acqua naturale coca cola coca-cola aranciata succo succhi birra vino spumante prosecco tè freddo te freddo the freddo estathe bibita bibite sprite fanta gatorade powerade energy drink red bull chinotto gassosa limonata",
  igiene: "shampoo balsamo bagnoschiuma docciaschiuma dentifricio spazzolino spazzolini collutorio deodorante sapone saponetta carta igienica assorbenti crema creme rasoio rasoi lamette cotton fioc dischetti struccanti trucco mascara smalto profumo fazzoletti salviette gel capelli lacca cerotti",
  casa: "detersivo detersivi sapone piatti piatti pastiglie lavastoviglie ammorbidente candeggina scottex carta assorbente carta da cucina spugne spugna sacchetti sacchi spazzatura alluminio pellicola carta forno tovaglioli piatti di carta bicchieri di plastica pile batterie lampadina lampadine anticalcare sgrassatore vetril swiffer",
  scuola: "quaderno quaderni penna penne matita matite gomma gomme pastelli pennarelli colla forbici righello astuccio diario evidenziatore evidenziatori zaino album fogli"
};

const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Elenco [parola, reparto] dalla più lunga alla più corta, così "tè freddo" vince su "tè".
const INDICE = Object.entries(PAROLE)
  .flatMap(([rep, testo]) => {
    const parole = [];
    // le parole composte sono scritte attaccate dagli spazi: riconosco quelle note
    const composte = testo.match(/(carta igienica|carta assorbente|carta da cucina|carta forno|petto di pollo|fette biscottate|corn flakes|crema spalmabile|gomme da masticare|chewing gum|pop corn|patatine fritte|pizza surgelata|minestrone surgelato|acqua frizzante|acqua naturale|coca cola|tè freddo|te freddo|the freddo|energy drink|red bull|sapone piatti|pastiglie lavastoviglie|sacchi spazzatura|piatti di carta|bicchieri di plastica|cotton fioc|dischetti struccanti|gel capelli|pan carrè)/g) || [];
    let resto = testo;
    composte.forEach(c => { parole.push(c); resto = resto.replace(c, " "); });
    resto.split(/\s+/).filter(Boolean).forEach(p => parole.push(p));
    return parole.map(p => [norm(p), rep]);
  })
  .sort((a, b) => b[0].length - a[0].length);

export function indovinaReparto(nome) {
  const t = " " + norm(nome) + " ";
  if (t.trim() === "") return "altro";
  // Vince la parola che compare prima nel nome ("gelato al cioccolato" -> surgelati);
  // a pari posizione la più lunga ("tè freddo" -> bevande, non colazione).
  // Le parole lunghe valgono anche come inizio di parola ("biscottini" -> "biscotti").
  let meglio = null;
  for (const [parola, rep] of INDICE) {
    let pos = t.indexOf(" " + parola + " ");
    if (pos < 0 && parola.length >= 4) pos = t.indexOf(" " + parola);
    if (pos < 0) continue;
    if (!meglio || pos < meglio.pos || (pos === meglio.pos && parola.length > meglio.len)) {
      meglio = { pos, len: parola.length, rep };
    }
  }
  return meglio ? meglio.rep : "altro";
}

export const reparto = id => REPARTI.find(r => r.id === id) || REPARTI[REPARTI.length - 1];
