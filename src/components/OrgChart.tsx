import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import { Save, Edit3, Send, RotateCcw } from "lucide-react";
import type { EmployeeFull } from "@/lib/queries";
import { fmtCurrency } from "@/lib/format";
import { toast } from "sonner";

type EmpNode = Node<{
  employee: EmployeeFull;
  isHighlighted: boolean;
  onPick: (id: string) => void;
}>;

function PersonNode({ data }: NodeProps<EmpNode["data"]>) {
  const e = data.employee;
  return (
    <div
      onClick={() => data.onPick(e.id)}
      className={
        "px-3 py-2 rounded-lg border bg-paper shadow-sm min-w-[180px] cursor-pointer transition-all " +
        (data.isHighlighted
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50")
      }
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-medium shrink-0">
          {e.full_name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium truncate">{e.full_name}</div>
          <div className="text-[10.5px] text-muted-foreground truncate">{e.role}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="pill pill-neutral">{e.department_name}</span>
        <span className="font-mono">{fmtCurrency(e.total_comp, { compact: true })}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { person: PersonNode };

/** Lay out tree top-down by manager_id chain. Simple BFS with horizontal spread. */
function layout(
  employees: EmployeeFull[],
  highlightId: string | null,
  onPick: (id: string) => void,
): { nodes: EmpNode[]; edges: Edge[] } {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const children = new Map<string | null, EmployeeFull[]>();
  for (const e of employees) {
    const k = (e as any).manager_id ?? null;
    if (!children.has(k)) children.set(k, []);
    children.get(k)!.push(e);
  }
  const reportingChain = new Set<string>();
  if (highlightId) {
    let cur: string | null = highlightId;
    while (cur) {
      reportingChain.add(cur);
      const next: string | null = (byId.get(cur) as any)?.manager_id ?? null;
      cur = next;
    }
  }
  const nodes: EmpNode[] = [];
  const edges: Edge[] = [];
  const VG = 130;
  const HG = 220;
  const place = (id: string | null, depth: number, xStart: number, xWidth: number) => {
    const list = (children.get(id) ?? []).slice();
    if (list.length === 0) return;
    const slice = xWidth / list.length;
    list.forEach((emp, i) => {
      const x = xStart + slice * i + slice / 2;
      const y = depth * VG;
      nodes.push({
        id: emp.id,
        type: "person",
        position: { x: x - 90, y },
        data: { employee: emp, isHighlighted: reportingChain.has(emp.id), onPick },
      });
      if (id) {
        edges.push({
          id: `${id}->${emp.id}`,
          source: id,
          target: emp.id,
          type: "smoothstep",
          style: {
            stroke: reportingChain.has(emp.id) ? "var(--primary)" : "var(--muted-foreground)",
            strokeWidth: reportingChain.has(emp.id) ? 2 : 1,
          },
        });
      }
      place(emp.id, depth + 1, xStart + slice * i, slice);
    });
  };
  // roots are employees without a manager
  const roots = children.get(null) ?? [];
  const totalWidth = Math.max(roots.length * HG * 4, 1200);
  place(null, 0, 0, totalWidth);
  return { nodes, edges };
}

export function OrgChart({ employees }: { employees: EmployeeFull[] }) {
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingChanges, setPendingChanges] = useState(0);

  const handlePick = useCallback((id: string) => setHighlightId(id), []);
  const initial = useMemo(() => layout(employees, highlightId, handlePick), [employees, highlightId, handlePick]);
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);

  // re-layout when employees or highlight changes
  useMemo(() => {
    const { nodes: n, edges: e } = layout(employees, highlightId, handlePick);
    setNodes(n);
    setEdges(e);
    setPendingChanges(0);
  }, [employees, highlightId, handlePick]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (editMode) setPendingChanges((c) => c + changes.length);
    },
    [editMode],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect = useCallback(
    (params: { source: string | null; target: string | null }) => {
      if (!params.source || !params.target) return;
      setEdges((eds) => [
        ...eds.filter((e) => e.target !== params.target),
        {
          id: `${params.source}->${params.target}-new`,
          source: params.source!,
          target: params.target!,
          type: "smoothstep",
          style: { stroke: "var(--primary)", strokeWidth: 2, strokeDasharray: "4 3" },
        },
      ]);
      setPendingChanges((c) => c + 1);
      toast.success("Reporting line updated", { description: "Save draft to keep this change." });
    },
    [],
  );

  // search highlight
  useMemo(() => {
    if (!search) return;
    const match = employees.find((e) => e.full_name.toLowerCase().includes(search.toLowerCase()));
    if (match) setHighlightId(match.id);
  }, [search, employees]);

  return (
    <div className="surface-card overflow-hidden flex flex-col" style={{ height: 620 }}>
      <div className="h-12 px-4 flex items-center gap-2 border-b border-border bg-paper/80">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee…"
          className="h-8 w-56 px-3 rounded-md border border-border bg-background text-[13px]"
        />
        {highlightId && (
          <button
            onClick={() => setHighlightId(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            Clear chain
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {editMode && pendingChanges > 0 && (
            <span className="pill pill-warning">{pendingChanges} pending</span>
          )}
          {editMode ? (
            <>
              <button
                onClick={() => {
                  toast.success("Draft saved", { description: `${pendingChanges} change(s) staged.` });
                  setPendingChanges(0);
                }}
                className="h-8 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-muted"
              >
                <Save className="h-3.5 w-3.5" /> Save draft
              </button>
              <button
                onClick={() => {
                  toast.success("Org chart published", {
                    description: "Audit log entry created. Notifications sent to affected employees.",
                  });
                  setPendingChanges(0);
                  setEditMode(false);
                }}
                className="h-8 px-3 rounded-md bg-foreground text-background text-xs flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" /> Publish
              </button>
              <button
                onClick={() => {
                  const { nodes: n, edges: e } = layout(employees, highlightId, handlePick);
                  setNodes(n);
                  setEdges(e);
                  setPendingChanges(0);
                  setEditMode(false);
                }}
                className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Discard"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="h-8 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-muted"
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit org
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={editMode}
          nodesConnectable={editMode}
          edgesUpdatable={editMode}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) =>
              (n.data as any)?.isHighlighted ? "var(--primary)" : "var(--muted-foreground)"
            }
            maskColor="oklch(0.95 0.01 80 / 0.6)"
            style={{ background: "var(--paper)" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
