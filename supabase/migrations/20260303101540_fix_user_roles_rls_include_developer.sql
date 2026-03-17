-- Fix user_roles UPDATE policy to include 'developer' role
DROP POLICY IF EXISTS "User roles update policy" ON public.user_roles;
CREATE POLICY "User roles update policy"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role::text = ANY (ARRAY['admin', 'super_admin', 'developer']::text[])
  )
  OR public.has_role('admin')
);

-- Fix user_roles DELETE policy to include 'developer' role
DROP POLICY IF EXISTS "User roles delete policy" ON public.user_roles;
CREATE POLICY "User roles delete policy"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role::text = ANY (ARRAY['admin', 'super_admin', 'developer']::text[])
  )
  OR public.has_role('admin')
);;
