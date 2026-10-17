// BotLab: bot AI (Gemini) ognuno con il proprio mini PC (container Docker).
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

const PORT = Number(process.env.PORT || 8080);
const PASSWORD = process.env.BOTLAB_PASSWORD || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SEARX_URL = process.env.SEARX_URL || "http://searxng:8080";
const DATA_DIR = process.env.DATA_DIR || "./data";
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || "botlab-sandbox";
const MAX_STEPS = Number(process.env.MAX_STEPS || 15);
const PUBLIC_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "public");

const BOTS_FILE = path.join(DATA_DIR, "bots.json");
const HIST_DIR = path.join(DATA_DIR, "history");
await fs.mkdir(HIST_DIR, { recursive: true });

// ---------- archivio ----------
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, value) {
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}
const loadBots = () => readJson(BOTS_FILE, []);
const saveBots = (bots) => writeJson(BOTS_FILE, bots);
const histFile = (id) => path.join(HIST_DIR, `${id}.json`);
const loadHistory = (id) => readJson(histFile(id), []);
const saveHistory = (id, h) => writeJson(histFile(id), h);

// ---------- docker ----------
function run(cmd, args, { timeout = 60000, input } = {}) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.killed ? "timeout" : err.code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr) });
    });
    if (input !== undefined) child.stdin.end(input);
  });
}
const containerName = (id) => `botlab-${id}`;

async function ensureContainer(id) {
  const name = containerName(id);
  const st = await run("docker", ["inspect", "-f", "{{.State.Running}}", name]);
  if (st.code === 0) {
    if (st.stdout.trim() !== "true") await run("docker", ["start", name]);
    return;
  }
  const r = await run("docker", [
    "run", "-d", "--name", name, "--hostname", `bot-${id.slice(0, 6)}`,
    "--memory", process.env.BOT_MEMORY || "1g",
    "--cpus", process.env.BOT_CPUS || "1",
    "--pids-limit", "256",
    "--restart", "unless-stopped",
    "--label", "botlab=1",
    SANDBOX_IMAGE,
  ]);
  if (r.code !== 0) throw new Error("Impossibile creare il mini PC: " + r.stderr);
}

function clip(s, n = 8000) {
  return s.length > n ? s.slice(0, n / 2) + `\n...[tagliati ${s.length - n} caratteri]...\n` + s.slice(-n / 2) : s;
}

async function execInBot(id, command, timeoutSec = 60) {
  await ensureContainer(id);
  const r = await run("docker", ["exec", "-w", "/root", containerName(id), "bash", "-lc", command], {
    timeout: Math.min(Math.max(timeoutSec, 1), 300) * 1000,
  });
  return { exit_code: r.code, stdout: clip(r.stdout), stderr: clip(r.stderr, 3000) };
}

// ---------- strumenti ----------
const tools = [{
  functionDeclarations: [
    {
      name: "run_command",
      description: "Esegue un comando bash nel tuo computer Linux personale (Ubuntu, sei root, hai internet). Puoi installare pacchetti con apt o pip, scrivere file, eseguire script.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Comando bash da eseguire" },
          timeout_seconds: { type: "integer", description: "Tempo massimo (default 60, max 300)" },
        },
        required: ["command"],
      },
    },
    {
      name: "web_search",
      description: "Cerca sul web e restituisce titoli, link e anteprime dei risultati.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "fetch_url",
      description: "Scarica una pagina web e restituisce il suo testo.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  ],
}];

async function webSearch(query) {
  const u = `${SEARX_URL}/search?format=json&q=${encodeURIComponent(query)}`;
  const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return { error: `ricerca fallita (${res.status})` };
  const data = await res.json();
  return {
    results: (data.results || []).slice(0, 8).map((r) => ({ title: r.title, url: r.url, snippet: (r.content || "").slice(0, 300) })),
  };
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

async function fetchUrl(url) {
  if (!/^https?:\/\//i.test(url)) return { error: "URL non valido" };
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "Mozilla/5.0 BotLab" } });
  const type = res.headers.get("content-type") || "";
  const body = await res.text();
  return { status: res.status, text: clip(type.includes("html") ? htmlToText(body) : body, 12000) };
}

async function callTool(botId, name, args) {
  try {
    if (name === "run_command") return await execInBot(botId, String(args.command || ""), Number(args.timeout_seconds) || 60);
    if (name === "web_search") return await webSearch(String(args.query || ""));
    if (name === "fetch_url") return await fetchUrl(String(args.url || ""));
    return { error: "strumento sconosciuto" };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// ---------- Gemini ----------
function systemPrompt(bot) {
  return [
    `Sei "${bot.name}", un assistente AI con un tuo computer Linux personale.`,
    "Usa gli strumenti quando servono: run_command per il terminale, web_search e fetch_url per le ricerche.",
    "Lavora passo per passo, controlla i risultati e alla fine rispondi in modo chiaro. Rispondi nella lingua dell'utente.",
    bot.instructions ? `\nIstruzioni del tuo creatore:\n${bot.instructions}` : "",
  ].join("\n");
}

async function gemini(bot, contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(bot) }] }, contents, tools }),
      signal: AbortSignal.timeout(120000),
    });
    if (res.status === 429 || res.status >= 500) {
      // limite del piano gratuito: aspetta e riprova
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Errore Gemini ${res.status}`);
    const content = data.candidates?.[0]?.content;
    if (!content?.parts) throw new Error("Gemini non ha risposto (" + (data.candidates?.[0]?.finishReason || "sconosciuto") + ")");
    return content;
  }
  throw new Error("Limite gratuito di Gemini raggiunto, riprova tra un minuto.");
}

const busy = new Set();

async function chat(bot, text, emit) {
  const history = await loadHistory(bot.id);
  history.push({ role: "user", parts: [{ text }] });
  for (let step = 0; step < MAX_STEPS; step++) {
    const content = await gemini(bot, history);
    content.role = "model";
    history.push(content);
    await saveHistory(bot.id, history);
    const calls = content.parts.filter((p) => p.functionCall);
    for (const p of content.parts) if (p.text && !p.thought) emit({ type: "text", text: p.text });
    if (!calls.length) return;
    const responses = [];
    for (const { functionCall: fc } of calls) {
      emit({ type: "tool", name: fc.name, args: fc.args || {} });
      const result = await callTool(bot.id, fc.name, fc.args || {});
      emit({ type: "tool_result", name: fc.name, result });
      responses.push({ functionResponse: { name: fc.name, response: result } });
    }
    history.push({ role: "user", parts: responses });
    await saveHistory(bot.id, history);
  }
  emit({ type: "text", text: "_(Mi fermo qui: troppi passaggi di fila. Scrivimi \"continua\" per proseguire.)_" });
}

// Converte la cronologia Gemini in messaggi per l'interfaccia
function toUi(history) {
  const out = [];
  for (const c of history) {
    for (const p of c.parts || []) {
      if (p.text && !p.thought) out.push({ type: c.role === "user" ? "user" : "text", text: p.text });
      else if (p.functionCall) out.push({ type: "tool", name: p.functionCall.name, args: p.functionCall.args || {} });
      else if (p.functionResponse) out.push({ type: "tool_result", name: p.functionResponse.name, result: p.functionResponse.response });
    }
  }
  return out;
}

// ---------- HTTP ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json" };

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let s = "";
  for await (const chunk of req) { s += chunk; if (s.length > 1e6) throw new Error("troppo grande"); }
  return s ? JSON.parse(s) : {};
}
function authorized(req) {
  const h = req.headers.authorization || "";
  const given = Buffer.from(h.replace(/^Bearer /, ""));
  const real = Buffer.from(PASSWORD);
  return PASSWORD && given.length === real.length && crypto.timingSafeEqual(given, real);
}

async function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(PUBLIC_DIR, rel === "/" ? "index.html" : rel);
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: "no" });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    send(res, 404, { error: "non trovato" });
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.end();

  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) return serveStatic(req, res);
  if (!authorized(req)) return send(res, 401, { error: "Password sbagliata" });

  try {
    const parts = url.pathname.split("/").filter(Boolean); // api, bots, :id, action
    const bots = await loadBots();

    if (url.pathname === "/api/ping") return send(res, 200, { ok: true, model: MODEL });

    if (parts[1] === "bots" && parts.length === 2) {
      if (req.method === "GET") return send(res, 200, bots);
      if (req.method === "POST") {
        const { name, instructions } = await readBody(req);
        if (!name?.trim()) return send(res, 400, { error: "Serve un nome" });
        const bot = { id: crypto.randomBytes(6).toString("hex"), name: name.trim().slice(0, 60), instructions: String(instructions || "").slice(0, 8000), created: Date.now() };
        bots.push(bot);
        await saveBots(bots);
        ensureContainer(bot.id).catch((e) => console.error(e));
        return send(res, 200, bot);
      }
    }

    const bot = bots.find((b) => b.id === parts[2]);
    if (parts[1] !== "bots" || !bot) return send(res, 404, { error: "Bot non trovato" });
    const action = parts[3];

    if (!action && req.method === "DELETE") {
      await run("docker", ["rm", "-f", containerName(bot.id)]);
      await fs.rm(histFile(bot.id), { force: true });
      await saveBots(bots.filter((b) => b.id !== bot.id));
      return send(res, 200, { ok: true });
    }
    if (action === "messages" && req.method === "GET") return send(res, 200, toUi(await loadHistory(bot.id)));
    if (action === "reset" && req.method === "POST") {
      await fs.rm(histFile(bot.id), { force: true });
      return send(res, 200, { ok: true });
    }
    if (action === "exec" && req.method === "POST") {
      const { command } = await readBody(req);
      return send(res, 200, await execInBot(bot.id, String(command || ""), 120));
    }
    if (action === "chat" && req.method === "POST") {
      const { text } = await readBody(req);
      if (!text?.trim()) return send(res, 400, { error: "Messaggio vuoto" });
      if (busy.has(bot.id)) return send(res, 409, { error: "Il bot sta già lavorando" });
      busy.add(bot.id);
      res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" });
      const emit = (ev) => res.write(JSON.stringify(ev) + "\n");
      try {
        await chat(bot, text.trim(), emit);
      } catch (e) {
        emit({ type: "error", error: String(e.message || e) });
      } finally {
        busy.delete(bot.id);
        emit({ type: "done" });
        res.end();
      }
      return;
    }
    send(res, 404, { error: "Richiesta sconosciuta" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: String(e.message || e) });
  }
});

if (!PASSWORD || !GEMINI_KEY) console.warn("ATTENZIONE: BOTLAB_PASSWORD o GEMINI_API_KEY mancanti nel file .env");
server.listen(PORT, () => console.log(`BotLab in ascolto sulla porta ${PORT} (modello ${MODEL})`));
