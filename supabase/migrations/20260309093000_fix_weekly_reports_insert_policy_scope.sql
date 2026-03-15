-- Align weekly_reports INSERT policy with the scoped role/domain model used by
-- recent report mutations, while keeping meeting lock enforcement.

DROP POLICY IF EXISTS "Leads and admins can insert weekly reports" ON public.weekly_reports;

CREATE POLICY "Leads and admins can insert weekly reports"
ON public.weekly_reports
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        weekly_reports.user_id = auth.uid()
        OR lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
        )
        OR (
          (
            lower(trim(p.role::text)) = 'admin'
            OR p.is_department_lead = true
          )
          AND (
            weekly_reports.department = p.department
            OR weekly_reports.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
  AND public.weekly_report_can_mutate(week_number, year)
);
