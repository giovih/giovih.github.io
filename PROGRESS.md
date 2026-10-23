# Avanzamento: app Palestra definitiva

**Xcode non c'è** su questo computer (`xcodebuild -version` → `command not found`, è Linux): come da istruzioni
sto costruendo una **PWA installabile** con notifiche web push, stessa grafica e stessi dati. Dettagli in `DECISIONI.md`.

## Fatto
- [x] **Passo 1 – Base**: design system (colori, tipografia, componenti: Card, PrimaryButton, StatTile, SetRow, ProgressRing,
      Segmented, Toggle, ListRow, EmptyState, Callout, Sheet, Menu, Toast, tastierino), icone in stile SF Symbols,
      struttura del progetto, dati della scheda, archivio locale (IndexedDB), importazione automatica dei dati del sito, test della logica.
- [ ] Passo 2 – Oggi e allenamento (in corso: schermate fatte, mancano le notifiche push)
- [ ] Passo 3 – Cibo
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
