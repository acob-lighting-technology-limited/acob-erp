-- Every UPDATE on public.profiles by an authenticated user failed with
-- "infinite recursion detected in policy for relation profiles": admins
-- could not change roles and staff could not edit their own profile.
--
-- The cause was the last clause of "Profiles update policy", which checked
-- for a developer by sub-selecting from public.profiles inside a profiles
-- policy. Postgres rejects any profiles policy that reads profiles directly.
--
-- is_admin_like() is SECURITY DEFINER, so it reads profiles without going
-- through RLS again. It covers admin, super_admin and developer. The
-- user_roles clause already let admin and super_admin through, so the only
-- change in who may update is that the developer check works again.
ALTER POLICY "Profiles update policy" ON public.profiles
  USING (
    (id = (select auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (select auth.uid())
        AND (user_roles.role)::text = ANY (ARRAY['admin', 'super_admin', 'developer'])
    ))
    OR (SELECT public.has_role('admin'::text))
    OR (SELECT public.is_admin_like())
  );
