import { supabase } from "@/integrations/supabase/client";

export type Department = { id: string; name: string };
export type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  level: string;
  department_id: string;
  hire_date: string;
  performance_score: number;
};
export type Compensation = {
  id: string;
  employee_id: string;
  base_salary: number;
  bonus_pct: number;
  equity_grant: number;
  benefits: number;
  effective_date: string;
};
export type MetricsRow = {
  id: string;
  period: string;
  total_compensation: number;
  total_bonus: number;
  headcount: number;
  avg_performance: number;
};
export type FormulaInput = {
  name: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  unit: string;
};
export type Formula = {
  id: string;
  name: string;
  description: string;
  expression: string;
  inputs: FormulaInput[];
  category: string;
};

export type EmployeeFull = Employee & {
  department_name: string;
  comp: Compensation | null;
  total_comp: number;
  effective_bonus: number;
};

export async function fetchOverview() {
  const [deps, emps, comps, metrics] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("employees").select("*"),
    supabase.from("compensation").select("*"),
    supabase.from("metrics_history").select("*").order("period"),
  ]);

  if (deps.error) throw deps.error;
  if (emps.error) throw emps.error;
  if (comps.error) throw comps.error;
  if (metrics.error) throw metrics.error;

  const departments = deps.data as Department[];
  const employees = emps.data as Employee[];
  const compensation = comps.data as Compensation[];
  const history = metrics.data as MetricsRow[];

  const compByEmp = new Map(compensation.map((c) => [c.employee_id, c]));
  const deptById = new Map(departments.map((d) => [d.id, d.name]));

  const employeesFull: EmployeeFull[] = employees.map((e) => {
    const c = compByEmp.get(e.id) ?? null;
    const base = Number(c?.base_salary ?? 0);
    const bonus = Number(c?.bonus_pct ?? 0);
    const perf = Number(e.performance_score);
    const equity = Number(c?.equity_grant ?? 0);
    const benefits = Number(c?.benefits ?? 0);
    const effective_bonus = (base * bonus) / 100 * (perf / 3);
    const total_comp = base + effective_bonus + equity + benefits;
    return {
      ...e,
      department_name: deptById.get(e.department_id) ?? "—",
      comp: c,
      total_comp,
      effective_bonus,
    };
  });

  return { departments, employees: employeesFull, history };
}

export async function fetchFormulas(): Promise<Formula[]> {
  const { data, error } = await supabase.from("formulas").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((f) => ({
    ...f,
    inputs: typeof f.inputs === "string" ? JSON.parse(f.inputs) : (f.inputs as FormulaInput[]),
  })) as Formula[];
}
