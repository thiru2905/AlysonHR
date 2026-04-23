import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Alyson HR" },
      { name: "description", content: "Sign in to Alyson HR — your people, payroll, and equity OS." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Left — brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden border-r border-border" style={{ background: "var(--gradient-paper)" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, var(--ink) 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-foreground text-background grid place-items-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-2xl font-semibold tracking-tight">Alyson HR</div>
              <div className="text-xs text-muted-foreground -mt-0.5">People, Pay & Equity OS</div>
            </div>
          </div>
          <div className="max-w-md">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">For modern operators</div>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight mt-3">
              Run your company's people, money, and equity from one calm place.
            </h1>
            <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
              Alyson unifies payroll, performance, leave, attendance, and equity into a single executive-grade workspace.
              No spreadsheets. No reconciliation hell.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">© Alyson, Inc. — Internal use only</div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background grid place-items-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="font-display text-xl font-semibold">Alyson HR</div>
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to continue to your workspace." : "Start with a fresh workspace in 30 seconds."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Ada Lovelace"
                />
              </Field>
            )}
            <Field label="Work email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New to Alyson?{" "}
                <button onClick={() => setMode("signup")} className="text-foreground font-medium underline-offset-2 hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-foreground font-medium underline-offset-2 hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-8 rounded-md bg-muted/50 border border-border px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Demo tip:</span> Sign up with any email — once inside, use the role
            switcher in the sidebar to preview the app as CEO, Finance, HR, Manager, or Employee.
          </div>
        </div>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--paper);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-field:focus {
          border-color: var(--ring);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
