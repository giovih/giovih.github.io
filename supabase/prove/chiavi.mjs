// Chiavi di prova (JWT HS256) per il Supabase locale.
import { createHmac } from 'node:crypto';
export const SEGRETO_JWT = 'super-segreto-di-prova-per-i-test-locali-0123456789';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export function jwt(payload) {
  const testa = b64({ alg: 'HS256', typ: 'JWT' });
  const corpo = b64({ iss: 'supabase', iat: 1700000000, exp: 2000000000, ...payload });
  const firma = createHmac('sha256', SEGRETO_JWT).update(`${testa}.${corpo}`).digest('base64url');
  return `${testa}.${corpo}.${firma}`;
}
export const ANON = jwt({ role: 'anon' });
export const SERVICE = jwt({ role: 'service_role' });
if (process.argv[2] === 'stampa') console.log(`SEGRETO_JWT=${SEGRETO_JWT}\nANON=${ANON}\nSERVICE=${SERVICE}`);
