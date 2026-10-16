// Scheda iniziale (identica al foglio) e catalogo esercizi per le sostituzioni.
// eq: bil = bilanciere, man = manubri (peso PER MANUBRIO), mac = macchina, cav = cavi, cl = corpo libero

const GRUPPI = {
  petto: "Petto", schiena: "Schiena", spalle: "Spalle", post: "Deltoidi posteriori",
  bicipiti: "Bicipiti", tricipiti: "Tricipiti", quadricipiti: "Quadricipiti",
  femorali: "Femorali", polpacci: "Polpacci", addome: "Addome"
};

const ATTREZZI = {
  bil: { nome: "Bilanciere", peso: "kg totali", passo: 2.5, consiglio: "+2,5 kg (1,25 per lato)" },
  man: { nome: "Manubri", peso: "kg PER MANUBRIO", passo: 2, consiglio: "+1-2 kg per manubrio" },
  mac: { nome: "Macchina", peso: "kg (o tacca)", passo: 2.5, consiglio: "+1 tacca" },
  cav: { nome: "Cavi", peso: "kg (o tacca)", passo: 2.5, consiglio: "+1 tacca" },
  cl:  { nome: "Corpo libero", peso: "kg zavorra (0 = nessuna)", passo: 2.5, consiglio: "aggiungi zavorra 1-2,5 kg" }
};

const CATALOGO = [
  ["Panca piana", "petto", "bil"], ["Panca inclinata manubri", "petto", "man"], ["Croci ai cavi", "petto", "cav"],
  ["Panca piana manubri", "petto", "man"], ["Panca inclinata bilanciere", "petto", "bil"],
  ["Chest press", "petto", "mac"], ["Pec deck", "petto", "mac"], ["Croci manubri", "petto", "man"],
  ["Rematore con bilanciere", "schiena", "bil"], ["Trazioni", "schiena", "cl"],
  ["Lat machine presa larga", "schiena", "cav"], ["Rematore al cavo basso", "schiena", "cav"],
  ["Rematore manubrio", "schiena", "man"], ["Rematore alla macchina", "schiena", "mac"],
  ["Lat machine presa stretta", "schiena", "cav"], ["Trazioni assistite", "schiena", "mac"],
  ["Military press manubri", "spalle", "man"], ["Military press bilanciere", "spalle", "bil"],
  ["Alzate laterali", "spalle", "man"], ["Shoulder press macchina", "spalle", "mac"],
  ["Alzate laterali ai cavi", "spalle", "cav"],
  ["Face pull", "post", "cav"], ["Alzate posteriori (reverse pec deck)", "post", "mac"],
  ["Alzate posteriori manubri", "post", "man"],
  ["Curl EZ", "bicipiti", "bil"], ["Curl inclinato manubri", "bicipiti", "man"], ["Curl a martello", "bicipiti", "man"],
  ["Curl ai cavi", "bicipiti", "cav"], ["Curl manubri", "bicipiti", "man"],
  ["French press", "tricipiti", "bil"], ["Dip alle parallele", "tricipiti", "cl"], ["Panca presa stretta", "tricipiti", "bil"],
  ["Estensione tricipiti sopra la testa", "tricipiti", "cav"], ["Pushdown ai cavi", "tricipiti", "cav"],
  ["Squat", "quadricipiti", "bil"], ["Leg press", "quadricipiti", "mac"], ["Hack squat", "quadricipiti", "mac"],
  ["Affondi manubri", "quadricipiti", "man"], ["Leg extension", "quadricipiti", "mac"],
  ["Stacco rumeno", "femorali", "bil"], ["Leg curl", "femorali", "mac"], ["Stacco rumeno manubri", "femorali", "man"],
  ["Calf raise in piedi", "polpacci", "mac"], ["Calf raise alla leg press", "polpacci", "mac"],
  ["Hanging leg raise", "addome", "cl"], ["Crunch ai cavi", "addome", "cav"]
].map(([nome, gruppo, eq]) => ({ nome, gruppo, eq }));

// Righe: [esercizio, serie, rip min, rip max, recupero min s, recupero max s, superserie, drop set]
const r = (ex, s, a, b, ra, rb, ss = null, drop = false) => ({ ex, serie: s, min: a, max: b, recMin: ra, recMax: rb, ss, drop });

const SCHEDE = {
  A: { nome: "Upper A", sotto: "Forza petto/schiena", colore: "#EA580C", righe: [
    r("Panca piana", 4, 6, 8, 120, 180),
    r("Rematore con bilanciere", 4, 6, 8, 120, 180),
    r("Military press manubri", 3, 8, 10, 120, 120),
    r("Trazioni", 3, 6, 10, 120, 120),
    r("Curl EZ", 3, 8, 10, 90, 90, 1),
    r("French press", 3, 8, 10, 90, 90, 1)
  ]},
  B: { nome: "Upper B", sotto: "Volume petto/schiena", colore: "#2563EB", righe: [
    r("Panca inclinata manubri", 4, 8, 10, 120, 120),
    r("Lat machine presa larga", 4, 8, 10, 120, 120),
    r("Croci ai cavi", 3, 12, 15, 60, 90, null, true),
    r("Rematore al cavo basso", 3, 10, 12, 90, 90),
    r("Alzate laterali", 3, 12, 15, 60, 60, null, true),
    r("Face pull", 3, 15, 15, 60, 60)
  ]},
  G: { nome: "Gambe", sotto: "Compatta", colore: "#16A34A", righe: [
    r("Squat", 4, 6, 8, 180, 180),
    r("Stacco rumeno", 3, 8, 10, 120, 180),
    r("Leg press", 2, 10, 12, 120, 120),
    r("Leg curl", 2, 10, 12, 90, 90),
    r("Calf raise in piedi", 3, 12, 15, 60, 60),
    r("Hanging leg raise", 3, 10, 15, 60, 60)
  ]},
  C: { nome: "Upper C", sotto: "Spalle e braccia", colore: "#9333EA", righe: [
    r("Military press bilanciere", 4, 6, 8, 120, 180),
    r("Alzate laterali", 4, 12, 15, 60, 60, null, true),
    r("Alzate posteriori (reverse pec deck)", 3, 15, 15, 60, 60),
    r("Dip alle parallele", 3, 8, 12, 120, 120),
    r("Curl inclinato manubri", 3, 10, 12, 90, 90, null, true),
    r("Curl a martello", 3, 10, 12, 90, 90, 1),
    r("Estensione tricipiti sopra la testa", 3, 10, 12, 90, 90, 1)
  ]}
};

// Lunedì = 1 ... Domenica = 7. null = riposo.
const CALENDARIO_BASE = { 1: "A", 2: null, 3: "B", 4: null, 5: "G", 6: "C", 7: null };
const CALENDARIO_ALT  = { 1: "G", 2: null, 3: "A", 4: null, 5: "B", 6: null, 7: "C" };

const REGOLE = [
  "Riscaldamento: 5 min leggeri + 2 serie progressive del primo esercizio (metà peso × 8, poi 75% × 4). Non contano e non vanno nel diario.",
  "Squat, panca e stacco rumeno: lascia sempre almeno 1 ripetizione in canna. Isolamenti: l'ultima serie può arrivare a cedimento.",
  "Discesa in 2-3 s, ampiezza completa. 1 s di pausa in basso su panca e squat; 1-2 s in allungamento su croci, stacco rumeno e curl inclinato.",
  "Dolore acuto o articolare: fermati. Niente massimali a 1 ripetizione."
];
