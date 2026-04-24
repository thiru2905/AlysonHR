-- One-time backfill: link existing profiles to employees by email match
-- This is safe to re-run; it only fills when profiles.employee_id is null.
DO $$
BEGIN
  UPDATE public.profiles p
  SET employee_id = e.id
  FROM auth.users u
  JOIN public.employees e ON lower(e.email) = lower(u.email)
  WHERE p.id = u.id
    AND p.employee_id IS NULL;
END
$$;

