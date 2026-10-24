// Prova delle API del Supabase locale con setup.sql e le funzioni dell'app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { ANON, SERVICE } from './chiavi.mjs';

const URL_ = 'http://localhost:8000';
const psql = q => execSync(`docker exec -e PGPASSWORD=postgres sb-db psql -U postgres -h localhost -d postgres -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
async function chiama(percorso, { metodo = 'GET', corpo, token, h = {} } = {}) {
  const r = await fetch(URL_ + percorso, { method: metodo, headers: { apikey: ANON, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(corpo !== undefined && !(corpo instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...h }, body: corpo instanceof Blob ? corpo : corpo !== undefined ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, d };
}
async function utente(email) {
  await chiama('/auth/v1/signup', { metodo: 'POST', corpo: { email, password: 'password-di-prova-123' } });
  const r = await chiama('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: 'password-di-prova-123' } });
  assert.equal(r.status, 200, JSON.stringify(r.d));
  return { token: r.d.access_token, id: r.d.user.id };
}
const rpc = (nome, args, token) => chiama('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: args, token });
const aspetta = ms => new Promise(ok => setTimeout(ok, ms));

const suffisso = Date.now();
let A, B;

test('account', async () => {
  A = await utente(`a${suffisso}@prova.it`);
  B = await utente(`b${suffisso}@prova.it`);
  assert.ok(A.token && B.token);
});

test('sync: invio, novità a pagine, vince il più recente, lapidi', async () => {
  let r = await rpc('sync_push', { p_righe: [
    { kind: 'peso', id: '2026-10-23', data: { giorno: '2026-10-23', kg: 54.7 }, updated: 1000, deleted: false },
    { kind: 'sessione', id: 's1', data: { nome: 'Upper A' }, updated: 2000, deleted: false },
    { kind: 'impostazioni', id: 'impostazioni', data: { tema: 'scuro' }, updated: 1, deleted: false },
  ] }, A.token);
  assert.equal(r.status, 200, JSON.stringify(r.d));
  assert.equal(r.d.accettati, 3);
  // versione più vecchia: rifiutata, e torna quella del server
  r = await rpc('sync_push', { p_righe: [{ kind: 'peso', id: '2026-10-23', data: { kg: 50 }, updated: 999, deleted: false }] }, A.token);
  assert.equal(r.d.accettati, 0);
  assert.equal(r.d.rifiutati[0].data.kg, 54.7);
  // stesso istante (record "deboli" su due telefoni): rifiutata
  r = await rpc('sync_push', { p_righe: [{ kind: 'impostazioni', id: 'impostazioni', data: { tema: 'chiaro' }, updated: 1 }] }, A.token);
  assert.equal(r.d.accettati, 0);
  assert.equal(r.d.rifiutati[0].data.tema, 'scuro');
  // più nuova: accettata; cancellazione come lapide
  r = await rpc('sync_push', { p_righe: [{ kind: 'peso', id: '2026-10-23', data: { kg: 55 }, updated: 3000 }, { kind: 'sessione', id: 's1', data: null, updated: 4000, deleted: true }] }, A.token);
  assert.equal(r.d.accettati, 2);
  // novità a pagine con il segnalibro (server_ts, kind, id)
  let p = await rpc('sync_pull', { p_ts: 0, p_kind: '', p_id: '', p_limite: 2 }, A.token);
  assert.equal(p.d.righe.length, 2);
  assert.equal(p.d.altri, true);
  const u = p.d.righe.at(-1);
  const p2 = await rpc('sync_pull', { p_ts: u.server_ts, p_kind: u.kind, p_id: u.id, p_limite: 2 }, A.token);
  assert.equal(p2.d.righe.length, 1);
  assert.equal(p2.d.altri, false);
  const tutte = [...p.d.righe, ...p2.d.righe];
  assert.equal(tutte.find(x => x.kind === 'sessione').deleted, true);
  assert.equal(tutte.find(x => x.kind === 'peso').data.kg, 55);
});

test('ognuno vede solo i suoi dati', async () => {
  const p = await rpc('sync_pull', { p_ts: 0 }, B.token);
  assert.equal(p.d.righe.length, 0);
  const diretto = await chiama('/rest/v1/records?select=kind,id', { token: B.token });
  assert.equal(diretto.d.length, 0);
  const anonimo = await rpc('sync_pull', { p_ts: 0 });
  assert.ok(anonimo.status >= 400);
  const scrittura = await chiama('/rest/v1/records', { metodo: 'POST', corpo: { kind: 'x', id: 'y', updated: 1, data: {} }, token: B.token });
  assert.ok(scrittura.status >= 400, 'scrivere direttamente nella tabella non è permesso');
  const config = await chiama('/rest/v1/push_config?select=*', { token: B.token });
  assert.ok(config.status >= 400 || config.d.length === 0, 'il segreto non si legge');
  const servizio = await rpc('push_da_inviare', { p_limite: 1 }, B.token);
  assert.ok(servizio.status >= 400, 'le funzioni di servizio non sono per gli utenti');
});

test('foto: spazio privato per utente', async () => {
  const img = new Blob([Buffer.from('ffd8ffe000104a464946', 'hex')], { type: 'image/jpeg' });
  let r = await chiama(`/storage/v1/object/foto/${A.id}/f1.jpg`, { metodo: 'POST', corpo: img, token: A.token, h: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } });
  assert.equal(r.status, 200, JSON.stringify(r.d));
  r = await chiama(`/storage/v1/object/foto/${A.id}/f1.jpg`, { metodo: 'POST', corpo: img, token: A.token, h: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } });
  assert.equal(r.status, 200, 'ricaricare la stessa foto funziona (upsert)');
  r = await chiama(`/storage/v1/object/foto/${B.id}/f1.jpg`, { metodo: 'POST', corpo: img, token: A.token, h: { 'Content-Type': 'image/jpeg' } });
  assert.ok(r.status >= 400, 'non posso caricare nella cartella di un altro');
  r = await chiama(`/storage/v1/object/authenticated/foto/${A.id}/f1.jpg`, { token: B.token });
  assert.ok(r.status >= 400, 'non vedo le foto di un altro');
  r = await chiama(`/storage/v1/object/authenticated/foto/${A.id}/f1.jpg`, { token: A.token });
  assert.equal(r.status, 200);
  r = await chiama('/storage/v1/object/foto', { metodo: 'DELETE', corpo: { prefixes: [`${A.id}/f1.jpg`] }, token: A.token });
  assert.equal(r.status, 200);
});

test('funzione push: chiave VAPID e indirizzo salvati', async () => {
  let r = await chiama('/functions/v1/push', { metodo: 'POST', corpo: { azione: 'chiave' } });
  assert.equal(r.status, 401);
  r = await chiama('/functions/v1/push', { metodo: 'POST', corpo: { azione: 'chiave' }, token: A.token });
  assert.equal(r.status, 200, JSON.stringify(r.d));
  assert.equal(Buffer.from(r.d.chiave, 'base64url').length, 65);
  const r2 = await chiama('/functions/v1/push', { metodo: 'POST', corpo: { azione: 'chiave' }, token: B.token });
  assert.equal(r2.d.chiave, r.d.chiave, 'la chiave resta la stessa');
  assert.equal(psql("select valore from public.push_config where chiave = 'url'"), 'http://localhost:8000');
  const falso = await chiama('/functions/v1/push', { metodo: 'POST', corpo: { azione: 'invia' }, h: { 'x-palestra-segreto': 'sbagliato' } });
  assert.equal(falso.status, 401);
});

test('notifiche: prova, recupero e promemoria arrivano cifrati e firmati', async () => {
  const s = await (await fetch('http://127.0.0.1:9100/iscrizione/tel1')).json();
  // il servizio finto è http: lo inserisco direttamente (l'app accetta solo https)
  psql(`insert into public.push_iscrizioni (endpoint, user_id, p256dh, auth) values ('${s.endpoint}', '${A.id}', '${s.keys.p256dh}', '${s.keys.auth}') on conflict (endpoint) do update set user_id = excluded.user_id`);
  const prima = (await (await fetch('http://127.0.0.1:9100/ricevute')).json()).length;
  let r = await rpc('push_prova', {}, A.token);
  assert.equal(r.status, 204, JSON.stringify(r.d));
  const inizio = Date.now();
  r = await rpc('push_recupero', { p_notifica: { tag: 'recupero', invio: new Date(Date.now() + 3000).toISOString(), titolo: 'Recupero finito', testo: 'Prossima serie: Panca piana.', url: './#allenamento' } }, A.token);
  assert.ok(r.status < 300, JSON.stringify(r.d));
  r = await rpc('push_programma', { p_lista: [
    { tag: 'creatina:passata', categoria: 'creatina', invio: new Date(Date.now() - 60000).toISOString(), titolo: 'Creatina', testo: 'vecchia' },
    { tag: 'acqua:presto', categoria: 'acqua', invio: new Date(Date.now() + 2000).toISOString(), titolo: 'Acqua', testo: 'Bevi un bicchiere d\'acqua.' },
    { tag: 'cena:domani', categoria: 'pasti', invio: new Date(Date.now() + 86400000).toISOString(), titolo: 'Cena', testo: 'È ora di cena.' },
  ] }, A.token);
  assert.equal(r.d, 2, 'quella nel passato non viene programmata');
  let arrivate = [];
  for (let i = 0; i < 40; i++) {
    arrivate = (await (await fetch('http://127.0.0.1:9100/ricevute')).json()).slice(prima);
    if (arrivate.length >= 3) break;
    await aspetta(1000);
  }
  console.log('arrivate in', Math.round((Date.now() - inizio) / 1000), 's:', arrivate.map(x => `${x.dati?.titolo} [${x.urgency}, ${x.topic}]`).join(' | '));
  assert.equal(arrivate.length, 3, JSON.stringify(arrivate));
  for (const x of arrivate) {
    assert.equal(x.erroreVapid, null);
    assert.equal(x.erroreCifratura, null);
    assert.equal(x.encoding, 'aes128gcm');
  }
  const rec = arrivate.find(x => x.dati.titolo === 'Recupero finito');
  assert.equal(rec.urgency, 'high');
  assert.equal(rec.topic, 'recupero');
  assert.equal(rec.dati.url, './#allenamento');
  assert.ok(arrivate.some(x => x.dati.testo === 'Le notifiche funzionano.'));
  assert.equal(psql(`select count(*) from public.notifiche where user_id = '${A.id}' and inviata is null`), '1', 'resta solo la cena di domani');
});

test('funzione ai: stima e coach passano dal server, senza emoji', async () => {
  let r = await chiama('/functions/v1/ai', { metodo: 'POST', corpo: { azione: 'stima', descrizione: 'pasta' } });
  assert.equal(r.status, 401);
  r = await chiama('/functions/v1/ai', { metodo: 'POST', corpo: { azione: 'stima', descrizione: 'pasta al pomodoro', immagine: Buffer.from('finta').toString('base64') }, token: A.token });
  assert.equal(r.status, 200, JSON.stringify(r.d));
  assert.equal(r.d.kcal, 650);
  assert.equal(r.d.descrizione, 'Pasta al pomodoro');
  r = await chiama('/functions/v1/ai', { metodo: 'POST', corpo: { azione: 'coach', messaggi: [{ role: 'user', content: 'Come sto andando?' }], riassunto: 'Oggi è sabato.' }, token: A.token });
  assert.equal(r.status, 200, JSON.stringify(r.d));
  assert.ok(r.d.testo.includes('yogurt greco'));
  assert.ok(!/\p{Extended_Pictographic}/u.test(r.d.testo));
  const richieste = await (await fetch('http://127.0.0.1:9200/richieste')).json();
  const [stima, coach] = richieste.slice(-2);
  assert.equal(stima.beta, 'server-side-fallback-2026-07-01');
  assert.equal(stima.versione, '2026-10-21');
  assert.equal(stima.corpo.model, 'claude-opus-5-5');
  assert.equal(stima.corpo.fallbacks, 'default');
  assert.equal(stima.corpo.output_config.effort, 'low');
  assert.equal(stima.corpo.output_config.format.type, 'json_schema');
  assert.deepEqual(stima.corpo.messages[0].tipi, ['image', 'text']);
  assert.equal(coach.corpo.output_config.effort, 'medium');
  assert.equal(coach.corpo.system.length, 2);
  assert.ok(psql(`select richieste from public.ai_uso where user_id = '${A.id}'`) === '2');
});
