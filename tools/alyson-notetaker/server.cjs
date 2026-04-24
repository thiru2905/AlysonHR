require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const { verifyRequestFromRecall } = require("./verifyRecall.cjs");
const sessions = require("./lib/sessions.cjs");
const { readFinalLines, listTranscriptBotIds, formatTranscriptForNotes, TRANSCRIPTS_DIR } = require("./lib/transcriptFile.cjs");
const { generateMeetingNotes } = require("./lib/groqNotes.cjs");

const PORT = Number(process.env.ALYSON_NOTETAKER_PORT || process.env.PORT) || 3003;
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_REGION = process.env.RECALL_REGION || "us-west-2";
const PUBLIC_WEBHOOK_BASE_URL = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
const RECALL_VERIFICATION_SECRET = process.env.RECALL_VERIFICATION_SECRET;
const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();
const GROQ_MODEL = process.env.GROQ_MODEL?.trim();

/** @type {Map<string, Set<import('http').ServerResponse>>} */
const transcriptSubscribers = new Map();

function ensureTranscriptsDir() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }
}

function extractTextFromWords(words) {
  if (!words) return "";
  if (Array.isArray(words)) {
    return words
      .map((w) => (typeof w === "string" ? w : w && w.text != null ? String(w.text) : ""))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (typeof words === "object" && words.text != null) {
    return String(words.text);
  }
  return "";
}

function broadcastTranscript(botId, payload) {
  const set = transcriptSubscribers.get(botId);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      /* client gone */
    }
  }
}

function appendTranscriptLine({ botId, recordingId, event, payloadObj }) {
  ensureTranscriptsDir();
  const safeId = (botId || recordingId || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(TRANSCRIPTS_DIR, `${safeId}.jsonl`);
  const lineObj = {
    received_at: new Date().toISOString(),
    event,
    ...payloadObj,
  };
  fs.appendFileSync(filePath, JSON.stringify(lineObj) + "\n", "utf8");

  if (event === "transcript.data" && botId) {
    broadcastTranscript(botId, { type: "line", line: lineObj });
  }
  return filePath;
}

function initialsFromName(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function relativeStarted(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

async function createRecallBot({ meeting_url, bot_name }) {
  if (!RECALL_API_KEY) {
    return { ok: false, status: 500, body: { error: "RECALL_API_KEY is not set" } };
  }
  if (!PUBLIC_WEBHOOK_BASE_URL) {
    return {
      ok: false,
      status: 500,
      body: { error: "PUBLIC_WEBHOOK_BASE_URL is required (ngrok URL base, no path)" },
    };
  }

  const base = String(PUBLIC_WEBHOOK_BASE_URL).replace(/\/$/, "");
  const webhookUrl = `${base}/webhooks/recall/transcript`;
  const recallUrl = `https://${RECALL_REGION}.recall.ai/api/v1/bot/`;

  let language_code = (process.env.TRANSCRIPT_LANGUAGE || "en").trim().toLowerCase();
  if (!language_code || language_code === "auto") language_code = "en";

  const englishCodes = new Set(["en", "en_us", "en_uk", "en_au"]);
  let mode = (process.env.TRANSCRIPT_MODE || "prioritize_low_latency").trim();
  if (mode === "prioritize_low_latency" && !englishCodes.has(language_code)) {
    mode = "prioritize_accuracy";
  }

  const payload = {
    meeting_url,
    bot_name,
    recording_config: {
      transcript: {
        provider: {
          recallai_streaming: {
            mode,
            language_code,
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
      },
      realtime_endpoints: [
        {
          type: "webhook",
          url: webhookUrl,
          events: ["transcript.data", "transcript.partial_data"],
        },
      ],
    },
  };

  const r = await fetch(recallUrl, {
    method: "POST",
    headers: {
      Authorization: `Token ${RECALL_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!r.ok) return { ok: false, status: r.status, body: json };
  return { ok: true, status: 201, body: json };
}

function mergeSessionsWithFiles() {
  const stored = sessions.load();
  const byId = new Map(stored.map((s) => [s.botId, { ...s }]));
  for (const id of listTranscriptBotIds()) {
    if (!byId.has(id)) {
      let createdAt = new Date().toISOString();
      try {
        createdAt = fs.statSync(path.join(TRANSCRIPTS_DIR, `${id}.jsonl`)).mtime.toISOString();
      } catch {
        /* ignore */
      }
      byId.set(id, {
        botId: id,
        title: "Meeting",
        meetingUrl: "",
        botName: "Notetaker",
        createdAt,
        status: "recent",
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const app = express();

// CORS so the AlysonHR UI (vite port) can call this server
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/sessions", (_req, res) => {
  res.json({
    sessions: mergeSessionsWithFiles(),
    hasRecallConfig: Boolean(RECALL_API_KEY && PUBLIC_WEBHOOK_BASE_URL),
    hasGroqConfig: Boolean(GROQ_API_KEY),
  });
});

app.get("/api/config", (_req, res) => {
  const groq = (process.env.GROQ_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  res.json({
    port: PORT,
    hasRecallConfig: Boolean(RECALL_API_KEY && PUBLIC_WEBHOOK_BASE_URL),
    hasGroqConfig: Boolean(GROQ_API_KEY),
    groqKey: groq ? { length: groq.length, prefix: groq.slice(0, 4), suffix: groq.slice(-4) } : null,
    groqModel: GROQ_MODEL || null,
  });
});

app.get("/api/session/:botId", (req, res) => {
  const { botId } = req.params;
  const session =
    sessions.get(botId) || {
      botId,
      title: "Meeting",
      meetingUrl: "",
      botName: "Notetaker",
      createdAt: new Date().toISOString(),
      status: "recording",
    };

  const lines = readFinalLines(botId).map((line) => ({
    ...line,
    initials: initialsFromName(line.participant && line.participant.name),
    clock: formatClock(line.received_at),
  }));
  const participants = new Set();
  for (const L of lines) {
    const n = L.participant && L.participant.name;
    if (n) participants.add(n);
  }
  res.json({
    session,
    lines,
    participantCount: participants.size || 0,
    startedLabel: relativeStarted(session.createdAt),
    hasRecallConfig: Boolean(RECALL_API_KEY && PUBLIC_WEBHOOK_BASE_URL),
    hasGroqConfig: Boolean(GROQ_API_KEY),
  });
});

app.get("/session/:botId/events", (req, res) => {
  const { botId } = req.params;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) res.flushHeaders();

  if (!transcriptSubscribers.has(botId)) transcriptSubscribers.set(botId, new Set());
  transcriptSubscribers.get(botId).add(res);

  res.write(`data: ${JSON.stringify({ type: "ready", botId })}\n\n`);

  req.on("close", () => {
    const set = transcriptSubscribers.get(botId);
    if (set) {
      set.delete(res);
      if (set.size === 0) transcriptSubscribers.delete(botId);
    }
  });
});

app.post("/webhooks/recall/transcript", express.raw({ type: "*/*", limit: "2mb" }), (req, res) => {
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body || "");

  try {
    if (RECALL_VERIFICATION_SECRET) {
      verifyRequestFromRecall({
        secret: RECALL_VERIFICATION_SECRET,
        headers: req.headers,
        payload: rawBody,
      });
    }
  } catch (e) {
    console.error("[webhook] Verification failed:", e.message);
    return res.status(401).send("Unauthorized");
  }

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  const event = body.event;
  const data = body.data;

  if (event === "transcript.data" || event === "transcript.partial_data") {
    const inner = data && data.data;
    const words = inner && inner.words;
    const text = extractTextFromWords(words);
    const participant = inner && inner.participant;
    const botId = data && data.bot && data.bot.id;
    const recordingId = data && data.recording && data.recording.id;

    appendTranscriptLine({
      botId,
      recordingId,
      event,
      payloadObj: {
        text,
        language_code: inner && inner.language_code,
        participant: participant
          ? {
              id: participant.id,
              name: participant.name,
              is_host: participant.is_host,
              platform: participant.platform,
            }
          : null,
        bot_id: botId,
        recording_id: recordingId,
      },
    });
  }

  res.status(200).json({ received: true });
});

app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true }));

app.post("/api/create-bot", async (req, res) => {
  const { meeting_url, bot_name, title } = req.body || {};
  if (!meeting_url || typeof meeting_url !== "string") return res.status(400).json({ error: "meeting_url is required" });
  if (!bot_name || typeof bot_name !== "string") return res.status(400).json({ error: "bot_name is required" });

  const result = await createRecallBot({ meeting_url, bot_name });
  if (!result.ok) {
    return res.status(result.status).json({ error: "Recall API error", status: result.status, body: result.body });
  }

  const bot = result.body;
  const botId = bot && bot.id;
  if (botId) {
    sessions.upsert({
      botId,
      title: typeof title === "string" && title.trim() ? title.trim() : "Live meeting",
      meetingUrl: meeting_url,
      botName: bot_name,
      createdAt: new Date().toISOString(),
      status: "recording",
    });
  }

  return res.status(201).json({
    botId,
    bot,
    webhook_configured: `${String(PUBLIC_WEBHOOK_BASE_URL || "").replace(/\/$/, "")}/webhooks/recall/transcript`,
  });
});

async function handleNotes(req, res) {
  const { botId } = req.params;
  if (!GROQ_API_KEY) return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server" });

  const transcriptText = formatTranscriptForNotes(botId);
  if (!transcriptText.trim()) return res.status(400).json({ error: "No transcript text available yet for this session." });

  const prompt = req.body && typeof req.body.prompt === "string" ? req.body.prompt : "";

  try {
    const result = await generateMeetingNotes({
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL,
      transcriptText,
      userPrompt: prompt,
    });
    if (!result.ok) {
      return res.status(result.status >= 400 ? result.status : 502).json({ error: result.error || "Groq request failed" });
    }
    return res.json({ notes: result.notes, model: result.model });
  } catch (e) {
    console.error("[groq]", e);
    return res.status(500).json({ error: e.message || "Failed to generate notes" });
  }
}

app.post("/api/session/:botId/notes", handleNotes);

ensureTranscriptsDir();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Alyson Notetaker listening on http://0.0.0.0:${PORT}`);
  console.log(`Webhook: ${String(PUBLIC_WEBHOOK_BASE_URL || "").replace(/\/$/, "")}/webhooks/recall/transcript`);
});

