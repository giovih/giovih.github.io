// Due telefoni con lo stesso account: tutto si sincronizza, niente si perde, niente doppioni.
import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';
import { ANON } from './chiavi.mjs';

const APP = 'http://localhost:8765/palestra/?debug';
const EMAIL = `giovanni${Date.now()}@prova.it`, PW = 'password-di-prova-123';
const psql = q => execSync('docker exec -i -e PGPASSWORD=postgres sb-db psql -v ON_ERROR_STOP=1 -U postgres -h localhost -d postgres -tA', { input: q }).toString().trim();
const b = await chromium.launch();
const errori = [];
let ok = 0, ko = 0;
const verifica = (cond, testo) => { if (cond) { ok++; console.log('  ok  ', testo); } else { ko++; console.log('  NO  ', testo); } };

async function telefono(nome, { cloud = true, vecchio = null } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: 'dark', serviceWorkers: 'block' });
  await ctx.addInitScript(([cfg, v]) => {
    if (cfg && !localStorage.getItem('palestra-cloud')) localStorage.setItem('palestra-cloud', JSON.stringify(cfg));
    if (v && !localStorage.getItem('palestra-v1')) localStorage.setItem('palestra-v1', JSON.stringify(v));
  }, [cloud ? { url: 'http://localhost:8000', chiave: ANON } : null, vecchio]);
  const p = await ctx.newPage();
  p.on('pageerror', e => errori.push(`${nome}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errori.push(`${nome}: ${m.text()}`); });
  await p.goto(APP + '#oggi');
  await p.waitForFunction(() => window.__p);
  return { ctx, p, nome };
}
const sync = t => t.p.evaluate(() => window.__p.SY.sincronizzaOra());
const stato = t => t.p.evaluate(() => window.__p.SY.stato());
const conta = (t, kind) => t.p.evaluate(k => window.__p.S.lista(k).length, kind);

console.log('1. Telefono A: crea l\'account dall\'app e inserisce dati');
const A = await telefono('A');
await A.p.click('.tabbar >> text=Altro');
await A.p.click('#pagina-altro .row >> text=Salvataggio online');
await A.p.click('.sotto-pagina .segmented >> text=Crea account');
await A.p.fill('.sotto-pagina input[type=email]', EMAIL);
await A.p.fill('.sotto-pagina input[type=password]', PW);
await A.p.click('.sotto-pagina .btn-primary >> text=Crea account');
await A.p.waitForSelector('.sotto-pagina >> text=Dati al sicuro', { timeout: 15000 });
verifica(true, 'account creato e collegato');
await A.p.evaluate(async () => {
  const { A: az, S } = window.__p;
  az.registraPeso('2026-10-24', 55.1);
  az.aggiungiCibo('2026-10-24', 'pranzo', { nome: 'Pasta al tonno', kcal: 900, prot: 40, carb: 120, grassi: 20 });
  az.aggiungiCibo('2026-10-24', 'cena', { nome: 'Pollo e riso', kcal: 800, prot: 50, carb: 90, grassi: 15 });
  az.impostaNotaGiorno('2026-10-24', 'Allenamento ottimo');
  const id = az.avviaAllenamento('A');
  az.aggiornaSerie(id, 0, 0, { kg: 40, reps: 8 });
  az.spuntaSerie(id, 0, 0);
  az.terminaAllenamento(id);
  S.salvaImpostazioni(i => { i.calendario[7] = 'C'; i.calendario[6] = null; return i; });
  const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#4a6'; x.fillRect(0, 0, 300, 400);
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.8));
  await az.aggiungiFoto(new File([blob], 'a.jpg', { type: 'image/jpeg' }), '2026-10-24');
});
await sync(A);
let s = await stato(A);
verifica(s.fase === 'inattivo' && s.daInviare === 0, `A sincronizzato (fase ${s.fase}, da inviare ${s.daInviare}, errore ${s.errore})`);
const uid = psql(`select id from auth.users where email = '${EMAIL}'`);
verifica(+psql(`select count(*) from public.records where user_id = '${uid}'`) > 5, 'i record sono online');
verifica(psql(`select count(*) from storage.objects where bucket_id = 'foto' and name like '${uid}/%'`) === '2', 'foto e miniatura sono online');

console.log('2. Telefono B (nuovo): accede e ritrova tutto');
const B = await telefono('B');
await B.p.evaluate(([e, pw]) => window.__p.C.accedi(e, pw), [EMAIL, PW]);
await sync(B);
const dB = await B.p.evaluate(() => {
  const { A: az, S } = window.__p;
  return { peso: az.pesi().find(x => x.giorno === '2026-10-24')?.kg, kcal: az.totaliGiorno('2026-10-24').kcal, sedute: az.sessioni().length,
    nota: az.giorno('2026-10-24').nota, domenica: S.impostazioni().calendario[7], sabato: S.impostazioni().calendario[6], foto: az.foto().length };
});
verifica(dB.peso === 55.1 && dB.kcal === 1700 && dB.sedute === 1 && dB.nota === 'Allenamento ottimo', `dati arrivati su B: ${JSON.stringify(dB)}`);
verifica(dB.domenica === 'C' && dB.sabato === null, 'le impostazioni online hanno vinto su quelle iniziali di B');
const blobB = await B.p.evaluate(async () => { const f = window.__p.A.foto()[0]; return [!!(await window.__p.S.leggiBlob(`foto/${f.id}`)), !!(await window.__p.S.leggiBlob(`foto/${f.id}_t`))]; });
verifica(blobB[0] && blobB[1], 'la foto è stata scaricata su B');
const pesiPartenza = await B.p.evaluate(() => window.__p.A.pesi().filter(x => x.kg === 56.1 || x.kg === 54.7).length);
verifica(pesiPartenza === 2, 'pesi di partenza presenti una volta sola');

console.log('3. B modifica e cancella, A riceve');
await B.p.evaluate(async () => {
  const { A: az } = window.__p;
  const cena = az.cibiDelGiorno('2026-10-24').find(c => c.pasto === 'cena');
  az.eliminaCibo(cena.id);
  az.registraPeso('2026-10-24', 55.3);
  await az.eliminaFoto(az.foto()[0].id);
});
await sync(B);
await sync(A);
const dA = await A.p.evaluate(async () => { const { A: az, S } = window.__p; return { kcal: az.totaliGiorno('2026-10-24').kcal, peso: az.pesi().find(x => x.giorno === '2026-10-24')?.kg, foto: az.foto().length, blob: (await S.blobDaCaricare()).length }; });
verifica(dA.kcal === 900 && dA.peso === 55.3 && dA.foto === 0, `modifiche arrivate su A: ${JSON.stringify(dA)}`);
verifica(psql(`select count(*) from storage.objects where bucket_id = 'foto' and name like '${uid}/%'`) === '0', 'foto cancellata anche online');

console.log('4. Modifiche senza rete: vince la più recente, niente si perde');
await A.ctx.setOffline(true);
await A.p.evaluate(() => { window.__p.A.registraPeso('2026-10-25', 55.0); window.__p.A.aggiungiCibo('2026-10-25', 'colazione', { nome: 'Latte', kcal: 300, prot: 15, carb: 30, grassi: 10 }); });
await sync(A);
s = await stato(A);
verifica(s.fase === 'offline' && s.daInviare >= 2, `A senza rete tiene le modifiche (fase ${s.fase}, da inviare ${s.daInviare})`);
await B.p.waitForTimeout(50);
await B.p.evaluate(() => window.__p.A.registraPeso('2026-10-25', 55.4));   // più recente
await sync(B);
await A.ctx.setOffline(false);
await A.p.evaluate(() => window.dispatchEvent(new Event('online')));
await A.p.waitForTimeout(400);
await sync(A); await sync(B);
const pesi = await Promise.all([A, B].map(t => t.p.evaluate(() => window.__p.A.pesi().find(x => x.giorno === '2026-10-25')?.kg)));
const latte = await Promise.all([A, B].map(t => t.p.evaluate(() => window.__p.A.cibiDelGiorno('2026-10-25').length)));
verifica(pesi[0] === 55.4 && pesi[1] === 55.4, `stesso peso su tutti e due (vince il più recente): ${pesi}`);
verifica(latte[0] === 1 && latte[1] === 1, 'la colazione fatta offline è arrivata anche su B');

console.log('5. Reinstallazione: un telefono nuovo ritrova tutto, senza doppioni');
const C = await telefono('C');
await C.p.evaluate(([e, pw]) => window.__p.C.accedi(e, pw), [EMAIL, PW]);
await sync(C);
const nA = await Promise.all(['sessione', 'cibo', 'peso', 'giorno'].map(k => conta(A, k)));
const nC = await Promise.all(['sessione', 'cibo', 'peso', 'giorno'].map(k => conta(C, k)));
verifica(JSON.stringify(nA) === JSON.stringify(nC), `stessi record su A e C: ${nA} / ${nC}`);
await sync(A);
const nA2 = await Promise.all(['sessione', 'cibo', 'peso', 'giorno'].map(k => conta(A, k)));
verifica(JSON.stringify(nA) === JSON.stringify(nA2), 'nessun doppione dopo un altro giro');

console.log('6. Dati della versione precedente salvati online (tabella "stato")');
psql(`create table if not exists public.stato (user_id uuid primary key default auth.uid() references auth.users on delete cascade, dati jsonb not null, aggiornato timestamptz not null default now()); alter table public.stato enable row level security; drop policy if exists "solo i miei dati" on public.stato; create policy "solo i miei dati" on public.stato for all using (auth.uid() = user_id) with check (auth.uid() = user_id); grant all on public.stato to authenticated;`);
const vecchio = { sedute: [{ id: 77, data: '2026-10-14T16:00:00.000Z', fine: '2026-10-14T17:00:00.000Z', codice: 'B', voci: [{ ex: 'Panca inclinata manubri', serie: 4, min: 8, max: 10, sets: [{ kg: 20, reps: 8, fatto: true }] }] }],
  schede: {}, peso: [{ data: '2026-10-16', kg: 55.6 }], cibo: {}, diario: [] };
psql(`insert into public.stato (user_id, dati) values ('${uid}', '${JSON.stringify(vecchio).replace(/'/g, "''")}') on conflict (user_id) do update set dati = excluded.dati`);
execSync(`docker exec sb-rest kill -USR1 1 || true`);
await new Promise(ok => setTimeout(ok, 1500));
const D = await telefono('D');
await D.p.evaluate(([e, pw]) => window.__p.C.accedi(e, pw), [EMAIL, PW]);
await sync(D);
const dD = await D.p.evaluate(() => ({ sedute: window.__p.A.sessioni().length, peso16: window.__p.A.pesi().find(x => x.giorno === '2026-10-16')?.kg }));
verifica(dD.sedute === 2 && dD.peso16 === 55.6, `vecchi dati recuperati: ${JSON.stringify(dD)}`);
await sync(A);
verifica(await A.p.evaluate(() => window.__p.A.sessioni().length) === 2, 'e arrivano anche sugli altri telefoni');

console.log('7. Coach e stima del cibo attraverso la funzione "ai" del server');
const coach = await A.p.evaluate(async () => (await import('./data/ai.js')).chiediCoach([{ ruolo: 'io', testo: 'Come sto andando?' }], 'dati'));
verifica(coach.includes('yogurt greco'), 'il Coach risponde');
await A.p.click('.tabbar >> text=Coach');
await A.p.fill('.scrivi textarea', 'E per la panca?');
await A.p.click('.scrivi .invia');
await A.p.waitForSelector('.bolla.coach', { timeout: 15000 });
verifica(await A.p.locator('.bolla.coach').count() >= 1, 'la chat dell\'app mostra la risposta');
await A.p.screenshot({ path: 'e2e-coach.png' });

console.log(`\n${ok} ok, ${ko} no`);
console.log(errori.length ? errori : 'nessun errore nelle pagine');
await b.close();
process.exit(ko ? 1 : 0);
