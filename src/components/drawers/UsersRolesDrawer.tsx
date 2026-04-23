import { Drawer } from "@/components/Drawer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { ROLE_LABEL, type AppRole } from "@/lib/auth";
import { TextInput, Field, GhostBtn } from "@/components/forms/FormField";
import { Search, Plus, Trash2 } from "lucide-react";

const ROLES: AppRole[] = ["super_admin", "ceo", "finance", "hr", "manager", "employee"];

export function UsersRolesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, employee_id");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: any) => {
        const list = map.get(r.user_id) ?? [];
        list.push(r.role);
        map.set(r.user_id, list);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: map.get(p.id) ?? [] }));
    },
    enabled: open,
  });

  const filtered = (data ?? []).filter((u) => !q || (u.display_name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <Drawer open={open} onClose={onClose} title="Users & roles" eyebrow="Admin" width="xl">
      <div className="p-5 space-y-4">
        <Field label="Search">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name…" className="pl-8" />
          </div>
        </Field>

        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
          {!filtered.length && <div className="py-6 text-center text-[13px] text-muted-foreground">No users match.</div>}
        </div>
      </div>
    </Drawer>
  );
}

function UserRow({ user }: { user: { id: string; display_name: string | null; roles: AppRole[] } }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<AppRole>("employee");

  const add = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success("Role assigned");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const revoke = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success("Role removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const available = ROLES.filter((r) => !user.roles.includes(r));

  return (
    <div className="surface-card p-3 space-y-2">
      <div className="font-medium text-[13px]">{user.display_name ?? "Unnamed"}</div>
      <div className="flex flex-wrap gap-1.5">
        {user.roles.length === 0 && <span className="text-[11px] text-muted-foreground italic">No roles</span>}
        {user.roles.map((r) => (
          <span key={r} className="pill pill-info inline-flex items-center gap-1">
            {ROLE_LABEL[r]}
            <button onClick={() => revoke.mutate(r)} className="hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={adding} onChange={(e) => setAdding(e.target.value as AppRole)} className="h-7 px-2 rounded-md border border-border bg-background text-[12px]">
            {available.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <GhostBtn type="button" onClick={() => add.mutate(adding)} className="h-7 text-[11.5px]">
            <Plus className="h-3 w-3" />Add
          </GhostBtn>
        </div>
      )}
    </div>
  );
}
