import { Drawer } from "@/components/Drawer";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtCurrency, fmtDate } from "@/lib/format";
import type { EmployeeFull } from "@/lib/queries";

type Tab = "overview" | "comp" | "payroll" | "leave" | "reviews" | "equity" | "audit";
const TABS: { k: Tab; label: string }[] = [
  { k: "overview", label: "Overview" },
  { k: "comp", label: "Compensation" },
  { k: "payroll", label: "Payroll" },
  { k: "leave", label: "Leave" },
  { k: "reviews", label: "Reviews" },
  { k: "equity", label: "Equity" },
  { k: "audit", label: "Audit" },
];

export function EmployeeDrawer({
  employee,
  onClose,
}: {
  employee: EmployeeFull | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <Drawer
      open={!!employee}
      onClose={onClose}
      title={employee?.full_name ?? ""}
      eyebrow={employee ? `${employee.role} · ${employee.department_name}` : undefined}
      width="xl"
    >
      {employee && (
        <div>
          <div className="px-5 pt-4 border-b border-border flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={
                  "px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors whitespace-nowrap " +
                  (tab === t.k
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "overview" && <OverviewTab e={employee} />}
            {tab === "comp" && <CompTab e={employee} />}
            {tab === "payroll" && <PayrollTab id={employee.id} />}
            {tab === "leave" && <LeaveTab id={employee.id} />}
            {tab === "reviews" && <ReviewsTab id={employee.id} />}
            {tab === "equity" && <EquityTab id={employee.id} />}
            {tab === "audit" && <AuditTab id={employee.id} />}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function OverviewTab({ e }: { e: EmployeeFull }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Level" value={e.level} />
        <Stat label="Performance" value={`${Number(e.performance_score).toFixed(1)} / 5`} />
        <Stat label="Hire date" value={fmtDate(e.hire_date)} />
        <Stat label="Total comp" value={fmtCurrency(e.total_comp, { compact: true })} />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Email</div>
        <div className="text-[13px] font-mono">{e.email}</div>
      </div>
    </div>
  );
}

function CompTab({ e }: { e: EmployeeFull }) {
  if (!e.comp) return <Empty msg="No compensation record on file." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Base salary" value={fmtCurrency(Number(e.comp.base_salary))} />
        <Stat label="Bonus %" value={`${Number(e.comp.bonus_pct).toFixed(1)}%`} />
        <Stat label="Equity grant" value={fmtCurrency(Number(e.comp.equity_grant))} />
        <Stat label="Benefits" value={fmtCurrency(Number(e.comp.benefits))} />
      </div>
      <div className="surface-card p-4 bg-muted/30">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Effective bonus (perf-weighted)</div>
        <div className="font-display text-2xl mt-1">{fmtCurrency(e.effective_bonus)}</div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Effective from {fmtDate(e.comp.effective_date)}
      </div>
    </div>
  );
}

function PayrollTab({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["emp-payroll", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("*, payroll_runs(period, status)")
        .eq("employee_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data?.length) return <Empty msg="No payroll items yet." />;
  return (
    <div className="space-y-2">
      {data.map((p: any) => (
        <div key={p.id} className="flex justify-between py-2 border-b border-border text-[13px]">
          <div>
            <div className="font-medium capitalize">{p.item_type.replace(/_/g, " ")}</div>
            <div className="text-[11px] text-muted-foreground">
              {p.payroll_runs?.period ? new Date(p.payroll_runs.period).toLocaleDateString("en", { month: "short", year: "numeric" }) : "—"}
            </div>
          </div>
          <div className="font-mono">{fmtCurrency(Number(p.amount))}</div>
        </div>
      ))}
    </div>
  );
}

function LeaveTab({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["emp-leave", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name, color, code)")
        .eq("employee_id", id);
      return data ?? [];
    },
  });
  if (!data?.length) return <Empty msg="No leave balances on file." />;
  return (
    <div className="space-y-2">
      {data.map((b: any) => (
        <div key={b.id} className="surface-card p-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: b.leave_types?.color }} />
            <div>
              <div className="font-medium text-[13px]">{b.leave_types?.name}</div>
              <div className="text-[11px] text-muted-foreground">{b.year}</div>
            </div>
          </div>
          <div className="text-right font-mono text-[13px]">
            {Number(b.remaining).toFixed(1)} <span className="text-muted-foreground">/ {Number(b.entitled).toFixed(1)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["emp-reviews", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, review_cycles(name, status)")
        .eq("employee_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  if (!data?.length) return <Empty msg="No reviews yet." />;
  return (
    <div className="space-y-2">
      {data.map((r: any) => (
        <div key={r.id} className="surface-card p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-[13px]">{r.review_cycles?.name ?? "Cycle"}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{r.status}</div>
            </div>
            <span className={`pill ${Number(r.rating) >= 4 ? "pill-success" : Number(r.rating) >= 3 ? "pill-info" : "pill-warning"}`}>{Number(r.rating).toFixed(1)}</span>
          </div>
          {r.comments && <div className="mt-2 text-[12px] text-muted-foreground italic">"{r.comments}"</div>}
        </div>
      ))}
    </div>
  );
}

function EquityTab({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["emp-equity", id],
    queryFn: async () => {
      const { data: holders } = await supabase
        .from("equity_holders")
        .select("id, equity_grants(*)")
        .eq("employee_id", id);
      return (holders ?? []).flatMap((h: any) => h.equity_grants ?? []);
    },
  });
  if (!data?.length) return <Empty msg="No equity grants for this employee." />;
  return (
    <div className="space-y-2">
      {data.map((g: any) => (
        <div key={g.id} className="surface-card p-3 flex justify-between text-[13px]">
          <div>
            <div className="font-medium capitalize">{g.security_type.replace(/_/g, " ")}</div>
            <div className="text-[11px] text-muted-foreground">
              {fmtDate(g.grant_date)} · {g.cliff_months}m cliff · {g.vesting_years}y vest
            </div>
          </div>
          <div className="text-right font-mono">{Number(g.total_shares).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["emp-audit", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });
  if (!data?.length) return <Empty msg="No audit entries." />;
  return (
    <div className="space-y-1.5">
      {data.map((a: any) => (
        <div key={a.id} className="text-[12px] py-1.5 border-b border-border">
          <span className="font-mono">{a.action}</span>
          <span className="text-muted-foreground ml-2">{fmtDate(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium text-[14px] mt-0.5">{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-[13px] text-muted-foreground py-6 text-center">{msg}</div>;
}
