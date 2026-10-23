# Avanzamento: app Palestra definitiva

**Xcode non c'è** su questo computer (`xcodebuild -version` → `command not found`, è Linux): come da istruzioni
sto costruendo una **PWA installabile** con notifiche web push, stessa grafica e stessi dati. Dettagli in `DECISIONI.md`.

## Fatto
- [x] **Passo 1 – Base**: design system (colori, tipografia, componenti: Card, PrimaryButton, StatTile, SetRow, ProgressRing,
      Segmented, Toggle, ListRow, EmptyState, Callout, Sheet, Menu, Toast, tastierino), icone in stile SF Symbols,
      struttura del progetto, dati della scheda, archivio locale (IndexedDB), importazione automatica dei dati del sito, test della logica.
- [x] **Passo 2 – Oggi e allenamento**: giorno in grande, settimana con le sedute fatte/previste/saltate, card della seduta
      con anteprima, anelli di calorie e proteine, acqua e creatina in una riga; allenamento a tutto schermo con righe delle serie
      (numero, precedente, kg, ripetizioni, spunta), tastierino con Avanti, menu "..." per esercizio (sostituisci, nota, serie),
      tecnica pulita, superserie, drop set, timer di recupero sfocato con −15/+15/Salta, schermo acceso, riepilogo e "Prossima volta",
      ripresa automatica se l'app viene chiusa. Le notifiche push arrivano con il passo 6 (servono il server e l'account).
- [x] **Passo 3 – Cibo** (stile Yazio): anello delle calorie con quanto manca, barre di proteine/carboidrati/grassi, acqua e creatina,
      i 6 pasti con gli alimenti; aggiunta con ricerca (alimenti di base offline + Open Food Facts), **codice a barre** (fotocamera o
      a mano), **recenti**, **preferiti** (stella), **pasti della scheda con un tocco** (18 pasti), **copia il pasto di ieri**,
      **foto + descrizione con stima AI** (dopo il passo 6), inserimento a mano, modifica e spostamento tra i pasti.
- [ ] Passo 4 – Progressi, agenda, peso
- [ ] Passo 5 – Coach e Altro
- [ ] Passo 6 – Salvataggio online (Supabase) e notifiche dal server
- [ ] Passo 7 – Rifinitura grafica di ogni schermata
- [ ] Passo 8 – Blocco app (facoltativo)

## Struttura
```
palestra/            l'app (PWA)
  index.html app.js sw.js manifest.webmanifest
  lib/               Preact + htm (16 KB)
  core/              logica pura, testata: date, formati, scheda, progressione, nutrizione, promemoria, importazione
  data/              archivio locale (IndexedDB), azioni, timer di recupero, sincronizzazione
  ui/                design system: design.css, screens.css, icone, componenti, fogli, tastierino, aptica
  screens/           le schermate: oggi, allenamento, cibo, progressi, coach, altro
  test/              test (node --test test/*.test.js)
  v1/                la versione precedente, per sicurezza
supabase/            database, funzioni e istruzioni per il salvataggio online (passo 6)
```

## Test
```
cd palestra && node --test test/*.test.js
```
