# La nostra spesa

La lista della spesa di famiglia di Gio, Bea, Luca e Ori.

**App:** https://giovih.github.io/

Si installa sul telefono: con Safari su iPhone (Condividi → Aggiungi alla schermata Home)
o con Chrome su Android (⋮ → Installa app).

Il codice sorgente e le istruzioni complete (server Firebase, password, invito con QR) sono in
`giovih/cf`, cartella `spesa/`. In questo repository c'è solo la copia pubblicata dell'app:
nessun dato e nessuna password.

---

# Armadio – il mio outfit

L'outfit da lunedì a venerdì, scelto in base al meteo (temperatura percepita, fresco del
mattino, pioggia) con i vestiti fotografati del proprio armadio.

**App:** https://giovih.github.io/armadio/ — su Android: apri il link con Chrome → ⋮ → **Installa app**.

**APK per Android:** https://github.com/giovih/giovih.github.io/releases/download/armadio-apk/Armadio.apk
— scaricalo dal telefono, aprilo e consenti "Installa app sconosciute" quando Android lo chiede.
L'APK si ricompila da solo (GitHub Actions, `.github/workflows/armadio-apk.yml`) a ogni modifica
di `armadio/`; le nuove versioni si installano sopra la vecchia senza perdere l'armadio.
Il progetto Android (Capacitor) è in `armadio-android/`.

- **Armadio**: fotografa i capi o caricane tanti insieme dalla galleria; il colore viene
  riconosciuto dalla foto. Per ogni capo: tipo, quanto tiene caldo, stile, impermeabile.
- **Settimana**: un outfit per ogni giorno, senza ripetere la stessa maglia e con colori che
  stanno bene insieme. Tocca un capo → "È sporco" (va nel bucato e viene sostituito in tutti i
  giorni), "Non mi va" (cambia solo quel giorno) o "Scelgo io". "Altro outfit" propone
  un'alternativa, il lucchetto la fissa.
- **Valigia**: scegli i capi che porti in vacanza; l'app propone gli abbinamenti solo tra quelli,
  giorno per giorno col meteo della meta (se le date sono entro le previsioni) oppure per tipo di
  tempo (caldo, mite, fresco, freddo). Segnala anche i capi che non stanno bene con nient'altro.
- **Bucato**: con "L'ho indossato" i capi contano gli utilizzi e vanno da soli nel bucato;
  "Lavato" li rimette nell'armadio.
- Meteo da [Open-Meteo](https://open-meteo.com) (gratuito, senza chiavi). Foto e dati restano
  sul telefono; da Impostazioni si salva/ripristina una copia di sicurezza.

Codice nella cartella `armadio/` (la logica di scelta è in `armadio/stilista.js`).
