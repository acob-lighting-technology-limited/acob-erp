-- Fix profiles UPDATE policy to include 'developer' role
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text = ANY (ARRAY['admin', 'super_admin', 'developer']::text[])
  )
  OR public.has_role('admin')
);

-- Fix profiles INSERT policy to include 'developer' role
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text = ANY (ARRAY['admin', 'super_admin', 'developer']::text[])
  )
  OR public.has_role('admin')
);

-- Fix profiles DELETE policy to also check has_role
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  is_admin()
  OR public.has_role('admin')
);;
