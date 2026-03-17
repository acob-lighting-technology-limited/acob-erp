-- audit_logs
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs insert policy" ON public.audit_logs;
CREATE POLICY "Audit logs insert policy" ON public.audit_logs
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- profiles (INSERT)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = (SELECT auth.uid())
    AND role IN ('admin', 'super_admin')
  )
);

-- profiles (UPDATE)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  (id = (SELECT auth.uid())) OR 
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = (SELECT auth.uid())
    AND role IN ('admin', 'super_admin')
  )
);

-- user_roles
DROP POLICY IF EXISTS "User roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "User roles insert policy" ON public.user_roles;
CREATE POLICY "User roles insert policy" ON public.user_roles
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles AS ur
    WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "User roles admin update" ON public.user_roles;
DROP POLICY IF EXISTS "User roles update policy" ON public.user_roles;
CREATE POLICY "User roles update policy" ON public.user_roles
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles AS ur
    WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "User roles admin delete" ON public.user_roles;
DROP POLICY IF EXISTS "User roles delete policy" ON public.user_roles;
CREATE POLICY "User roles delete policy" ON public.user_roles
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles AS ur
    WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role IN ('admin', 'super_admin')
  )
);
;
