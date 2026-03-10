-- Align weekly_report_meeting_windows mutation policy with reports RBAC scope.
-- Allows developer/super_admin and reports-scoped admins to manage meeting windows.

DROP POLICY IF EXISTS "Weekly report meeting windows admin manage" ON public.weekly_report_meeting_windows;

CREATE POLICY "Weekly report meeting windows admin manage"
  ON public.weekly_report_meeting_windows
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (
            lower(trim(p.role::text)) = 'admin'
            AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (
            lower(trim(p.role::text)) = 'admin'
            AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
          )
        )
    )
  );
