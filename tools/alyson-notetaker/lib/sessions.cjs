const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "..", ".cache", "alyson-notetaker");
const FILE = path.join(DATA_DIR, "sessions.json");

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]", "utf8");
}

function load() {
  ensure();
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(list) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), "utf8");
}

function upsert(session) {
  const list = load();
  const i = list.findIndex((s) => s.botId === session.botId);
  if (i >= 0) list[i] = { ...list[i], ...session };
  else list.unshift(session);
  save(list);
}

function get(botId) {
  return load().find((s) => s.botId === botId) || null;
}

module.exports = { load, upsert, get, FILE };

