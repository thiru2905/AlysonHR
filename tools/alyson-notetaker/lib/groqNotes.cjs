const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

async function generateMeetingNotes({ apiKey, model, transcriptText, userPrompt }) {
  const key = String(apiKey || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");

  const m = model && model.trim() ? model.trim() : DEFAULT_MODEL;
  const extra =
    userPrompt && String(userPrompt).trim()
      ? String(userPrompt).trim()
      : "Produce structured meeting notes with sections: Overview, Key discussion points, Decisions, and Action items (with owner if mentioned). Be concise and accurate; only use information from the transcript.";

  const system = `You are an expert meeting assistant. You turn raw conversation transcripts into clear, professional meeting notes. Do not invent facts that are not supported by the transcript. If the transcript is sparse, say so briefly.`;

  const user = `Here is the meeting transcript (speaker labels may be approximate):\n\n${transcriptText}\n\n---\nInstructions for the notes:\n${extra}`;

  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: m,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.35,
      max_tokens: 4096,
    }),
  });

  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, status: r.status, error: text || "Invalid JSON from Groq" };
  }

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: json.error && json.error.message ? json.error.message : JSON.stringify(json),
    };
  }

  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!content || typeof content !== "string") {
    return { ok: false, status: 502, error: "Groq returned no message content" };
  }

  return { ok: true, notes: content.trim(), model: m };
}

module.exports = { generateMeetingNotes, DEFAULT_MODEL };

