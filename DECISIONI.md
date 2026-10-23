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

## 7. Progressi, agenda e grafici
- **Fascia obiettivo del peso**: parte dalla prima pesata e sale di +0,25-0,5 kg a settimana. Quando applichi un cambio di calorie
  (+250 o −200) la fascia **riparte dall'ultima pesata di quel giorno**: da lì, con le calorie nuove, si deve salire di nuovo
  al ritmo giusto. Altrimenti dopo un calo iniziale (56,1 → 54,7) resteresti "sotto" per sempre, anche salendo bene.
- **Grafico del peso**: con 0 pesate un invito a pesarsi (mai un errore), con 1 pesata il punto, con 2 o più la linea morbida
  (interpolazione monotona: non inventa picchi che non ci sono) e la fascia obiettivo. Periodo 1M / 3M / 6M / Tutto.
  Toccando o trascinando il dito sul grafico compare il valore di quel giorno con l'obiettivo; funziona anche con le frecce della
  tastiera e VoiceOver legge i valori. L'elenco "Pesate" sotto è la tabella con tutti i numeri.
- **Ritmo a settimana**: retta dei minimi quadrati sulle pesate delle ultime 4 settimane (più stabile di "ultima meno prima").
- **Colori dei grafici controllati** con un validatore di contrasto e daltonismo: blu per calorie e peso, verde acqua
  (#2AA897 scuro / #1D9886 chiaro) per le proteine, grigio neutro per la fascia obiettivo. Il verde acqua delle proteine
  è un po' più scuro di quello della seduta B perché quello chiaro non passava il controllo sul fondo scuro.
  I toni delle sedute restano tenui: non servono a distinguere i dati, c'è sempre la lettera (A, B, G, C, F) o il nome.
  I testi non sono mai colorati con il colore dei dati.
- **Forza stimata** (1RM, formula di Epley) per il grafico degli esercizi: unisce peso e ripetizioni in un solo numero
  che sale sia quando aggiungi ripetizioni sia quando aggiungi peso. Si può vedere anche il carico o le ripetizioni.
  Negli esercizi a corpo libero senza zavorra si vedono le ripetizioni. Le settimane di scarico sono punti vuoti.
- **Serie per muscolo**: conta il muscolo principale di ogni esercizio, settimana per settimana (da lunedì), con una fascia
  indicativa 10-20 serie. La scheda dà la priorità alla parte alta, quindi le gambe restano sotto: è scritto sotto il grafico.
- **Agenda**: per ogni giorno due mini anelli (calorie fuori, proteine dentro, come l'app Fitness), la lettera della seduta fatta,
  il peso se ti sei pesato e un puntino per le note. Da oggi in avanti si vede la seduta in programma (lettera vuota).
  Tocco un giorno e sotto c'è il dettaglio: allenamento (apre la seduta), peso (si modifica), cibo (apre quel giorno in Cibo),
  acqua e creatina, nota. Si cambia mese con le frecce o scorrendo.
- **Diario** ogni 4 settimane (1, 4, 8, 12…): si compila da solo con l'ultimo peso e la serie migliore delle ultime 4 settimane
  di panca, squat e rematore; si può correggere. Se il peso del diario è di oggi e non ti eri pesato, va anche tra le pesate.
- **Foto di progresso**: miniature, "prima e dopo" affiancate e a schermo intero con una linea da trascinare.
  Restano sul telefono e, con l'account, nello spazio privato di Supabase (passo 6).
