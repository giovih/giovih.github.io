// Collegamento a Supabase (account, database, funzioni, foto) con semplici richieste HTTP.
// Indirizzo del progetto e chiave pubblica si incollano in Altro → Account: non sono nel codice.

const CHIAVE_CFG = 'palestra-cloud';
const CHIAVE_SESS = 'palestra-sessione';
const ascoltatori = new Set();

const leggiJSON = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const scriviJSON = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* niente */ } };

let cfg = leggiJSON(CHIAVE_CFG);
let sess = leggiJSON(CHIAVE_SESS);

function avvisa() { for (const f of ascoltatori) { try { f(stato()); } catch (e) { console.error(e); } } }
export const ascolta = fn => { ascoltatori.add(fn); return () => ascoltatori.delete(fn); };

export const configurato = () => !!(cfg?.url && cfg?.chiave);
export const collegato = () => configurato() && !!sess?.refresh_token;
export const utente = () => sess?.user || null;
export const stato = () => ({ configurato: configurato(), collegato: collegato(), email: sess?.user?.email || null, url: cfg?.url || '' });
export const configurazione = () => ({ url: cfg?.url || '', chiave: cfg?.chiave || '' });

export function salvaConfigurazione(url, chiave) {
  let u = (url || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//.test(u)) u = 'https://' + u;
  // accetto anche solo il codice del progetto (es. "abcdefgh")
  if (/^https:\/\/[a-z0-9]{15,30}$/.test(u)) u += '.supabase.co';
  cfg = { url: u, chiave: (chiave || '').trim() };
  scriviJSON(CHIAVE_CFG, cfg);
  avvisa();
}

/** Errore con un messaggio comprensibile. */
export class ErroreCloud extends Error {
  constructor(messaggio, codice, status) { super(messaggio); this.codice = codice; this.status = status; }
}

const MESSAGGI = {
  invalid_credentials: 'Email o password sbagliate.',
  email_not_confirmed: 'Prima conferma l\'account con il link che ti è arrivato per email.',
  user_already_exists: 'Esiste già un account con questa email: usa "Accedi".',
  email_exists: 'Esiste già un account con questa email: usa "Accedi".',
  weak_password: 'Password troppo semplice: usa almeno 8 caratteri.',
  over_email_send_rate_limit: 'Troppe email inviate: riprova tra qualche minuto.',
  over_request_rate_limit: 'Troppi tentativi: riprova tra qualche minuto.',
  validation_failed: 'Controlla email e password.',
  refresh_token_not_found: 'Sessione scaduta: accedi di nuovo.',
  signup_disabled: 'Le registrazioni sono disattivate nel progetto Supabase.',
};

async function leggiRisposta(r) {
  const testo = await r.text();
  let dati = null;
  try { dati = testo ? JSON.parse(testo) : null; } catch { dati = testo; }
  if (!r.ok) {
    const codice = dati?.error_code || dati?.code || dati?.error || null;
    const msg = MESSAGGI[codice] || dati?.msg || dati?.message || dati?.error_description || dati?.error || `Errore ${r.status}`;
    throw new ErroreCloud(typeof msg === 'string' ? msg : `Errore ${r.status}`, codice, r.status);
  }
  return dati;
}

async function richiesta(percorso, { metodo = 'GET', corpo, conToken = true, intestazioni = {}, grezzo = false, tentativo = 0 } = {}) {
  if (!configurato()) throw new ErroreCloud('Account non configurato.', 'non_configurato', 0);
  if (conToken) await tokenValido();
  const h = { apikey: cfg.chiave, ...intestazioni };
  if (conToken && sess?.access_token) h.Authorization = 'Bearer ' + sess.access_token;
  let body = corpo;
  if (corpo !== undefined && !(corpo instanceof Blob) && typeof corpo !== 'string') {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  let r;
  try {
    r = await fetch(cfg.url + percorso, { method: metodo, headers: h, body });
  } catch {
    throw new ErroreCloud('Nessuna connessione a internet.', 'offline', 0);
  }
  if (r.status === 401 && conToken && sess?.refresh_token && tentativo === 0) {
    await rinnova().catch(() => null);
    return richiesta(percorso, { metodo, corpo, conToken, intestazioni, grezzo, tentativo: 1 });
  }
  if (grezzo) {
    if (!r.ok) await leggiRisposta(r);
    return r;
  }
  return leggiRisposta(r);
}

/* ---------- account ---------- */

function salvaSessione(d) {
  if (!d?.access_token) return;
  sess = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + (d.expires_in || 3600) * 1000,
    user: { id: d.user?.id || sess?.user?.id, email: d.user?.email || sess?.user?.email },
  };
  scriviJSON(CHIAVE_SESS, sess);
  avvisa();
}

let rinnovoInCorso = null;
async function rinnova() {
  if (!sess?.refresh_token) throw new ErroreCloud('Accedi di nuovo.', 'no_sessione', 401);
  if (!rinnovoInCorso) {
    rinnovoInCorso = (async () => {
      try {
        const d = await richiesta('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: sess.refresh_token }, conToken: false });
        salvaSessione(d);
      } catch (e) {
        // token non più valido: esco (i dati restano sul telefono)
        if (e.status === 400 || e.status === 401 || e.status === 403) { sess = null; scriviJSON(CHIAVE_SESS, null); avvisa(); }
        throw e;
      } finally { rinnovoInCorso = null; }
    })();
  }
  return rinnovoInCorso;
}

async function tokenValido() {
  if (sess?.refresh_token && (!sess.access_token || Date.now() > (sess.expires_at || 0) - 60000)) await rinnova();
}

export async function registrati(email, password) {
  const d = await richiesta('/auth/v1/signup', { metodo: 'POST', corpo: { email: email.trim(), password, data: {} }, conToken: false });
  if (d?.access_token) { salvaSessione(d); return { collegato: true }; }
  return { collegato: false, confermaEmail: true };
}

export async function accedi(email, password) {
  const d = await richiesta('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: email.trim(), password }, conToken: false });
  salvaSessione(d);
  return { collegato: true };
}

export async function recuperaPassword(email) {
  await richiesta('/auth/v1/recover', { metodo: 'POST', corpo: { email: email.trim() }, conToken: false });
}

export async function esci() {
  try { if (sess?.access_token) await richiesta('/auth/v1/logout', { metodo: 'POST', conToken: true }); } catch { /* niente */ }
  sess = null;
  scriviJSON(CHIAVE_SESS, null);
  avvisa();
}

/** Link di conferma email: Supabase riapre l'app con i token nell'indirizzo (#access_token=…). */
export function leggiTokenDaIndirizzo() {
  const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  if (!h.get('access_token') || !h.get('refresh_token')) return false;
  salvaSessione({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, user: null });
  history.replaceState(null, '', location.pathname + '#altro');
  // recupero email e id dell'utente
  richiesta('/auth/v1/user').then(u => { if (u?.id) { sess.user = { id: u.id, email: u.email }; scriviJSON(CHIAVE_SESS, sess); avvisa(); } }).catch(() => {});
  return true;
}

/* ---------- database, funzioni, file ---------- */

export const rpc = (nome, argomenti = {}) => richiesta('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: argomenti });

export const funzione = (nome, corpo = {}) => richiesta('/functions/v1/' + nome, { metodo: 'POST', corpo });

export async function caricaFile(bucket, percorso, blob) {
  return richiesta(`/storage/v1/object/${bucket}/${percorso}`, {
    metodo: 'POST', corpo: blob,
    intestazioni: { 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true', 'cache-control': '31536000' },
  });
}

export async function scaricaFile(bucket, percorso) {
  const r = await richiesta(`/storage/v1/object/authenticated/${bucket}/${percorso}`, { grezzo: true });
  return r.blob();
}

export const eliminaFile = (bucket, percorsi) => richiesta(`/storage/v1/object/${bucket}`, { metodo: 'DELETE', corpo: { prefixes: percorsi } });
