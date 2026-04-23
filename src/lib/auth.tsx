import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "ceo" | "finance" | "hr" | "manager" | "employee";

const DEMO_ROLE_KEY = "alyson-demo-role";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  realRoles: AppRole[];
  /** Demo override role (single role) — used by the demo role switcher */
  demoRole: AppRole | null;
  setDemoRole: (role: AppRole | null) => void;
  /** Effective roles after demo override */
  roles: AppRole[];
  /** Highest-priority role (for landing routing) */
  primaryRole: AppRole;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_PRIORITY: AppRole[] = ["super_admin", "ceo", "finance", "hr", "manager", "employee"];

function pickPrimary(roles: AppRole[]): AppRole {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return "employee";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [realRoles, setRealRoles] = useState<AppRole[]>([]);
  const [demoRole, setDemoRoleState] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Load demo role from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(DEMO_ROLE_KEY) as AppRole | null;
    if (stored) setDemoRoleState(stored);
  }, []);

  const setDemoRole = useCallback((role: AppRole | null) => {
    setDemoRoleState(role);
    if (role) localStorage.setItem(DEMO_ROLE_KEY, role);
    else localStorage.removeItem(DEMO_ROLE_KEY);
  }, []);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (data) setRealRoles(data.map((r) => r.role as AppRole));
  }, []);

  useEffect(() => {
    // Set up listener BEFORE getSession
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // Defer role fetch
        setTimeout(() => fetchRoles(sess.user.id), 0);
      } else {
        setRealRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) fetchRoles(sess.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchRoles]);

  const roles = demoRole ? [demoRole] : realRoles.length > 0 ? realRoles : ["employee"] as AppRole[];
  const primaryRole = pickPrimary(roles);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setDemoRole(null);
  }, [setDemoRole]);

  const hasRole = useCallback((r: AppRole) => roles.includes(r), [roles]);
  const hasAnyRole = useCallback((rs: AppRole[]) => rs.some((r) => roles.includes(r)), [roles]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        realRoles,
        demoRole,
        setDemoRole,
        roles,
        primaryRole,
        loading,
        signOut,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  ceo: "CEO",
  finance: "Finance",
  hr: "HR",
  manager: "Manager",
  employee: "Employee",
};
