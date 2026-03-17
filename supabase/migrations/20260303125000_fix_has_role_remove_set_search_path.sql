-- The SET search_path clause in SECURITY DEFINER functions was resetting
-- the session GUC 'request.jwt.claims', causing auth.uid() to return NULL.
-- Fix: Use STABLE instead of SET search_path, and fully qualify table refs.

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
  current_role text;
BEGIN
  SELECT role::text INTO current_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_role IS NULL THEN
    RETURN false;
  END IF;

  CASE required_role
    WHEN 'visitor' THEN
      RETURN current_role IN ('visitor', 'employee', 'staff', 'lead', 'admin', 'super_admin', 'developer');
    WHEN 'staff' THEN
      RETURN current_role IN ('staff', 'employee', 'lead', 'admin', 'super_admin', 'developer');
    WHEN 'employee' THEN
      RETURN current_role IN ('employee', 'staff', 'lead', 'admin', 'super_admin', 'developer');
    WHEN 'lead' THEN
      RETURN current_role IN ('lead', 'admin', 'super_admin', 'developer');
    WHEN 'admin' THEN
      RETURN current_role IN ('admin', 'super_admin', 'developer');
    WHEN 'super_admin' THEN
      RETURN current_role IN ('super_admin', 'developer');
    WHEN 'developer' THEN
      RETURN current_role = 'developer';
    ELSE
      RETURN false;
  END CASE;
END;
$function$;;
