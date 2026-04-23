
-- =====================================================
-- ROLES
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'ceo', 'finance', 'hr', 'manager', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- =====================================================
-- EXTENDED EMPLOYEE FIELDS
-- =====================================================
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS dotted_manager_id UUID REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS employee_type TEXT NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =====================================================
-- PAYROLL
-- =====================================================
CREATE TYPE public.payroll_status AS ENUM ('draft','manager_review','finance_review','approved','paid');
CREATE TYPE public.payroll_item_type AS ENUM ('base','overtime','reimbursement','spot_bonus','quarterly_bonus','annual_bonus','equity_payout','adjustment','deduction');

CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period DATE NOT NULL,
  status payroll_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_employees INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE TABLE public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  item_type payroll_item_type NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  override_reason TEXT,
  override_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- BONUS
-- =====================================================
CREATE TYPE public.bonus_type AS ENUM ('fixed','discretionary','team_pool','target','review_score','formula');
CREATE TYPE public.bonus_status AS ENUM ('draft','simulated','manager_approved','finance_approved','paid');

CREATE TABLE public.bonus_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bonus_type bonus_type NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'quarterly',
  formula TEXT,
  pool_amount NUMERIC,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bonus_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.bonus_plans(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  predicted_amount NUMERIC NOT NULL DEFAULT 0,
  final_amount NUMERIC,
  status bonus_status NOT NULL DEFAULT 'draft',
  cycle_period DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- EQUITY
-- =====================================================
CREATE TYPE public.holder_type AS ENUM ('employee','founder','investor','advisor','entity');
CREATE TYPE public.security_type AS ENUM ('options','rsu','common_share','preferred_share','warrant');

CREATE TABLE public.equity_holders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_type holder_type NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  display_name TEXT NOT NULL,
  email TEXT,
  entity_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.equity_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id UUID NOT NULL REFERENCES public.equity_holders(id) ON DELETE CASCADE,
  security_type security_type NOT NULL,
  total_shares NUMERIC NOT NULL,
  strike_price NUMERIC NOT NULL DEFAULT 0,
  grant_date DATE NOT NULL,
  vesting_start DATE NOT NULL,
  vesting_years INTEGER NOT NULL DEFAULT 8,
  cliff_months INTEGER NOT NULL DEFAULT 12,
  vesting_frequency TEXT NOT NULL DEFAULT 'monthly',
  board_approved BOOLEAN NOT NULL DEFAULT false,
  certificate_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vesting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.equity_grants(id) ON DELETE CASCADE,
  vest_date DATE NOT NULL,
  shares_vested NUMERIC NOT NULL,
  cumulative_vested NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- LEAVE
-- =====================================================
CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled');

CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT true,
  requires_doc BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#999'
);

CREATE TABLE public.leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  employee_type TEXT,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  annual_days NUMERIC NOT NULL DEFAULT 0,
  rollover_days NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL,
  reason TEXT,
  status leave_status NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  entitled NUMERIC NOT NULL DEFAULT 0,
  taken NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  UNIQUE (employee_id, leave_type_id, year)
);

-- =====================================================
-- ATTENDANCE
-- =====================================================
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  work_date DATE NOT NULL,
  source_hours NUMERIC NOT NULL DEFAULT 0,
  approved_hours NUMERIC NOT NULL DEFAULT 0,
  adjusted_hours NUMERIC NOT NULL DEFAULT 0,
  activity_score NUMERIC NOT NULL DEFAULT 100,
  adjustment_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- DOCUMENTS
-- =====================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  file_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private',
  expires_at DATE,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  linked_type TEXT NOT NULL,
  linked_id UUID NOT NULL
);

-- =====================================================
-- WORKFLOWS
-- =====================================================
CREATE TYPE public.wf_status AS ENUM ('pending','approved','rejected','cancelled','overdue');

CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.workflow_templates(id),
  module TEXT NOT NULL,
  subject TEXT NOT NULL,
  reference_id UUID,
  status wf_status NOT NULL DEFAULT 'pending',
  initiated_by UUID REFERENCES auth.users(id),
  current_step INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  approver_role app_role,
  approver_user UUID REFERENCES auth.users(id),
  status wf_status NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMPTZ,
  comment TEXT
);

-- =====================================================
-- PERFORMANCE
-- =====================================================
CREATE TABLE public.review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  reviewer_id UUID REFERENCES public.employees(id),
  rating NUMERIC NOT NULL DEFAULT 3,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  promotion_ready BOOLEAN NOT NULL DEFAULT false,
  bonus_recommendation NUMERIC,
  equity_recommendation NUMERIC,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- AUDIT & HELP
-- =====================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  formula TEXT NOT NULL,
  plain_english TEXT NOT NULL,
  source_tables TEXT[] NOT NULL DEFAULT '{}',
  downstream TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ENABLE RLS ON ALL NEW TABLES
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vesting_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================
-- Profiles: users see/update self; admins/HR see all
CREATE POLICY "users see own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','hr','ceo']::app_role[]));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Roles: users see own; super_admin manages all
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Generic helper: read-all for authenticated; write for finance/hr/admin
-- Replace existing public-read policies on legacy tables
DROP POLICY IF EXISTS "Public read employees" ON public.employees;
DROP POLICY IF EXISTS "Public read departments" ON public.departments;
DROP POLICY IF EXISTS "Public read compensation" ON public.compensation;
DROP POLICY IF EXISTS "Public read formulas" ON public.formulas;
DROP POLICY IF EXISTS "Public read metrics_history" ON public.metrics_history;

CREATE POLICY "auth read employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read compensation" ON public.compensation FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr','manager']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = compensation.employee_id)
);
CREATE POLICY "auth read formulas" ON public.formulas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read metrics" ON public.metrics_history FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr']::app_role[])
);

-- Payroll
CREATE POLICY "payroll read" ON public.payroll_runs FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr','manager']::app_role[])
);
CREATE POLICY "payroll write" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]));

CREATE POLICY "payroll items read" ON public.payroll_items FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr','manager']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = payroll_items.employee_id)
);
CREATE POLICY "payroll items write" ON public.payroll_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]));

-- Bonus
CREATE POLICY "bonus plans read" ON public.bonus_plans FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr','manager']::app_role[])
);
CREATE POLICY "bonus plans write" ON public.bonus_plans FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance','hr']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance','hr']::app_role[]));

CREATE POLICY "bonus awards read" ON public.bonus_awards FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr','manager']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = bonus_awards.employee_id)
);
CREATE POLICY "bonus awards write" ON public.bonus_awards FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance','hr','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance','hr','manager']::app_role[]));

-- Equity
CREATE POLICY "equity holders read" ON public.equity_holders FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = equity_holders.employee_id)
);
CREATE POLICY "equity holders write" ON public.equity_holders FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]));

CREATE POLICY "equity grants read" ON public.equity_grants FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance']::app_role[])
  OR EXISTS (SELECT 1 FROM public.equity_holders h JOIN public.profiles p ON p.employee_id = h.employee_id
             WHERE h.id = equity_grants.holder_id AND p.id = auth.uid())
);
CREATE POLICY "equity grants write" ON public.equity_grants FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]));

CREATE POLICY "vesting read" ON public.vesting_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "vesting write" ON public.vesting_events FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','finance']::app_role[]));

-- Leave
CREATE POLICY "leave types read" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave types write" ON public.leave_types FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]));

CREATE POLICY "leave policies read" ON public.leave_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave policies write" ON public.leave_policies FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]));

CREATE POLICY "leave requests read" ON public.leave_requests FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager','ceo']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = leave_requests.employee_id)
);
CREATE POLICY "leave requests insert" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = leave_requests.employee_id)
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[])
  );
CREATE POLICY "leave requests update" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager']::app_role[]));

CREATE POLICY "leave balances read" ON public.leave_balances FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager','ceo']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = leave_balances.employee_id)
);
CREATE POLICY "leave balances write" ON public.leave_balances FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]));

-- Attendance
CREATE POLICY "attendance read" ON public.attendance_records FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager','ceo','finance']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = attendance_records.employee_id)
);
CREATE POLICY "attendance write" ON public.attendance_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager']::app_role[]));

-- Documents
CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents write" ON public.documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance']::app_role[]));
CREATE POLICY "doc links read" ON public.document_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc links write" ON public.document_links FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance']::app_role[]));

-- Workflows
CREATE POLICY "wf templates read" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "wf templates write" ON public.workflow_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "wf instances read" ON public.workflow_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "wf instances write" ON public.workflow_instances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wf steps read" ON public.workflow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "wf steps write" ON public.workflow_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Performance
CREATE POLICY "cycles read" ON public.review_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycles write" ON public.review_cycles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr']::app_role[]));
CREATE POLICY "reviews read" ON public.reviews FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager','ceo']::app_role[])
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.employee_id = reviews.employee_id)
);
CREATE POLICY "reviews write" ON public.reviews FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','manager']::app_role[]));

-- Audit + KPI
CREATE POLICY "audit read" ON public.audit_log FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','ceo','finance','hr']::app_role[])
);
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "kpi read" ON public.kpi_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi write" ON public.kpi_definitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
