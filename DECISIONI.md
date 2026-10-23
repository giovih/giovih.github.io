# Decisioni prese (app Palestra)

Qui scrivo le scelte che ho fatto da solo durante il lavoro, con il motivo.

## 1. PWA invece dell'app Swift
- Sul computer dove lavoro **non c'è Xcode** (`xcodebuild -version` → comando non trovato: è un computer Linux nel cloud).
  Come chiesto, ho costruito una **PWA installabile** (app web da aggiungere alla schermata Home), con la stessa grafica e gli stessi dati.
- L'app sta allo stesso indirizzo di prima: **https://giovih.github.io/palestra/**. Così l'icona che hai già sulla Home apre la nuova app
  e **i tuoi dati vengono importati da soli** al primo avvio (allenamenti, cibo, acqua, creatina, peso, diario, foto).
- La versione precedente resta raggiungibile in `palestra/v1/` (Altro → Versione precedente) per sicurezza.
- Il codice Swift scritto prima (`PalestraApp/`) resta nel repository: non l'ho aggiornato perché qui non posso compilarlo.

## 2. Tecnologia
- **Preact + htm** (16 KB, incluso nel progetto in `palestra/lib/preact.js`): componenti come in React, senza passaggi di compilazione.
  I file si modificano e si pubblicano così come sono.
- Dati sul telefono in **IndexedDB** (più capiente e affidabile di localStorage), tutti caricati in memoria all'avvio: l'app è istantanea anche senza rete.
- **Service worker** con cache versionata: l'app si apre anche in palestra senza internet; quando pubblico una versione nuova si aggiorna da sola
  (ma mai durante un allenamento in corso).

## 3. Grafica
- Le **SF Symbols** di Apple non si possono usare sul web (licenza solo per app Apple): ho disegnato un set di icone nello stesso stile
  (griglia 24×24, tratto arrotondato, varianti piene per la barra delle schede). Nessuna emoji in tutta l'app.
- Font: quello di sistema (**SF Pro** su iPhone), **SF Pro Rounded** per i numeri grandi (come l'app Fitness), cifre tabulari.
- Il testo segue la **dimensione del testo di iOS** (Dynamic Type) grazie a `font: -apple-system-body`.
- **Un solo colore di accento: blu** (#3D8BFF scuro / #1F6FE5 chiaro). I toni delle sedute sono tenui: A ambra, B verde acqua, Gambe rosa, C lavanda, Avambracci sabbia.
- Tema scuro predefinito (sfondo quasi nero, card a livelli di grigio, bordi da 0,5 px); tema chiaro automatico o forzabile in Altro.
- Animazioni con **molle** (curva `linear()` calcolata da una molla reale), feedback aptico: su iPhone il web non può vibrare,
  ma un interruttore nativo nascosto (`<input switch>`, iOS 18+) fa "tic" con il Taptic Engine a ogni serie completata.
- **Tastierino numerico dell'app** al posto di quello di iOS per kg e ripetizioni: tasti grandi, −/+ del passo giusto per l'attrezzo
  (2,5 kg bilanciere e macchine, 1 kg manubri) e il tasto **Avanti** (kg → ripetizioni → "Completa" la serie e fa partire il recupero).

## 4. Allenamento
- I campi delle serie mostrano in **grigio il valore consigliato** dalla doppia progressione; se tocchi la spunta senza scrivere niente
  vengono usati quelli. La colonna "Precedente" mostra l'ultima volta.
- Recupero del timer: la **media dell'intervallo** della scheda arrotondata a 15 s (es. 2-3 min → 2:30), poi −15/+15.
- Superserie: il timer parte solo dopo il secondo esercizio della coppia.
- Lo **schermo resta acceso** durante l'allenamento (Wake Lock), così il timer suona anche senza notifiche.
- Seduta **Avambracci** (wrist curl, reverse wrist curl, hammer curl concentrato, 3 serie ciascuno, 60 s): spenta di default, si attiva
  in Altro scegliendo martedì o giovedì.

## 5. Peso e calorie
- Pesi iniziali inseriti: **56,1 kg** (partenza, alla data di inizio del programma se non c'era già) e **54,7 kg il 23/10/2026**.
- Regole: se in 2 settimane non sali → **+250 kcal**; se il peso scende (anche prima delle 2 settimane) → **+250 kcal**;
  se sali più di 0,7 kg a settimana per più settimane → **−200 kcal ma mai sotto l'obiettivo di partenza (3000 kcal)**:
  così l'app non ti spinge mai a mangiare meno del piano o a dimagrire. Dopo un cambio aspetta 2 settimane di pesate.
- Data di inizio del programma: **12 ottobre 2026** (lunedì della prima settimana in cui hai usato l'app), modificabile.

## 6. Pasti preimpostati
Kcal e proteine sono quelli della tua scheda; carboidrati e grassi li ho stimati dagli ingredienti, controllando che
4×proteine + 4×carboidrati + 9×grassi torni con le calorie (scarto massimo 20 kcal, verificato dai test).
