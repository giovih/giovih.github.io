// Funzione "ai" (Supabase Edge Function): stima del cibo dalla foto e Coach.
// La chiave di Anthropic sta solo qui, nel segreto ANTHROPIC_API_KEY del progetto: mai nell'app né su git.
// Ogni richiesta deve venire da un utente collegato (token di accesso di Supabase) e c'è un massimo al giorno.

import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const MODELLO = "claude-opus-5-5";
const MASSIMO_AL_GIORNO = 80;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Niente emoji nell'app: le tolgo anche dalle risposte dell'AI.
const senzaEmoji = (s: string) =>
  s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, "").replace(/[ \t]+\n/g, "\n").trim();

/* ---------- utente e limite giornaliero ---------- */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

/** Chiave di servizio: legacy (JWT) oppure nuova (sb_secret_…). */
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

function intestazioniServizio(): Record<string, string> {
  const k = chiaveServizio();
  const h: Record<string, string> = { apikey: k, "Content-Type": "application/json" };
  if (k.startsWith("eyJ")) h.Authorization = `Bearer ${k}`; // le chiavi nuove non vanno nell'Authorization
  return h;
}

async function utenteDa(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!token || token === apikey) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

async function puoUsare(utente: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_conta`, {
    method: "POST",
    headers: intestazioniServizio(),
    body: JSON.stringify({ p_utente: utente, p_massimo: MASSIMO_AL_GIORNO }),
  });
  if (!r.ok) return true; // se il contatore non risponde non blocco l'utente
  return (await r.json()) === true;
}

/* ---------- istruzioni per il modello ---------- */

const SISTEMA_COACH = `Sei il Coach dentro l'app Palestra di un ragazzo italiano di 15 anni, alto circa 172 cm.
Si allena in palestra per l'ipertrofia, con priorità alla parte alta del corpo, e vuole salire di peso di 0,25-0,5 kg a settimana.
Rispondi in italiano semplice, in modo breve e concreto, come un allenatore esperto e gentile. Usa i dati dell'app che trovi qui sotto
per parlare del suo caso; se un dato manca dillo e chiedilo.

Regole:
- L'obiettivo è salire di peso: non consigliare mai di mangiare meno, di dimagrire o di saltare pasti. Se sale troppo in fretta,
  al massimo suggerisci di non aumentare ancora le calorie.
- Integratori: solo la creatina (5 g al giorno). Per tutto il resto cibo vero. Niente diete estreme o digiuni.
- Niente massimali da una ripetizione e niente consigli rischiosi: tecnica pulita e la doppia progressione della sua scheda.
- Se parla di dolore acuto, dolore alle articolazioni, giramenti di testa o altri problemi di salute, digli di fermarsi
  e di parlarne con un genitore o con un medico.
- Scrivi frasi brevi. Usa elenchi puntati solo quando servono. Niente tabelle e niente emoji.`;

const SISTEMA_STIMA = `Sei un nutrizionista. Stimi calorie e macronutrienti di un pasto da una foto e/o da una descrizione,
per un ragazzo di 15 anni che vuole salire di peso. Considera porzioni realistiche in Italia e i condimenti visibili.
Se ci sono più alimenti, stima il totale del piatto o del pasto.
- descrizione: nome breve del pasto in italiano (al massimo 6 parole).
- kcal: la stima più probabile; kcal_min e kcal_max: un intervallo plausibile.
- proteine, carboidrati, grassi: grammi.
- note: una frase su cosa hai considerato (porzione, condimenti, cosa non si vede bene).
Se nella foto non c'è cibo metti tutti i valori a 0 e spiegalo nelle note. Niente emoji.`;

const SCHEMA_STIMA = {
  type: "object",
  properties: {
    descrizione: { type: "string" },
    kcal: { type: "integer" },
    kcal_min: { type: "integer" },
    kcal_max: { type: "integer" },
    proteine: { type: "number" },
    carboidrati: { type: "number" },
    grassi: { type: "number" },
    note: { type: "string" },
  },
  required: ["descrizione", "kcal", "kcal_min", "kcal_max", "proteine", "carboidrati", "grassi", "note"],
  additionalProperties: false,
};

class Rifiuto extends Error {}

const testoDi = (r: Anthropic.Beta.BetaMessage) =>
  r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();

/* ---------- le due azioni ---------- */

async function stima(client: Anthropic, corpo: { immagine?: string; descrizione?: string }) {
  const immagine = typeof corpo.immagine === "string" ? corpo.immagine : "";
  const descrizione = String(corpo.descrizione ?? "").slice(0, 600);
  if (!immagine && !descrizione.trim()) throw new RangeError("Manca la foto o la descrizione.");
  if (immagine.length > 6_000_000) throw new RangeError("Foto troppo grande.");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (immagine) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: immagine } });
  content.push({ type: "text", text: descrizione ? `Stima questo pasto. Descrizione: ${descrizione}` : "Stima questo pasto." });

  const r = await client.beta.messages.create({
    model: MODELLO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_STIMA } },
    system: SISTEMA_STIMA,
    messages: [{ role: "user", content }],
  });
  if (r.stop_reason === "refusal") throw new Rifiuto();
  const d = JSON.parse(testoDi(r));
  const intero = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const uno = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);
  const kcal = intero(d.kcal);
  return {
    descrizione: senzaEmoji(String(d.descrizione ?? "")).slice(0, 80),
    kcal,
    kcal_min: Math.min(kcal, intero(d.kcal_min)),
    kcal_max: Math.max(kcal, intero(d.kcal_max)),
    proteine: uno(d.proteine),
    carboidrati: uno(d.carboidrati),
    grassi: uno(d.grassi),
    note: senzaEmoji(String(d.note ?? "")).slice(0, 400),
  };
}

async function coach(client: Anthropic, corpo: { messaggi?: { role?: string; content?: string }[]; riassunto?: string }) {
  const messaggi: Anthropic.Beta.BetaMessageParam[] = (Array.isArray(corpo.messaggi) ? corpo.messaggi : [])
    .slice(-20)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: String(m.content ?? "").slice(0, 4000) }))
    .filter((m) => m.content.trim());
  while (messaggi.length && messaggi[0].role !== "user") messaggi.shift(); // la conversazione inizia sempre con una domanda
  if (!messaggi.length || messaggi[messaggi.length - 1].role !== "user") throw new RangeError("Manca la domanda.");
  const riassunto = String(corpo.riassunto ?? "").slice(0, 24000);

  const r = await client.beta.messages.create({
    model: MODELLO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: SISTEMA_COACH },
      { type: "text", text: `DATI DELL'APP\n${riassunto || "nessun dato"}` },
    ],
    messages: messaggi,
  });
  if (r.stop_reason === "refusal") {
    return { testo: "Su questo non posso aiutarti. Prova a chiedermelo in un altro modo, oppure parlane con un adulto di cui ti fidi." };
  }
  const testo = senzaEmoji(testoDi(r));
  return { testo: testo || "Non ho una risposta adesso, riprova." };
}

/* ---------- ingresso ---------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ message: "Metodo non permesso." }, 405);

  const utente = await utenteDa(req);
  if (!utente) return risposta({ message: "Accedi di nuovo all'account." }, 401);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ message: "Richiesta non valida." }, 400);
  }
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return risposta({ message: "Manca la chiave dell'AI: aggiungi il segreto ANTHROPIC_API_KEY nelle Edge Functions di Supabase." }, 500);
  }
  if (!(await puoUsare(utente.id))) return risposta({ message: "Per oggi hai usato l'AI molte volte: riprova domani." }, 429);

  // timeout in millisecondi; un solo nuovo tentativo, così la funzione non supera il tempo massimo
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), timeout: 110_000, maxRetries: 1 });
  try {
    if (corpo.azione === "stima") return risposta(await stima(client, corpo));
    if (corpo.azione === "coach") return risposta(await coach(client, corpo));
    return risposta({ message: "Azione sconosciuta." }, 400);
  } catch (e) {
    if (e instanceof Rifiuto) return risposta({ message: "Non riesco a stimare questa foto: provane un'altra o scrivi cosa hai mangiato." }, 422);
    if (e instanceof RangeError) return risposta({ message: e.message }, 400);
    if (e instanceof SyntaxError) return risposta({ message: "Risposta dell'AI non valida, riprova." }, 502);
    if (e instanceof Anthropic.RateLimitError) return risposta({ message: "L'AI è molto richiesta in questo momento: riprova tra un minuto." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return risposta({ message: "La chiave dell'AI non è valida: controlla il segreto ANTHROPIC_API_KEY." }, 500);
    if (e instanceof Anthropic.BadRequestError) return risposta({ message: "L'AI non ha accettato la richiesta: prova con un'altra foto o un testo più breve." }, 400);
    if (e instanceof Anthropic.APIConnectionError) return risposta({ message: "Non riesco a raggiungere l'AI, riprova." }, 502);
    if (e instanceof Anthropic.APIError) return risposta({ message: "L'AI non risponde adesso, riprova tra poco." }, 502);
    console.error(e);
    return risposta({ message: "Errore inatteso, riprova." }, 500);
  }
});
