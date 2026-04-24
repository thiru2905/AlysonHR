import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { PageSkeleton } from "@/components/Skeleton";
import {
  listNotetakerSessions,
  getNotetakerSession,
  createNotetakerRecallBot,
  generateNotetakerNotes,
  type NotetakerTranscriptLine,
} from "@/lib/alyson-notetaker-functions";
import { Captions, Plus, RefreshCw, Sparkles, Copy, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/alyson-notetaker")({
  head: () => ({ meta: [{ title: "Alyson Notetaker — Alyson HR" }] }),
  component: AlysonNotetakerPage,
});

function AlysonNotetakerPage() {
  const sessionsQ = useQuery({ queryKey: ["alyson-notetaker", "sessions"], queryFn: () => listNotetakerSessions() });
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!picked && sessionsQ.data?.sessions?.[0]?.botId) {
      setPicked(sessionsQ.data.sessions[0].botId);
    }
  }, [picked, sessionsQ.data]);

  if (sessionsQ.isLoading) return <PageSkeleton />;

  if (sessionsQ.isError) {
    const msg = sessionsQ.error instanceof Error ? sessionsQ.error.message : "Failed to load sessions.";
    return (
      <div className="ops-dense">
        <PageHeader eyebrow="Operations" title="Alyson Notetaker" description="Recall.ai meeting bot + live transcript + notes." dense />
        <div className="px-5 md:px-8 py-6">
          <div className="surface-card p-5">
            <div className="font-medium">Unable to load Alyson Notetaker</div>
            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{msg}</div>
            <div className="mt-4">
              <button onClick={() => sessionsQ.refetch()} className="h-8 px-3 rounded-md bg-foreground text-background text-xs flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sessions = sessionsQ.data?.sessions ?? [];
  const hasRecallConfig = sessionsQ.data?.hasRecallConfig ?? false;

  return (
    <div className="ops-dense">
      <PageHeader
        eyebrow="Operations"
        title="Alyson Notetaker"
        description="Create a Recall bot for a meeting, stream transcripts live, and generate notes."
        dense
      />
      <div className="px-5 md:px-8 py-6">
        {!hasRecallConfig && (
          <div className="surface-card p-4 border border-border mb-5">
            <div className="font-medium text-[13px]">Server not configured</div>
            <div className="text-[12px] text-muted-foreground mt-1">
              Set `RECALL_API_KEY` and `PUBLIC_WEBHOOK_BASE_URL` (and optional Groq keys) and run the notetaker server.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <div className="surface-card p-4">
            <CreateBotForm
              onCreated={async (botId) => {
                await sessionsQ.refetch();
                if (botId) setPicked(botId);
              }}
            />
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-2">Sessions</div>
              {sessions.length === 0 ? (
                <EmptyState icon={Captions} title="No sessions yet" description="Create a bot to start capturing transcripts." />
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <button
                      key={s.botId}
                      onClick={() => setPicked(s.botId)}
                      className={
                        "w-full text-left px-3 py-2 rounded-md border transition-colors " +
                        (picked === s.botId ? "bg-muted border-border" : "bg-background border-border/60 hover:bg-muted/40")
                      }
                    >
                      <div className="font-medium text-[13px] truncate">{s.title || "Meeting"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{s.botId}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SessionPanel botId={picked} />
        </div>
      </div>
    </div>
  );
}

function CreateBotForm({ onCreated }: { onCreated: (botId: string | null) => void }) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState("");
  const [botName, setBotName] = useState("Notetaker");

  const m = useMutation({
    mutationFn: async () =>
      createNotetakerRecallBot({
        data: { meeting_url: meetingUrl.trim(), bot_name: botName.trim(), title: title.trim() || undefined },
      }),
    onSuccess: (res: any) => onCreated(res?.botId ? String(res.botId) : null),
  });

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-2">New meeting bot</div>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full h-8 px-3 rounded-md border border-border bg-background text-[13px]"
        />
        <input
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="Meeting URL (Zoom/Meet/Teams)"
          className="w-full h-8 px-3 rounded-md border border-border bg-background text-[13px]"
        />
        <div className="flex gap-2">
          <input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Bot name"
            className="flex-1 h-8 px-3 rounded-md border border-border bg-background text-[13px]"
          />
          <button
            onClick={() => m.mutate()}
            disabled={!meetingUrl.trim() || !botName.trim() || m.isPending}
            className="h-8 px-3 rounded-md bg-foreground text-background text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Create
          </button>
        </div>
        {m.isError && (
          <div className="text-[12px] text-red-500 whitespace-pre-wrap">
            {m.error instanceof Error ? m.error.message : "Failed to create bot."}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionPanel({ botId }: { botId: string | null }) {
  const base = (import.meta as any).env?.VITE_ALYSON_NOTETAKER_BASE_URL || (import.meta as any).env?.VITE_TEST_BOTV2_BASE_URL || "http://localhost:3002";

  const q = useQuery({
    queryKey: ["alyson-notetaker", "session", botId],
    queryFn: () => getNotetakerSession({ data: { botId: botId! } }),
    enabled: Boolean(botId),
    refetchInterval: 10_000,
  });

  const [live, setLive] = useState<NotetakerTranscriptLine[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [notesModel, setNotesModel] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const mergedLines = useMemo(() => {
    const staticLines = q.data?.lines ?? [];
    const all = [...staticLines, ...live];
    const seen = new Set<string>();
    const uniq: NotetakerTranscriptLine[] = [];
    for (const L of all) {
      const key = `${L.received_at}|${L.text || ""}|${L.participant?.id || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(L);
    }
    uniq.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
    return uniq;
  }, [q.data, live]);

  useEffect(() => {
    setLive([]);
    setNotes("");
    setNotesModel("");
    if (!botId) return;
    const url = `${String(base).replace(/\/$/, "")}/session/${encodeURIComponent(botId)}/events`;
    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data || "{}");
        if (msg?.type === "line" && msg?.line) {
          setLive((prev) => [...prev, msg.line]);
        }
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [botId, base]);

  const notesM = useMutation({
    mutationFn: async (prompt?: string) => generateNotetakerNotes({ data: { botId: botId!, prompt } }),
    onSuccess: (res) => {
      setNotes(res.notes);
      setNotesModel(res.model);
      setCopied(false);
    },
  });

  if (!botId) {
    return <div className="surface-card p-10 text-center text-[13px] text-muted-foreground">Pick a session to view transcript.</div>;
  }
  if (q.isLoading) return <div className="surface-card p-6"><div className="text-sm text-muted-foreground">Loading session…</div></div>;
  if (q.isError) {
    return (
      <div className="surface-card p-6">
        <div className="font-medium">Unable to load session</div>
        <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{q.error instanceof Error ? q.error.message : "Failed to load session."}</div>
        <div className="mt-4">
          <button onClick={() => q.refetch()} className="h-8 px-3 rounded-md bg-foreground text-background text-xs flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const session = q.data?.session;
  const plainNotes = notes ? notesToPlainText(notes) : "";

  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-[14px] truncate">{session?.title || "Meeting"}</div>
          <div className="text-[12px] text-muted-foreground truncate">{botId}</div>
        </div>
        <button
          onClick={() => notesM.mutate()}
          disabled={notesM.isPending}
          className="h-8 px-3 rounded-md bg-foreground text-background text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Generate notes
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30 text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium flex items-center justify-between">
            <span>Live transcript</span>
            <span className="normal-case tracking-normal text-[11px]">{mergedLines.length} lines</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {mergedLines.length === 0 ? (
              <div className="p-6 text-[13px] text-muted-foreground">No transcript lines yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {mergedLines.map((L, i) => (
                  <div key={`${L.received_at}-${i}`} className="p-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px] font-medium text-foreground">
                        {(L.initials || (L.participant?.name ? initialsFromName(L.participant.name) : "?")).slice(0, 2)}
                      </div>
                      <div className="truncate">{L.participant?.name || "Speaker"}</div>
                      <div className="ml-auto">{L.clock || clockFromIso(L.received_at)}</div>
                    </div>
                    <div className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap">{(L.text || "").trim()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
              Notes {notesModel ? <span className="normal-case tracking-normal text-[11px] ml-1 opacity-70">({notesModel})</span> : null}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  if (!plainNotes.trim()) return;
                  await navigator.clipboard.writeText(plainNotes);
                  setCopied(true);
                  toast.success("Text copied to clipboard");
                  window.setTimeout(() => setCopied(false), 1200);
                }}
                disabled={!plainNotes.trim()}
                className="h-7 w-7 grid place-items-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-50"
                title={copied ? "Copied" : "Copy notes"}
                aria-label="Copy notes"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!plainNotes.trim()) return;
                  const title = session?.title ? `Meeting notes — ${session.title}` : "Meeting notes";
                  try {
                    // @ts-expect-error: share is optional in many browsers
                    if (navigator.share) {
                      // @ts-expect-error: share is optional
                      await navigator.share({ title, text: plainNotes });
                      return;
                    }
                  } catch {
                    // fall through to mailto
                  }
                  const url = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(plainNotes)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                disabled={!plainNotes.trim()}
                className="h-7 w-7 grid place-items-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-50"
                title="Send notes"
                aria-label="Send notes"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {notesM.isError && (
              <div className="text-[12px] text-red-500 whitespace-pre-wrap mb-3">
                {notesM.error instanceof Error ? notesM.error.message : "Failed to generate notes."}
              </div>
            )}
            {notes ? (
              <div className="text-[13px] whitespace-pre-wrap leading-relaxed">{plainNotes}</div>
            ) : (
              <div className="text-[13px] text-muted-foreground">Generate notes to summarize the transcript.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function clockFromIso(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function notesToPlainText(md: string) {
  return String(md)
    .split("\n")
    .map((line) => {
      const t = line.trimEnd();
      if (/^#{1,6}\s+/.test(t)) return t.replace(/^#{1,6}\s+/, "").trim();
      if (/^[-*]\s+/.test(t)) return t.replace(/^[-*]\s+/, "• ").trim();
      return t;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

