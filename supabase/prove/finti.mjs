// Servizi finti per i test: "push" (fa da servizio di Apple/Google e decifra davvero) e "ai" (fa da API di Anthropic).
import http from 'node:http';
import crypto from 'node:crypto';
import ece from 'http_ece';

/* ---------- servizio push ---------- */
const iscrizioni = {};   // nome → { ecdh, auth }
const ricevute = [];
function iscrizione(nome) {
  if (!iscrizioni[nome]) {
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    iscrizioni[nome] = { ecdh, auth: crypto.randomBytes(16) };
  }
  const s = iscrizioni[nome];
  return { endpoint: `http://127.0.0.1:9100/sub/${nome}`, keys: { p256dh: s.ecdh.getPublicKey().toString('base64url'), auth: s.auth.toString('base64url') } };
}
function verificaVapid(header, aud) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(header || '');
  if (!m) return 'header Authorization non valido';
  const [h, p, f] = m[1].split('.');
  const testa = JSON.parse(Buffer.from(h, 'base64url')), corpo = JSON.parse(Buffer.from(p, 'base64url'));
  if (testa.alg !== 'ES256') return 'alg';
  if (corpo.aud !== aud) return `aud ${corpo.aud} != ${aud}`;
  if (!(corpo.exp > Date.now() / 1000 && corpo.exp < Date.now() / 1000 + 24 * 3600)) return 'exp';
  if (!/^(mailto:|https:)/.test(corpo.sub || '')) return 'sub';
  const raw = Buffer.from(m[2], 'base64url');
  const chiave = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33, 65).toString('base64url') }, format: 'jwk' });
  const ok = crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: chiave, dsaEncoding: 'ieee-p1363' }, Buffer.from(f, 'base64url'));
  return ok ? null : 'firma VAPID non valida';
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname.startsWith('/iscrizione/')) { res.end(JSON.stringify(iscrizione(u.pathname.split('/')[2]))); return; }
  if (req.method === 'GET' && u.pathname === '/ricevute') { res.end(JSON.stringify(ricevute)); return; }
  if (req.method === 'POST' && u.pathname.startsWith('/sub/')) {
    const nome = u.pathname.split('/')[2];
    const pezzi = [];
    req.on('data', c => pezzi.push(c));
    req.on('end', () => {
      const s = iscrizioni[nome];
      if (!s) { res.writeHead(410); return res.end(); }
      const errore = verificaVapid(req.headers.authorization, 'http://127.0.0.1:9100');
      let testo = null, erroreDec = null;
      try {
        testo = ece.decrypt(Buffer.concat(pezzi), { version: 'aes128gcm', privateKey: s.ecdh, authSecret: s.auth }).toString();
      } catch (e) { erroreDec = String(e); }
      ricevute.push({ nome, ora: Date.now(), ttl: req.headers.ttl, urgency: req.headers.urgency, topic: req.headers.topic,
        encoding: req.headers['content-encoding'], erroreVapid: errore, erroreCifratura: erroreDec, dati: testo ? JSON.parse(testo) : null });
      res.writeHead(errore || erroreDec ? 400 : 201); res.end();
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(9100, () => console.log('push finto su :9100'));

/* ---------- AI finta ---------- */
const richieste = [];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/richieste') { res.end(JSON.stringify(richieste)); return; }
  const pezzi = [];
  req.on('data', c => pezzi.push(c));
  req.on('end', () => {
    const corpo = JSON.parse(Buffer.concat(pezzi).toString() || '{}');
    richieste.push({ path: u.pathname, beta: req.headers['anthropic-beta'], versione: req.headers['anthropic-version'],
      auth: !!(req.headers.authorization || req.headers['x-api-key']), corpo: { ...corpo, messages: corpo.messages?.map(m => ({ role: m.role, tipi: Array.isArray(m.content) ? m.content.map(c => c.type) : 'text' })) } });
    const json = corpo.output_config?.format
      ? JSON.stringify({ descrizione: 'Pasta al pomodoro 🍝', kcal: 650, kcal_min: 550, kcal_max: 760, proteine: 21.4, carboidrati: 112.6, grassi: 12.2, note: 'Porzione da circa 120 g di pasta.' })
      : 'Stai andando **bene**. Per le proteine:\n- yogurt greco a merenda\n- latte a colazione 💪';
    res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_finta' });
    res.end(JSON.stringify({ id: 'msg_finto', type: 'message', role: 'assistant', model: corpo.model, stop_reason: 'end_turn', stop_details: null,
      content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: json }], usage: { input_tokens: 100, output_tokens: 50 } }));
  });
}).listen(9200, () => console.log('AI finta su :9200'));
