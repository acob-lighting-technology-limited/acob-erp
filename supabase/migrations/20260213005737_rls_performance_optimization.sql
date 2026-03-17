-- roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles" ON public.roles
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role])
  )
);

-- system_settings
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" ON public.system_settings
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role])
  )
);

-- profiles
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role])
  )
);

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role])
  )
);

-- weekly_reports
DROP POLICY IF EXISTS "Everyone can view submitted reports" ON public.weekly_reports;
CREATE POLICY "Everyone can view submitted reports" ON public.weekly_reports
AS PERMISSIVE FOR SELECT
TO public
USING (
  (status = 'submitted'::text) OR ((SELECT auth.uid()) = user_id)
);

DROP POLICY IF EXISTS "Leads can manage their own reports" ON public.weekly_reports;
CREATE POLICY "Leads can manage their own reports" ON public.weekly_reports
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  ((SELECT auth.uid()) = user_id) OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role])
  )
);
;
