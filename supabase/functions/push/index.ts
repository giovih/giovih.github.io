// Funzione "push" (Supabase Edge Function): manda le notifiche web push all'iPhone, anche con l'app chiusa.
//
// - azione "chiave": la chiama l'app (utente collegato). Restituisce la chiave pubblica VAPID (creata la prima volta)
//   e salva l'indirizzo del progetto, che il database usa per chiamare questa funzione.
// - azione "invia": la chiama il database ogni volta che c'è una notifica pronta (con il segreto condiviso).
//
// Web Push standard (RFC 8291 per la cifratura, RFC 8292 per VAPID) con le funzioni crittografiche di Deno:
// nessuna libreria esterna e nessuna chiave da copiare a mano.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// "sub" di VAPID: un contatto (https o mailto). Si può cambiare con il segreto PUSH_CONTATTO.
const CONTATTO = Deno.env.get("PUSH_CONTATTO") ?? "https://giovih.github.io/palestra/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();

/* ---------- base64url e byte ---------- */

export function b64url(dati: ArrayBuffer | Uint8Array): string {
  const b = dati instanceof Uint8Array ? dati : new Uint8Array(dati);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function daB64url(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const b = atob(t + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function unisci(...parti: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parti.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of parti) { out.set(p, i); i += p.length; }
  return out;
}

/* ---------- cifratura del contenuto (RFC 8291, aes128gcm) ---------- */

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, byte: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, byte * 8));
}

/** Cifra il testo della notifica per un'iscrizione (chiavi p256dh e auth del telefono). */
export async function cifra(contenuto: Uint8Array, p256dh: string, authSegreto: string): Promise<Uint8Array> {
  const uaPubblica = daB64url(p256dh);
  const auth = daB64url(authSegreto);
  const effimera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPubblica = new Uint8Array(await crypto.subtle.exportKey("raw", effimera.publicKey));
  const uaChiave = await crypto.subtle.importKey("raw", uaPubblica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChiave }, effimera.privateKey, 256));

  const ikm = await hkdf(auth, condiviso, unisci(enc.encode("WebPush: info\x00"), uaPubblica, asPubblica), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\x00"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\x00"), 12);

  const chiave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chiave, unisci(contenuto, new Uint8Array([2]))));

  const testa = new Uint8Array(16 + 4 + 1 + asPubblica.length);
  testa.set(salt, 0);
  new DataView(testa.buffer).setUint32(16, 4096);
  testa[20] = asPubblica.length;
  testa.set(asPubblica, 21);
  return unisci(testa, cifrato);
}

/* ---------- VAPID (RFC 8292) ---------- */

type Vapid = { pubblica: string; privata: JsonWebKey };

export async function nuoveChiaviVapid(): Promise<Vapid> {
  const coppia = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  return {
    pubblica: b64url(await crypto.subtle.exportKey("raw", coppia.publicKey)),
    privata: await crypto.subtle.exportKey("jwk", coppia.privateKey),
  };
}

export async function firmaVapid(aud: string, v: Vapid): Promise<string> {
  const testa = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATTO })));
  const chiave = await crypto.subtle.importKey("jwk", v.privata, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chiave, enc.encode(`${testa}.${corpo}`));
  return `${testa}.${corpo}.${b64url(firma)}`;
}

type Iscrizione = { endpoint: string; p256dh: string; auth: string };

/** Manda una notifica a un telefono. Restituisce lo stato HTTP del servizio push (Apple, Google, Mozilla…). */
export async function inviaA(s: Iscrizione, dati: unknown, v: Vapid, opz: { ttl: number; urgente: boolean; argomento?: string }): Promise<number> {
  const jwt = await firmaVapid(new URL(s.endpoint).origin, v);
  const corpo = await cifra(enc.encode(JSON.stringify(dati)), s.p256dh, s.auth);
  const h: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL: String(Math.max(60, Math.round(opz.ttl))),
    Urgency: opz.urgente ? "high" : "normal",
    Authorization: `vapid t=${jwt}, k=${v.pubblica}`,
  };
  if (opz.argomento) h.Topic = opz.argomento;
  const r = await fetch(s.endpoint, { method: "POST", headers: h, body: corpo });
  await r.body?.cancel();
  return r.status;
}

/* ---------- database (chiave di servizio) ---------- */

function chiaveServizio(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const nuove = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return nuove.default ?? Object.values(nuove)[0] ?? "";
  } catch {
    return "";
  }
}

async function rpc(nome: string, argomenti: Record<string, unknown> = {}) {
  const k = chiaveServizio();
  const h: Record<string, string> = { apikey: k, "Content-Type": "application/json" };
  if (k.startsWith("eyJ")) h.Authorization = `Bearer ${k}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, { method: "POST", headers: h, body: JSON.stringify(argomenti) });
  const testo = await r.text();
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${testo}`);
  return testo ? JSON.parse(testo) : null;
}

async function configurazione(): Promise<Record<string, string>> {
  return (await rpc("push_config_leggi")) ?? {};
}

/** Chiavi VAPID: create una volta sola e salvate nel database (mai nel codice). */
async function chiaviVapid(cfg: Record<string, string>): Promise<Vapid> {
  if (cfg.vapid) return JSON.parse(cfg.vapid);
  await rpc("push_config_scrivi", { p_chiave: "vapid", p_valore: JSON.stringify(await nuoveChiaviVapid()), p_sovrascrivi: false });
  return JSON.parse((await configurazione()).vapid); // se due richieste arrivano insieme vince la prima
}

async function utenteValido(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!token || token === apikey) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  return !!(await r.json())?.id;
}

/** Topic per il servizio push: sostituisce una notifica non ancora consegnata con lo stesso argomento. */
const argomento = (tag: string) => tag.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 32);

/* ---------- ingresso ---------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ message: "Metodo non permesso." }, 405);
  let corpo: { azione?: string };
  try {
    corpo = await req.json();
  } catch {
    return risposta({ message: "Richiesta non valida." }, 400);
  }

  try {
    if (corpo.azione === "chiave") {
      if (!(await utenteValido(req))) return risposta({ message: "Accedi di nuovo all'account." }, 401);
      const cfg = await configurazione();
      if (cfg.url !== SUPABASE_URL) await rpc("push_config_scrivi", { p_chiave: "url", p_valore: SUPABASE_URL, p_sovrascrivi: true });
      const v = await chiaviVapid(cfg);
      return risposta({ chiave: v.pubblica });
    }

    if (corpo.azione === "invia") {
      const cfg = await configurazione();
      if (!cfg.segreto || req.headers.get("x-palestra-segreto") !== cfg.segreto) return risposta({ message: "Non autorizzato." }, 401);
      if (!cfg.vapid) return risposta({ inviate: 0 });
      const v: Vapid = JSON.parse(cfg.vapid);
      const lista: { id: number; tag: string; categoria: string; titolo: string; testo: string; url: string; scade: string; iscrizioni: Iscrizione[] }[] =
        await rpc("push_da_inviare", { p_limite: 100 });
      let consegnate = 0;
      await Promise.all(lista.map(async (n) => {
        const dati = { titolo: n.titolo, testo: n.testo, tag: n.tag.split(":")[0], url: n.url };
        const ttl = (new Date(n.scade).getTime() - Date.now()) / 1000;
        await Promise.all(n.iscrizioni.map(async (s) => {
          let stato = 0;
          try {
            stato = await inviaA(s, dati, v, { ttl, urgente: n.categoria === "recupero", argomento: argomento(n.tag) });
          } catch (e) {
            console.error("push", e);
          }
          if (stato >= 200 && stato < 300) consegnate++;
          else if (stato === 404 || stato === 410) await rpc("push_iscrizione_errore", { p_endpoint: s.endpoint, p_elimina: true });
          else await rpc("push_iscrizione_errore", { p_endpoint: s.endpoint, p_elimina: false });
        }));
      }));
      if (lista.length) await rpc("push_segna_inviate", { p_ids: lista.map((n) => n.id) });
      return risposta({ inviate: lista.length, consegnate });
    }

    return risposta({ message: "Azione sconosciuta." }, 400);
  } catch (e) {
    console.error(e);
    return risposta({ message: "Errore del server delle notifiche." }, 500);
  }
});
