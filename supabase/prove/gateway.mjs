// Cancello locale al posto di Kong: /auth/v1 → GoTrue, /rest/v1 → PostgREST, /storage/v1 → Storage, /functions/v1 → Edge Runtime.
import http from 'node:http';
import { ANON, SERVICE } from './chiavi.mjs';
const ROTTE = [['/auth/v1', 9999], ['/rest/v1', 3000], ['/storage/v1', 5000], ['/functions/v1', 9000]];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-upsert, cache-control, prefer, range, x-palestra-segreto', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'access-control-expose-headers': 'content-range' };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const r = ROTTE.find(([p]) => req.url.startsWith(p + '/') || req.url === p);
  if (!r) { res.writeHead(404, CORS); return res.end('{}'); }
  const k = req.headers.apikey;
  const chiaveValida = [ANON, SERVICE].includes(k) || req.url.startsWith('/functions/v1');
  if (!chiaveValida) { res.writeHead(401, { ...CORS, 'content-type': 'application/json' }); return res.end('{"message":"Invalid API key"}'); }
  const h = { ...req.headers, host: `localhost:${r[1]}` };
  if (!h.authorization && k) h.authorization = `Bearer ${k}`;
  const p = http.request({ host: '127.0.0.1', port: r[1], path: req.url.slice(r[0].length) || '/', method: req.method, headers: h }, pr => {
    res.writeHead(pr.statusCode, { ...pr.headers, ...CORS });
    pr.pipe(res);
  });
  p.on('error', e => { res.writeHead(502, CORS); res.end(JSON.stringify({ message: String(e) })); });
  req.pipe(p);
}).listen(8000, () => console.log('gateway su :8000'));
