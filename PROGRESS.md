# Avanzamento: app Palestra definitiva

**Xcode non c'è** su questo computer (`xcodebuild -version` → `command not found`, è Linux): come da istruzioni
ho costruito una **PWA installabile** con notifiche web push, stessa grafica e stessi dati. Dettagli in `DECISIONI.md`.
Tutti gli 8 passi sono fatti. Restano solo le cose che richiedono un account (sotto, "Da fare domattina").

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
- [x] **Passo 4 – Progressi**: quattro sezioni.
      **Corpo**: peso grande con "dall'inizio", ritmo a settimana e obiettivo di oggi; grafico (mai errori: 1 valore = punto,
      2 o più = linea + fascia obiettivo) con valore al tocco; consiglio sulle calorie con il tasto per applicarlo; elenco delle
      pesate; foglio per registrare il peso (−/+ 0,1 kg, giorno); foto di progresso con prima/dopo affiancate e a scorrimento.
      **Allenamenti**: sedute della settimana e del mese, durata media, serie per muscolo con fascia 10-20, grafico di ogni
      esercizio (forza stimata, carico, ripetizioni), ultime volte, storico con il dettaglio di ogni seduta (e "elimina").
      **Agenda**: calendario del mese con anelli di calorie e proteine, seduta, peso e note; dettaglio del giorno toccato.
      **Diario**: ogni 4 settimane, compilato da solo dai dati.
- [x] **Passo 5 – Coach e Altro**.
      **Coach**: spunti automatici della settimana (anche senza account e senza internet), chat con l'AI (bolle, elenchi,
      grassetto, "Riprova"), domande di esempio, "Cosa sa il Coach". La chat si attiva collegando l'account (passo 6).
      **Altro**: salvataggio online (progetto, accesso, stato), scheda e calendario con editor completo delle sedute,
      orari della palestra, avambracci, inizio programma, obiettivi, notifiche (ogni tipo con orario e interruttore),
      tema, backup (esporta/importa, anche il vecchio formato), versione precedente, guida al blocco delle app,
      privacy, crediti, cancella tutto.
- [x] **Passo 6 – Salvataggio online e notifiche dal server** (Supabase).
      Database con regole di sicurezza (ognuno vede solo i suoi dati), sincronizzazione record per record
      (vince la modifica più recente, niente doppioni, cancellazioni comprese), funziona offline e manda tutto quando torna la rete,
      foto di progresso nello spazio privato, recupero dei dati della vecchia app salvati online, reinstallazione = ritrovi tutto.
      Notifiche push dal server: recupero finito (anche a telefono bloccato), allenamento, pasti, pesata, creatina, acqua.
      AI (stima del cibo e Coach) attraverso la funzione `ai`: la chiave di Anthropic sta solo su Supabase.
      **Provato davvero** con un Supabase completo sul computer: 7 prove delle API, 19 prove con due telefoni simulati,
      notifiche controllate con firma e cifratura verificate da una libreria indipendente. Da fare domattina: i passi qui sotto.
- [x] **Passo 7 – Rifinitura**: giro di tutte le schermate in tema scuro e chiaro, con dati veri e con l'app vuota
      (mai errori, sempre uno stato vuoto con un'azione); contrasto del testo controllato schermata per schermata
      (pulsanti pieni con un blu più profondo, tema chiaro più leggibile), aree di tocco più grandi, nessuna emoji,
      schermate di avvio per iPhone (niente lampo bianco), guida **Prepara il server** dentro l'app con i pulsanti per copiare il codice.
      La versione precedente in `/v1/` ora non ha più emoji né il campo per la chiave dell'AI.
- [x] **Passo 8 – Blocco app**: un'app web non può bloccare le altre app (Apple lo permette solo alle app native con il permesso
      Family Controls). In **Altro → Blocca le distrazioni** c'è la guida con Tempo di utilizzo, Comandi e Full immersion.
      Il codice Swift per il blocco vero è in `PalestraApp/` (vedi sotto).

## Prova subito (gratis, 1 minuto)
1. Sull'iPhone apri **Safari** e vai su `https://giovih.github.io/palestra/`.
2. Tocca **Condividi** (il quadrato con la freccia) e poi **Aggiungi alla schermata Home**. Se c'era già l'icona della vecchia app,
   va bene quella: si aggiorna da sola e i tuoi dati vengono importati al primo avvio.
3. Apri Palestra **dall'icona**. Funziona subito, anche senza internet: allenamenti, timer, cibo, peso, progressi, agenda, spunti del Coach.
4. Se vedi ancora la vecchia versione: chiudi l'app (scorri verso l'alto dal basso e toglila) e riaprila. Al massimo serve farlo due volte.

Senza i passi qui sotto mancano solo: salvataggio online, notifiche con l'app chiusa, chat del Coach e stima del cibo dalla foto.
Il timer di recupero suona comunque finché l'app è aperta (durante l'allenamento lo schermo resta acceso).

## Da fare domattina: salvataggio online, notifiche e AI (circa 20 minuti)

**Il modo più semplice è dal telefono:** apri l'app, **Altro → Salvataggio online → Prepara il server**. Ci sono gli stessi passi
scritti qui sotto e i pulsanti **Copia** per il codice del database e delle due funzioni (niente file da cercare su GitHub).
Se ti blocchi, va bene farli con un genitore. Servono per: salvataggio online, notifiche ad app chiusa, Coach e stima del cibo dalla foto.

**1. Crea il progetto Supabase (gratis)**
1. Vai su **supabase.com**, premi **Start your project** e accedi con GitHub.
2. **New project**: nome `palestra`, scegli una password per il database (premi *Generate* e salvala), regione
   **Central EU (Frankfurt)**, piano **Free**. Premi **Create new project** e aspetta un paio di minuti.

**2. Prepara il database**
1. Nel menu a sinistra apri **SQL Editor**, poi **New query**.
2. Nell'app premi **Copia il codice del database** (oppure su GitHub: cartella `supabase`, file `setup.sql`, tasto *Copy raw file*),
   incolla tutto e premi **Run**. Deve finire senza errori rossi. Si può rieseguire quando vuoi: non cancella niente.

**3. Crea le due funzioni del server**
1. Nel menu a sinistra apri **Edge Functions**, poi **Deploy a new function** e scegli **Via Editor**.
2. Nome: `ai`. Cancella il codice di esempio e incolla la funzione ai (nell'app: **Copia la funzione ai**; su GitHub:
   `supabase/functions/ai/index.ts`). Premi **Deploy function**.
3. Rifai lo stesso con nome `push` e la funzione push (`supabase/functions/push/index.ts`).
4. Per **tutte e due** le funzioni: apri la funzione, scheda **Details** (o *Settings*), spegni **Enforce JWT verification**
   (a volte si chiama *Verify JWT with legacy secret*) e salva. Le funzioni controllano già da sole chi le chiama.

**4. La chiave dell'AI (solo sul server)**
1. Serve un account su **console.anthropic.com**. Le regole di Anthropic richiedono un adulto: fallo creare a un genitore.
   Nella console: **Settings → API Keys → Create Key**, e in **Billing** aggiungi un po' di credito (bastano pochi euro).
   Costo indicativo: circa 2-3 centesimi per una foto stimata e 3-6 centesimi per un messaggio al Coach;
   la funzione blocca comunque a 80 richieste al giorno.
2. Su Supabase: **Edge Functions → Secrets** (a volte *Manage secrets*), **Add new secret**:
   nome `ANTHROPIC_API_KEY`, valore = la chiave (inizia con `sk-ant-`). Salva. La chiave non va mai scritta nell'app né su GitHub.

**5. Indirizzo dell'app per l'accesso**
1. **Authentication → URL Configuration**: in **Site URL** scrivi `https://giovih.github.io/palestra/` e salva.
2. In **Redirect URLs** premi **Add URL** e aggiungi `https://giovih.github.io/palestra/**`.

**6. Collega l'app**
1. Su Supabase apri **Project Settings → API Keys** (o *Data API*): copia **Project URL** e la chiave **Publishable**
   (nei progetti vecchi si chiama *anon public*). Sono chiavi pubbliche: si possono mettere nell'app.
2. Nell'app: **Altro → Salvataggio online**, incolla indirizzo e chiave, premi **Salva**.
3. Scegli **Crea account**, scrivi email e una password (almeno 8 caratteri).
4. Ti arriva un'email di conferma: tocca il link (si apre Safari, va bene: serve solo a confermare),
   poi torna nell'app e premi **Accedi** con la stessa email e password. In Altro vedi "Sincronizzato ora".
5. Consigliato, dopo aver creato il tuo account: **Authentication → Sign In / Providers**, spegni
   **Allow new users to sign up** e salva. Così nessun altro può creare account nel tuo progetto.

**7. Attiva le notifiche**
1. Apri Palestra **dall'icona sulla schermata Home** (le notifiche funzionano solo così, con iOS 16.4 o più recente).
2. **Altro → Notifiche → Attiva le notifiche**, poi **Consenti**. Premi **Manda una notifica di prova**: arriva in pochi secondi.
3. Ogni promemoria (allenamento 1 ora prima, pranzo pre-allenamento, merenda, cena, prima di dormire, creatina, acqua, pesata)
   si accende, si spegne e si sposta di orario lì.

**Limiti da sapere**
- Il piano gratuito di Supabase mette in pausa il progetto dopo circa una settimana senza utilizzo. Se succede: entra su
  supabase.com e premi **Restore project**. Nel frattempo l'app funziona normalmente e sincronizza dopo.
- Le notifiche arrivano dal server, quindi serve internet (anche solo per riceverle). In palestra senza rete il timer suona
  comunque nell'app, che tiene lo schermo acceso durante l'allenamento.
- Le **Live Activity** (il timer sulla schermata di blocco come nelle app native) non esistono per le app web:
  al loro posto arriva la notifica "Recupero finito".

## Blocco delle app (passo 8)
- **Nell'app web non si può**: Safari non dà a nessun sito il permesso di bloccare altre app (Screen Time è solo per le app native).
- **Cosa usare adesso** (gratis, già spiegato in **Altro → Blocca le distrazioni**): *Tempo di utilizzo → Limitazioni app*
  per i social, *Tempo di inattività* per la sera, un'automazione di **Comandi** che apre Palestra quando apri TikTok o Instagram,
  e una **Full immersion "Palestra"** che si attiva all'orario della palestra.
- **Blocco vero dentro l'app**: il codice Swift è pronto in `PalestraApp/` (servizio `AppBlocker.swift` ed estensione `EstensioneBlocco/`).
  Serve un Mac con Xcode, un iPhone collegato con il cavo e un **account sviluppatore Apple a pagamento (99 euro l'anno)**:
  con l'account gratuito la funzione Family Controls non si può attivare. Le istruzioni sono in `PalestraApp/LEGGIMI.md`.
  Nota: l'app Swift è il primo prototipo e non ha tutte le novità della versione web.

## Struttura
```
palestra/            l'app (PWA)
  index.html app.js sw.js manifest.webmanifest
  lib/               Preact + htm (16 KB)
  core/              logica pura, testata: date, formati, scheda, progressione, nutrizione, statistiche, promemoria, importazione
  data/              archivio locale (IndexedDB), azioni, timer di recupero, sincronizzazione
  ui/                design system: design.css, screens.css, icone, componenti, grafici, fogli, tastierino, aptica
  screens/           le schermate: oggi, allenamento, cibo, progressi (corpo, allenamenti, agenda, diario), coach, altro
  icons/             icona dell'app e schermate di avvio per iPhone
  test/              test (node --test test/*.test.js)
  v1/                la versione precedente, per sicurezza
supabase/            setup.sql (database), functions/ai e functions/push (funzioni del server), prove/ (prove automatiche)
```

## Test
```
cd palestra && npm test                 # 51 prove della logica (progressione, calorie, statistiche, coach, sincronizzazione)
```
Le prove del server (Supabase completo in locale con Docker: sincronizzazione, foto, notifiche cifrate, AI) sono spiegate
in `supabase/prove/README.md`.
