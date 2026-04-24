import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BotIdInput = z.object({ botId: z.string().min(1) });
const CreateBotInput = z.object({
  meeting_url: z.string().min(1),
  bot_name: z.string().min(1),
  title: z.string().optional(),
});
const NotesInput = z.object({ botId: z.string().min(1), prompt: z.string().optional() });

function baseUrl() {
  const raw =
    process.env.ALYSON_NOTETAKER_BASE_URL ||
    process.env.VITE_ALYSON_NOTETAKER_BASE_URL ||
    // backward compat
    process.env.TEST_BOTV2_BASE_URL ||
    process.env.VITE_TEST_BOTV2_BASE_URL ||
    "http://localhost:3002";
  return String(raw).replace(/\/$/, "");
}

async function upstream(path: string, init?: RequestInit) {
  const url = `${baseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, init);
  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!r.ok) {
    const msg = json?.error ? String(json.error) : text || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return json;
}

export type NotetakerSession = {
  botId: string;
  title: string;
  meetingUrl?: string;
  botName?: string;
  createdAt: string;
  status?: string;
};

export type NotetakerTranscriptLine = {
  received_at: string;
  event: string;
  text?: string;
  participant?: { id?: string; name?: string } | null;
  initials?: string;
  clock?: string;
};

export const listNotetakerSessions = createServerFn({ method: "GET" }).handler(async () => {
  const data = await upstream("/api/sessions");
  return data as {
    sessions: NotetakerSession[];
    hasRecallConfig: boolean;
    hasGroqConfig: boolean;
  };
});

export const getNotetakerSession = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => BotIdInput.parse(data))
  .handler(async ({ data }) => {
    const res = await upstream(`/api/session/${encodeURIComponent(data.botId)}`);
    return res as {
      session: NotetakerSession;
      lines: NotetakerTranscriptLine[];
      participantCount: number;
      startedLabel: string;
      hasRecallConfig: boolean;
      hasGroqConfig: boolean;
    };
  });

export const createNotetakerRecallBot = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CreateBotInput.parse(data))
  .handler(async ({ data }) => {
    const payload = { meeting_url: data.meeting_url, bot_name: data.bot_name, title: data.title ?? "Live meeting" };
    const res = await upstream("/api/create-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  });

export const generateNotetakerNotes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => NotesInput.parse(data))
  .handler(async ({ data }) => {
    const res = await upstream(`/api/session/${encodeURIComponent(data.botId)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: data.prompt ?? "" }),
    });
    return res as { notes: string; model: string };
  });

