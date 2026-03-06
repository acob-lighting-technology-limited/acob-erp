-- Allow admin-like roles (developer, super_admin, admin) to view dev login logs
DROP POLICY IF EXISTS "Developer can read dev login logs" ON public.dev_login_logs;
CREATE POLICY "Developer can read dev login logs"
ON public.dev_login_logs
FOR SELECT
TO authenticated
USING (
  has_role('developer')
  OR has_role('super_admin')
  OR has_role('admin')
);

-- Ensure admin-like roles can read all audit logs while keeping lead department scoping
DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;
CREATE POLICY "Audit logs select policy"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role('admin')
  OR has_role('super_admin')
  OR has_role('developer')
  OR (
    has_role('lead')
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND (
          (
            audit_logs.department IS NOT NULL
            AND audit_logs.department = ANY(
              CASE
                WHEN COALESCE(array_length(me.lead_departments, 1), 0) > 0 THEN me.lead_departments
                WHEN me.department IS NOT NULL THEN ARRAY[me.department]
                ELSE ARRAY[]::text[]
              END
            )
          )
          OR EXISTS (
            SELECT 1
            FROM public.profiles actor
            WHERE actor.id = audit_logs.user_id
              AND actor.department = ANY(
                CASE
                  WHEN COALESCE(array_length(me.lead_departments, 1), 0) > 0 THEN me.lead_departments
                  WHEN me.department IS NOT NULL THEN ARRAY[me.department]
                  ELSE ARRAY[]::text[]
                END
              )
          )
        )
    )
  )
);
