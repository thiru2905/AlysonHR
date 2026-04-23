
-- Compensation & Metrics Intelligence schema
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  level TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  hire_date DATE NOT NULL,
  performance_score NUMERIC(3,2) NOT NULL DEFAULT 3.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  base_salary NUMERIC(12,2) NOT NULL,
  bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  equity_grant NUMERIC(12,2) NOT NULL DEFAULT 0,
  benefits NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period DATE NOT NULL,
  total_compensation NUMERIC(14,2) NOT NULL,
  total_bonus NUMERIC(14,2) NOT NULL,
  headcount INTEGER NOT NULL,
  avg_performance NUMERIC(3,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  expression TEXT NOT NULL,
  inputs JSONB NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;

-- Public read for demo dashboard (no auth required)
CREATE POLICY "Public read departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Public read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Public read compensation" ON public.compensation FOR SELECT USING (true);
CREATE POLICY "Public read metrics_history" ON public.metrics_history FOR SELECT USING (true);
CREATE POLICY "Public read formulas" ON public.formulas FOR SELECT USING (true);

CREATE INDEX idx_employees_department ON public.employees(department_id);
CREATE INDEX idx_compensation_employee ON public.compensation(employee_id);
CREATE INDEX idx_metrics_period ON public.metrics_history(period);
