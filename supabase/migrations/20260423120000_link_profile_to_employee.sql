-- Link new auth users to employees by email when possible
-- (required so employees can insert into leave_requests under RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_id UUID;
BEGIN
  SELECT e.id INTO emp_id
  FROM public.employees e
  WHERE lower(e.email) = lower(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, display_name, employee_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    emp_id
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      employee_id = COALESCE(public.profiles.employee_id, EXCLUDED.employee_id);

  -- Default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

