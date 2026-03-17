-- Convert all admin helper functions to plain SQL (no SECURITY DEFINER, no SET)
-- so they get inlined by PostgreSQL and auth.uid() works correctly.

-- is_admin(): checks if user is admin-level or higher
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'super_admin', 'developer'))
  );
$$;

-- is_admin_like(): checks if user has admin, super_admin, or developer role
CREATE OR REPLACE FUNCTION public.is_admin_like()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'developer')
  );
$$;

-- correspondence_is_admin(): admin check for correspondence module
CREATE OR REPLACE FUNCTION public.correspondence_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'developer')
  );
$$;

-- help_desk_is_admin(): admin check for help desk module
CREATE OR REPLACE FUNCTION public.help_desk_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'developer')
  );
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';;
