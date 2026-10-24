# Prove del backend (Supabase locale)

Queste prove avviano un Supabase completo sul computer (Docker) e controllano `../setup.sql` e le funzioni `../functions`.
Non servono per usare l'app: sono per chi modifica il server.

1. `npm install` (in questa cartella) e Docker acceso.
2. `./avvia.sh` avvia database, accesso, API, foto e funzioni sulla rete del computer
   (porte 5432, 9999, 3000, 5000, 9000). Poi in due terminali: `node gateway.mjs` (porta 8000, fa da Kong)
   e `node finti.mjs` (servizio push finto sulla 9100 che verifica firma e cifratura, AI finta sulla 9200).
3. Applica il database: `docker cp ../setup.sql sb-db:/tmp/setup.sql` e
   `docker exec -e PGPASSWORD=postgres sb-db psql -U postgres -h localhost -d postgres -f /tmp/setup.sql`.
4. Servi il sito: `python3 -m http.server 8765` dalla cartella principale del repository.
5. Prove: `node --test api.test.mjs` (API, sicurezza, foto, notifiche, AI), `node e2e.mjs` (due telefoni con lo stesso
   account), `node push-client.mjs` (attivazione delle notifiche dall'app).

Le chiavi sono di prova e valgono solo in locale. Se il computer usa un proxy, `avvia.sh` lo passa alle funzioni
(variabili `HTTPS_PROXY` e `CA_BUNDLE`).
