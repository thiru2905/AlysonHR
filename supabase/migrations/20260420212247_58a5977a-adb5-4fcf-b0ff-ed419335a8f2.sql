
DROP POLICY IF EXISTS "audit insert" ON public.audit_log;
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','hr','finance','manager','ceo']::app_role[])
  );
