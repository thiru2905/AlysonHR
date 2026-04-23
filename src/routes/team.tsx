import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchOverview, type EmployeeFull } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { PageSkeleton } from "@/components/Skeleton";
import { fmtCurrency } from "@/lib/format";
import { useState } from "react";
import { Search, Users, LayoutGrid, Network } from "lucide-react";
import { OrgChart } from "@/components/OrgChart";
import { EmployeeDrawer } from "@/components/drawers/EmployeeDrawer";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — Alyson HR" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: fetchOverview });
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [view, setView] = useState<"directory" | "chart">("directory");
  const [picked, setPicked] = useState<EmployeeFull | null>(null);

  if (isLoading || !data) return <PageSkeleton />;

  const filtered = data.employees.filter((e) => {
    if (dept !== "all" && e.department_id !== dept) return false;
    if (q && !e.full_name.toLowerCase().includes(q.toLowerCase()) && !e.role.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="ops-dense">
      <PageHeader
        eyebrow="People"
        title="Team directory"
        description="Browse, filter, and drill into every active employee across the organization."
        actions={
          <div className="inline-flex rounded-md border border-border p-0.5 bg-paper">
            <button
              onClick={() => setView("directory")}
              className={"h-7 px-2.5 rounded text-[11.5px] font-medium flex items-center gap-1.5 " + (view === "directory" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-3 w-3" />Directory
            </button>
            <button
              onClick={() => setView("chart")}
              className={"h-7 px-2.5 rounded text-[11.5px] font-medium flex items-center gap-1.5 " + (view === "chart" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <Network className="h-3 w-3" />Org chart
            </button>
          </div>
        }
      />
      <div className="px-5 md:px-8 py-6 space-y-5">
        {view === "directory" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role…" className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-background text-[13px]" />
              </div>
              <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-8 px-2 rounded-md border border-border bg-background text-[13px]">
                <option value="all">All departments</option>
                {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div className="sm:ml-auto text-xs text-muted-foreground">{filtered.length} of {data.employees.length}</div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Users} title="No employees match your filters" description="Try clearing the search or selecting all departments." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((e) => (
                  <button key={e.id} onClick={() => setPicked(e)} className="surface-card p-4 hover:shadow-lg transition-shadow group text-left">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground grid place-items-center font-medium text-sm shrink-0">
                        {e.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[14px] truncate">{e.full_name}</div>
                        <div className="text-[12px] text-muted-foreground truncate">{e.role}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="pill pill-neutral">{e.department_name}</span>
                      <span className="pill pill-neutral">L{e.level}</span>
                      <span className={`pill ${e.performance_score >= 4 ? "pill-success" : e.performance_score >= 3 ? "pill-info" : "pill-warning"}`}>
                        {e.performance_score.toFixed(1)}★
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground flex justify-between">
                      <span>Total comp</span>
                      <span className="font-mono text-foreground">{fmtCurrency(e.total_comp, { compact: true })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {view === "chart" && <OrgChart employees={data.employees} />}
      </div>

      <EmployeeDrawer employee={picked} onClose={() => setPicked(null)} />
    </div>
  );
}
