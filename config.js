// Impostazioni dell'app.
//
// Il server (Firebase) di solito NON si scrive qui: si collega dall'app
// (tocca il pallino in alto → "Collega il server") e poi si invitano gli altri
// telefoni con il link o il codice QR. Se però vuoi che sia già dentro l'app
// per tutti, incolla qui i dati di firebaseConfig, ad esempio:
//
//   firebase: {
//     apiKey: "AIza...",
//     authDomain: "spesa-famiglia.firebaseapp.com",
//     projectId: "spesa-famiglia",
//     appId: "1:1234567890:web:abcdef"
//   },

export const CONFIG = {
  firebase: null,

  // colore e colore2 formano la sfumatura dell'avatar e della pagina di ognuno
  persone: [
    { id: "gio",   nome: "Gio",   colore: "#4f8cff", colore2: "#1d4ed8" },
    { id: "bea",   nome: "Bea",   colore: "#ff5fa2", colore2: "#c2185b" },
    { id: "luca",  nome: "Luca",  colore: "#ff9147", colore2: "#d9480f" },
    { id: "ori",   nome: "Ori",   colore: "#a77bff", colore2: "#6d28d9" }
  ]
};
