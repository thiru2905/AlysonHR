
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tighten workflow policies (replace permissive ones)
DROP POLICY IF EXISTS "wf instances write" ON public.workflow_instances;
DROP POLICY IF EXISTS "wf steps write" ON public.workflow_steps;

CREATE POLICY "wf instances insert" ON public.workflow_instances FOR INSERT TO authenticated
  WITH CHECK (
    initiated_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance','manager']::app_role[])
  );
CREATE POLICY "wf instances update" ON public.workflow_instances FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance','manager','ceo']::app_role[]));
CREATE POLICY "wf instances delete" ON public.workflow_instances FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "wf steps insert" ON public.workflow_steps FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance','manager']::app_role[]));
CREATE POLICY "wf steps update" ON public.workflow_steps FOR UPDATE TO authenticated
  USING (
    approver_user = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance','manager','ceo']::app_role[])
  );
CREATE POLICY "wf steps delete" ON public.workflow_steps FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
