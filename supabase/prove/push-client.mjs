// L'app attiva le notifiche: si iscrive, manda i promemoria dei prossimi 14 giorni e programma il recupero.
import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';
import { ANON } from './chiavi.mjs';
const psql = q => execSync('docker exec -i -e PGPASSWORD=postgres sb-db psql -U postgres -h localhost -d postgres -tA', { input: q }).toString().trim();
const EMAIL = `notifiche${Date.now()}@prova.it`, PW = 'password-di-prova-123';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, permissions: ['notifications'] });
await ctx.addInitScript(([cfg]) => {
  if (!localStorage.getItem('palestra-cloud')) localStorage.setItem('palestra-cloud', JSON.stringify(cfg));
  // il browser di prova non ha il servizio push di Apple/Google: simulo l'iscrizione
  const finta = { endpoint: 'https://push.prova.example/sub/123', options: {}, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BPlcTl-7oQRDEcJtsCwoMFlUxgE1JVk9qo1ViPdHUjN58uSuNhg15bYfqKl-0Z5TFxZoLgkT3kOKu4chWh4L7GM', auth: 'a9LA-MyAg-1xmPyTbZdDxw' } }; }, unsubscribe: async () => true };
  // Chromium senza finestra dice sempre "denied" anche con il permesso dato: lo correggo per il test
  Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
  Notification.requestPermission = async () => 'granted';
  let attiva = null;
  if (window.PushManager) {
    PushManager.prototype.subscribe = async function (opz) { finta.options = opz; attiva = finta; return finta; };
    PushManager.prototype.getSubscription = async function () { return attiva; };
  }
}, [{ url: 'http://localhost:8000', chiave: ANON }]);
const p = await ctx.newPage();
const errori = [];
p.on('pageerror', e => errori.push(e.message));
await p.goto('http://localhost:8765/palestra/?debug#altro');
await p.waitForFunction(() => window.__p);
await p.evaluate(async ([e, pw]) => { await window.__p.C.registrati(e, pw); }, [EMAIL, PW]);
await p.waitForFunction(() => window.__p.C.collegato());
// Altro → Notifiche → Attiva
await p.click('#pagina-altro .row:has(.row-title:text-is("Notifiche"))');
await p.waitForTimeout(600);
await p.screenshot({ path: 'push-dbg.png' });
console.log('sotto-pagine:', await p.locator('.sotto-pagina').count(), await p.evaluate(() => document.querySelector('.sotto-pagina .nb-title')?.textContent));
const testoStato = await p.locator('.stato-notifiche .co-title').textContent({ timeout: 8000 });
console.log('stato iniziale della pagina:', testoStato);
const bottone = p.locator('.stato-notifiche .btn-primary');
if (await bottone.count()) await bottone.click();
await p.waitForSelector('.sotto-pagina >> text=Notifiche attive', { timeout: 15000 });
const uid = psql(`select id from auth.users where email = '${EMAIL}'`);
console.log('iscrizione salvata:', psql(`select count(*) from public.push_iscrizioni where user_id = '${uid}'`) === '1');
console.log('promemoria programmati:', psql(`select count(*) from public.notifiche where user_id = '${uid}' and inviata is null`));
console.log('esempi:', psql(`select categoria || ' ' || to_char(invio at time zone 'Europe/Rome', 'DD/MM HH24:MI') || ' ' || titolo from public.notifiche where user_id = '${uid}' order by invio limit 4`).replace(/\n/g, ' | '));
// un allenamento: il timer di recupero programma la notifica sul server
await p.evaluate(() => {
  const { A } = window.__p;
  const id = A.avviaAllenamento('A');
  A.aggiornaSerie(id, 0, 0, { kg: 40, reps: 8 });
  A.spuntaSerie(id, 0, 0);
});
await p.evaluate(async () => { const R = await import('./data/rest.js'); R.avvia(150, 'Panca piana'); });
await p.waitForTimeout(1500);
console.log('recupero programmato:', psql(`select titolo || ' - ' || testo || ' tra ' || round(extract(epoch from invio - now())) || ' s' from public.notifiche where user_id = '${uid}' and tag = 'recupero' and inviata is null`));
await p.evaluate(async () => { const R = await import('./data/rest.js'); R.salta(); });
await p.waitForTimeout(1500);
console.log('recupero annullato quando salto:', psql(`select count(*) from public.notifiche where user_id = '${uid}' and tag = 'recupero' and inviata is null`) === '0');
// creatina segnata: il promemoria di oggi sparisce
const prima = psql(`select count(*) from public.notifiche where user_id = '${uid}' and categoria = 'creatina' and inviata is null`);
await p.evaluate(() => window.__p.A.impostaCreatina(new Date(Date.now() + 86400000).toISOString().slice(0, 10), true));
await p.evaluate(() => { window.__notifiche = 0; window.__p.S.ascolta(() => { window.__notifiche++; }); });
const t0 = await p.evaluate(() => window.__p.S.getMeta('pushProgrammato'));
await p.waitForTimeout(6000);
console.log('debug:', JSON.stringify(await p.evaluate(() => ({
  locali: window.__p.P.prossimiPromemoria(14).filter(x => x.categoria === 'creatina').length,
  programmato: window.__p.S.getMeta('pushProgrammato'), endpoint: !!window.__p.S.getMeta('pushEndpoint'),
  permesso: window.__p.P.permesso(), collegato: window.__p.C.collegato(), notifiche: window.__notifiche,
}))), 'prima:', t0);
console.log('chiamata diretta:', await p.evaluate(async () => { try { await window.__p.P.programmaPromemoria(true); return 'ok ' + window.__p.S.getMeta('pushProgrammato'); } catch (e) { return 'errore: ' + e.message; } }));
console.log('creatina:', prima, '→', psql(`select count(*) from public.notifiche where user_id = '${uid}' and categoria = 'creatina' and inviata is null`));
await p.setViewportSize({ width: 390, height: 1400 });
await p.screenshot({ path: 'push-attive.png' });
console.log(errori.length ? errori : 'nessun errore');
await b.close();
