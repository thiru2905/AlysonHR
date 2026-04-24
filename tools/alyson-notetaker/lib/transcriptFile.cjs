const fs = require("fs");
const path = require("path");

const TRANSCRIPTS_DIR = path.join(__dirname, "..", "..", "..", ".cache", "alyson-notetaker", "transcripts");

function readFinalLines(botId) {
  const safe = String(botId).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(TRANSCRIPTS_DIR, `${safe}.jsonl`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj.event === "transcript.data") lines.push(obj);
    } catch {
      /* skip */
    }
  }
  return lines;
}

function listTranscriptBotIds() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) return [];
  return fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(/\.jsonl$/, ""));
}

/**
 * Plain text for LLM notes: prefers finalized transcript.data lines; if none, collapses
 * consecutive partial_data lines per speaker to the latest text in each run.
 */
function formatTranscriptForNotes(botId) {
  const safe = String(botId).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(TRANSCRIPTS_DIR, `${safe}.jsonl`);
  if (!fs.existsSync(filePath)) return "";
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj.event === "transcript.data" || obj.event === "transcript.partial_data") {
        rows.push(obj);
      }
    } catch {
      /* skip */
    }
  }
  rows.sort((a, b) => new Date(a.received_at) - new Date(b.received_at));

  const dataRows = rows.filter((r) => r.event === "transcript.data");
  if (dataRows.length > 0) {
    return dataRows
      .map((r) => {
        const name = (r.participant && r.participant.name) || "Speaker";
        return `${name}: ${(r.text || "").trim()}`;
      })
      .join("\n");
  }

  const buf = [];
  let lastKey = null;
  for (const r of rows) {
    if (r.event !== "transcript.partial_data") continue;
    const pid = r.participant && r.participant.id;
    const name = (r.participant && r.participant.name) || "Speaker";
    const key = `${pid}:${name}`;
    const text = (r.text || "").trim();
    if (key === lastKey && buf.length) {
      buf[buf.length - 1] = `${name}: ${text}`;
    } else {
      buf.push(`${name}: ${text}`);
      lastKey = key;
    }
  }
  return buf.filter((line, i, a) => i === 0 || line !== a[i - 1]).join("\n");
}

module.exports = { readFinalLines, listTranscriptBotIds, formatTranscriptForNotes, TRANSCRIPTS_DIR };

