// Dove vengono salvate le cose da comprare.
// Ogni elemento: { id, nome, quantita, persona, categoria, nota, urgente,
//                  comprato, compratoDa, compratoIl, creato }
//
// Due "server" con la stessa interfaccia:
//  - Firebase (Firestore): lista condivisa in tempo reale tra tutti i telefoni
//  - locale (localStorage): solo su questo telefono, se Firebase non è collegato
//
// Ogni famiglia vive in famiglie/<id>/..., dove <id> si ricava dalla password
// (vedi chiaveFamiglia): senza la password non si sa dove sono i dati.

const FIREBASE_VER = "10.12.2";
const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}/`;

// Password -> id della famiglia (64 caratteri esadecimali), con PBKDF2 lento apposta.
export async function chiaveFamiglia(password) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password.trim()), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode("la-nostra-spesa/v1"), iterations: 200000 },
    base, 256
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function apriServer(firebase) {
  if (firebase) {
    try {
      return await serverFirebase(firebase);
    } catch (e) {
      console.error("Firebase non disponibile, uso il salvataggio locale", e);
    }
  }
  return serverLocale();
}

// Prova un collegamento a Firebase prima di salvarlo. Restituisce "" se va,
// altrimenti un messaggio da mostrare.
export async function provaFirebase(firebase) {
  try {
    const { initializeApp, deleteApp } = await import(BASE + "firebase-app.js");
    const fs = await import(BASE + "firebase-firestore.js");
    const app = initializeApp(firebase, "prova-" + Date.now());
    try {
      const db = fs.getFirestore(app);
      const prova = fs.doc(db, "famiglie", "0".repeat(64), "info", "famiglia");
      await Promise.race([
        fs.getDocFromServer(prova),
        new Promise((_, no) => setTimeout(() => no({ code: "tempo" }), 12000))
      ]);
      return "";
    } finally {
      deleteApp(app).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    if (e.code === "permission-denied") return "Firebase risponde, ma le regole non sono giuste: ricontrolla il passo 3.";
    if (e.code === "tempo" || e.code === "unavailable") return "Non riesco a raggiungere il database: hai creato Firestore (passo 2)? Sei connesso a internet?";
    if (e.code === "not-found") return "Il database Firestore non esiste ancora: fai il passo 2.";
    if (String(e.message || "").includes("Failed to fetch")) return "Non riesco a scaricare Firebase: controlla la connessione.";
    return "Questi dati non funzionano: ricopia tutto il riquadro firebaseConfig.";
  }
}

async function serverFirebase(firebase) {
  const { initializeApp } = await import(BASE + "firebase-app.js");
  const fs = await import(BASE + "firebase-firestore.js");
  const app = initializeApp(firebase);
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
  });
  const segno = id => fs.doc(db, "famiglie", id, "info", "famiglia");

  return {
    condiviso: true,
    nome: firebase.projectId,
    async esiste(id) {
      return (await fs.getDocFromServer(segno(id))).exists();
    },
    async crea(id) {
      await fs.setDoc(segno(id), { creata: Date.now() });
    },
    famiglia(id) {
      const col = fs.collection(db, "famiglie", id, "spesa");
      return {
        ascolta(cb, errore) {
          return fs.onSnapshot(col, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), errore);
        },
        aggiungi(el) {
          return fs.addDoc(col, { ...el, comprato: false, creato: Date.now() });
        },
        modifica(id, campi) {
          return fs.updateDoc(fs.doc(col, id), campi);
        },
        elimina(id) {
          return fs.deleteDoc(fs.doc(col, id));
        },
        // rimette un elemento appena eliminato (tasto "Annulla")
        ripristina({ id, ...resto }) {
          return fs.setDoc(fs.doc(col, id), resto);
        }
      };
    }
  };
}

function serverLocale() {
  const leggiJson = (k, vuoto) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? vuoto; } catch { return vuoto; }
  };
  const scriviJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  return {
    condiviso: false,
    nome: "locale",
    async esiste(id) { return leggiJson("spesa:famiglie", []).includes(id); },
    async crea(id) { scriviJson("spesa:famiglie", [...leggiJson("spesa:famiglie", []), id]); },
    famiglia(id) {
      const chiave = "spesa:dati:" + id;
      const ascoltatori = new Set();
      const leggi = () => leggiJson(chiave, []);
      const scrivi = lista => { scriviJson(chiave, lista); ascoltatori.forEach(cb => cb(lista)); };
      window.addEventListener("storage", e => {
        if (e.key === chiave) ascoltatori.forEach(cb => cb(leggi()));
      });
      return {
        ascolta(cb) {
          ascoltatori.add(cb);
          cb(leggi());
          return () => ascoltatori.delete(cb);
        },
        async aggiungi(el) {
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          scrivi([...leggi(), { id, ...el, comprato: false, creato: Date.now() }]);
        },
        async modifica(id, campi) {
          scrivi(leggi().map(x => x.id === id ? { ...x, ...campi } : x));
        },
        async elimina(id) {
          scrivi(leggi().filter(x => x.id !== id));
        },
        async ripristina(el) {
          scrivi([...leggi().filter(x => x.id !== el.id), el]);
        }
      };
    }
  };
}
