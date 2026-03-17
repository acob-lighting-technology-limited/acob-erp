-- Rewrite has_role as a simple SQL function instead of plpgsql.
-- SQL functions get inlined by PostgreSQL and execute in the caller's
-- context, avoiding the GUC/auth context issues that plpgsql has.
-- Uses a numeric role hierarchy for a clean comparison.

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      CASE role::text
        WHEN 'developer' THEN 7
        WHEN 'super_admin' THEN 6
        WHEN 'admin' THEN 5
        WHEN 'lead' THEN 4
        WHEN 'employee' THEN 3
        WHEN 'staff' THEN 3
        WHEN 'visitor' THEN 2
        ELSE 0
      END
    ) >= (
      CASE required_role
        WHEN 'developer' THEN 7
        WHEN 'super_admin' THEN 6
        WHEN 'admin' THEN 5
        WHEN 'lead' THEN 4
        WHEN 'employee' THEN 3
        WHEN 'staff' THEN 3
        WHEN 'visitor' THEN 2
        ELSE 99
      END
    )
  );
$$;

-- Force PostgREST to pick up the change
NOTIFY pgrst, 'reload schema';;
