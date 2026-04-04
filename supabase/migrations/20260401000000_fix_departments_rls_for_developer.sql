-- Fix departments RLS policies to include the 'developer' role.
-- The app-side canManageDepartments check already allows developer, super_admin, and admin,
-- but the RLS policies only used has_role('admin') which only covers admin + super_admin.
-- This caused a silent block: the UI showed success but the DB was never updated.

DROP POLICY IF EXISTS "Departments update policy" ON "public"."departments";
DROP POLICY IF EXISTS "Departments insert policy" ON "public"."departments";
DROP POLICY IF EXISTS "Departments delete policy" ON "public"."departments";

CREATE POLICY "Departments update policy" ON "public"."departments"
  FOR UPDATE TO "authenticated"
  USING (
    (SELECT public.has_role('admin'::text))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'
  );

CREATE POLICY "Departments insert policy" ON "public"."departments"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    (SELECT public.has_role('admin'::text))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'
  );

CREATE POLICY "Departments delete policy" ON "public"."departments"
  FOR DELETE TO "authenticated"
  USING (
    (SELECT public.has_role('admin'::text))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'
  );
