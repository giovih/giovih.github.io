# Palestra — app iPhone (SwiftUI + SwiftData, iOS 17+)

Tutto offline tranne la stima del cibo e il Coach (API di Anthropic).

## Struttura

```
Palestra/
├─ App/         PalestraApp.swift (avvio, tab, colori)
├─ Models/      dati SwiftData (esercizi, scheda, sedute, serie, cibo, peso, diario)
├─ Logic/       progressione, settimane del ciclo, consigli peso (solo Foundation)
├─ Seed/        la scheda cartacea precaricata
├─ Services/    timer, notifiche, chiave (Portachiavi), AI, blocco app
└─ Features/    schermate: Home, Workout, Cibo, Storico, Coach, Altro
EstensioneBlocco/  estensione per le fasce orarie (solo account a pagamento)
```

## Primo avvio in Xcode (account Apple gratuito)

1. Xcode → File → New → Project → iOS → **App**. Nome `Palestra`, Interface **SwiftUI**, Storage **None**.
2. Cancella `ContentView.swift` e `PalestraApp.swift` creati da Xcode.
3. Trascina la cartella **`Palestra`** (quella con App, Models, Logic…) nel progetto, con
   "Copy items if needed" e "Create groups" selezionati, target Palestra spuntato.
   **Non** trascinare `EstensioneBlocco`.
4. Target Palestra → **General** → Minimum Deployments **iOS 17.0**.
5. Target → **Info** → aggiungi la riga **Privacy - Camera Usage Description** con il testo
   `Per fotografare i pasti`.
6. **Signing & Capabilities** → Team: il tuo Apple ID.
7. iPhone collegato col cavo → Modalità sviluppatore attiva → ▶︎.
   La prima volta: Impostazioni → Generali → VPN e gestione dispositivi → autorizza.

Con l'account gratuito l'app scade dopo 7 giorni: ricollega l'iPhone e premi ▶︎ (i dati restano).

## Blocco app (solo account sviluppatore, 99 €/anno)

1. Signing & Capabilities → **+ Capability** → **Family Controls** e **App Groups**
   (gruppo `group.it.giovi.palestra`, oppure cambialo anche in `AppBlocker.swift` e `BloccoMonitor.swift`).
2. File → New → Target → **Device Activity Monitor Extension**, nome `EstensioneBlocco`.
   Sostituisci il file creato con `EstensioneBlocco/BloccoMonitor.swift`
   e aggiungi anche all'estensione le capability Family Controls e lo stesso App Group.
