import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard, Users, DollarSign, TrendingUp, Gift, PieChart, Calendar,
  Clock, FileText, GitBranch, BarChart3, Shield, HelpCircle, Sparkles,
  Moon, Sun, ChevronsLeft, ChevronsRight, LogOut, Search, Bot, Menu, X, Send,
} from "lucide-react";
import { useAuth, ROLE_LABEL, type AppRole } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { CommandPalette } from "@/components/CommandPalette";
import { streamAlyson, type ChatMsg } from "@/lib/ai-client";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles?: AppRole[];
  group: "Workspace" | "People" | "Money" | "Ops" | "Admin";
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, group: "Workspace" },
  { to: "/team", label: "Team", icon: Users, group: "People", roles: ["super_admin", "ceo", "hr", "manager"] },
  { to: "/performance", label: "Performance", icon: TrendingUp, group: "People" },
  { to: "/leave", label: "Leave", icon: Calendar, group: "People" },
  { to: "/attendance", label: "Attendance", icon: Clock, group: "People" },
  { to: "/payroll", label: "Payroll", icon: DollarSign, group: "Money", roles: ["super_admin", "ceo", "finance", "hr"] },
  { to: "/bonus", label: "Bonus", icon: Gift, group: "Money", roles: ["super_admin", "ceo", "finance", "hr", "manager"] },
  { to: "/equity", label: "Equity", icon: PieChart, group: "Money" },
  { to: "/workflows", label: "Workflows", icon: GitBranch, group: "Ops" },
  { to: "/documents", label: "Documents", icon: FileText, group: "Ops" },
  { to: "/reports", label: "Reports", icon: BarChart3, group: "Ops", roles: ["super_admin", "ceo", "finance", "hr"] },
  { to: "/admin", label: "Admin", icon: Shield, group: "Admin", roles: ["super_admin"] },
  { to: "/help", label: "Help", icon: HelpCircle, group: "Admin" },
];

const ROLES: AppRole[] = ["super_admin", "ceo", "finance", "hr", "manager", "employee"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { hasAnyRole, primaryRole, demoRole, setDemoRole, signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const visible = NAV.filter((n) => !n.roles || hasAnyRole(n.roles));
  const grouped = groupBy(visible, (n) => n.group);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Cmd+K palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        className={[
          "border-r border-sidebar-border bg-sidebar flex flex-col transition-[width,transform] duration-200",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          collapsed ? "md:w-[60px]" : "md:w-[232px]",
          "fixed inset-y-0 left-0 z-40 w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "shrink-0",
        ].join(" ")}
      >
        <div className="px-3 pt-4 pb-3 border-b border-sidebar-border flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-foreground text-background grid place-items-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="leading-tight min-w-0 flex-1">
              <div className="font-display text-[16px] font-semibold tracking-tight truncate">Alyson HR</div>
              <div className="text-[10.5px] text-muted-foreground -mt-0.5">Acme, Inc.</div>
            </div>
          )}
          <button onClick={() => setMobileOpen(false)} className="md:hidden h-7 w-7 grid place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground" aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
          {(["Workspace", "People", "Money", "Ops", "Admin"] as const).map((g) => {
            const items = grouped[g];
            if (!items?.length) return null;
            const showLabel = !collapsed || mobileOpen;
            return (
              <div key={g}>
                {showLabel && (
                  <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium">{g}</div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to as "/"}
                        title={collapsed && !mobileOpen ? item.label : undefined}
                        className={
                          "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors " +
                          (active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {showLabel && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2 space-y-2">
          {(!collapsed || mobileOpen) && (
            <div className="rounded-md bg-sidebar-accent/40 border border-sidebar-border p-2">
              <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium mb-1.5 flex items-center justify-between">
                <span>Demo role</span>
                {demoRole && (
                  <button onClick={() => setDemoRole(null)} className="text-[10px] underline hover:no-underline normal-case tracking-normal">reset</button>
                )}
              </div>
              <select
                value={demoRole ?? primaryRole}
                onChange={(e) => setDemoRole(e.target.value as AppRole)}
                className="w-full h-7 rounded bg-paper border border-border text-xs px-1.5"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button onClick={toggle} title="Toggle theme" className="h-8 w-8 grid place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => setCollapsed((c) => !c)} title="Collapse" className="hidden md:grid h-8 w-8 place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors">
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
            <button onClick={signOut} title="Sign out" className="h-8 w-8 grid place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors ml-auto">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {(!collapsed || mobileOpen) && user && (
            <div className="px-1.5 pt-1 text-[11px] text-muted-foreground truncate">{user.email}</div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar onAi={() => setAiOpen((o) => !o)} onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <div className="flex-1 min-h-0">{children}</div>
      </main>

      {aiOpen && <AiPanel onClose={() => setAiOpen(false)} pagePath={location.pathname} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function TopBar({ onAi, onMenu, onSearch }: { onAi: () => void; onMenu: () => void; onSearch: () => void }) {
  return (
    <div className="h-12 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20 flex items-center px-3 md:px-5 gap-2 md:gap-3">
      <button onClick={onMenu} className="md:hidden h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground" aria-label="Open menu">
        <Menu className="h-4 w-4" />
      </button>
      <button onClick={onSearch} className="flex-1 max-w-md relative h-8 pl-8 pr-3 rounded-md border border-border bg-muted/40 text-[13px] text-left text-muted-foreground hover:bg-muted/60">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" />
        Jump to…
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded border border-border bg-background">⌘K</kbd>
      </button>
      <NotificationsPopover />
      <button onClick={onAi} className="h-8 px-2.5 md:px-3 rounded-md bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:opacity-90">
        <Bot className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ask Alyson</span>
      </button>
    </div>
  );
}

function AiPanel({ onClose, pagePath }: { onClose: () => void; pagePath: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: `Hi — I'm Alyson, your operations copilot. I can see you're on ${pagePath}. Ask me about formulas, payroll projections, equity vesting, or any KPI on this page.` },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMsg = { role: "user", content: input };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    await streamAlyson({
      messages: next,
      page: pagePath,
      onDelta: (d) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + d };
          return copy;
        });
      },
      onDone: () => setStreaming(false),
      onError: (msg) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
          return copy;
        });
        setStreaming(false);
      },
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onClose} aria-hidden />
      <aside className="fixed md:sticky right-0 top-0 z-40 w-full sm:w-[380px] md:w-[360px] shrink-0 border-l border-border bg-paper h-screen flex flex-col">
        <div className="h-12 border-b border-border px-4 flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <div className="font-medium text-sm">Alyson AI</div>
          <div className="ml-auto">
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">Close</button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[90%]"}>
              <div className={"rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap " + (m.role === "user" ? "bg-foreground text-background" : "bg-muted/60 text-foreground")}>
                {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="p-3 border-t border-border flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={streaming}
            className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
          />
          <button type="submit" disabled={streaming || !input.trim()} className="h-9 w-9 grid place-items-center rounded-md bg-foreground text-background disabled:opacity-40">
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </aside>
    </>
  );
}

export function PageHeader({
  eyebrow, title, description, actions, dense = false,
}: {
  eyebrow?: string; title: string; description?: string; actions?: React.ReactNode; dense?: boolean;
}) {
  return (
    <div className={`flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6 px-5 md:px-8 ${dense ? "pt-5 pb-4" : "pt-7 md:pt-9 pb-5 md:pb-6"} border-b border-border`}>
      <div>
        {eyebrow && (
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-1.5">{eyebrow}</div>
        )}
        <h1 className={`font-display ${dense ? "text-xl md:text-2xl" : "text-2xl md:text-[34px]"} font-semibold tracking-tight text-foreground leading-tight`}>{title}</h1>
        {description && (
          <p className="mt-1.5 text-[13px] md:text-[14px] text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function TableScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`surface-ops overflow-x-auto ${className}`}>
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}

export function EmptyState({
  title, description, icon: Icon, action,
}: {
  title: string; description?: string; icon?: React.ComponentType<{ className?: string }>; action?: React.ReactNode;
}) {
  return (
    <div className="surface-card p-10 text-center">
      {Icon && (
        <div className="mx-auto h-10 w-10 rounded-full bg-muted grid place-items-center text-muted-foreground mb-3">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="font-medium text-[15px]">{title}</div>
      {description && <div className="text-[13px] text-muted-foreground mt-1 max-w-md mx-auto">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    (out[k] ||= []).push(item);
  }
  return out;
}
