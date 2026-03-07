-- Reports visibility + mutation model:
-- 1) Anyone who can access /admin (admin-like or department lead) can view all report rows.
-- 2) Cross-department edits/deletes require:
--    - developer or super_admin, OR
--    - admin with reports domain (or legacy admin_domains IS NULL full-access).
-- 3) Non-global editors can only mutate rows in their own/lead departments.

-- -------------------------
-- action_items policies
-- -------------------------
DROP POLICY IF EXISTS "Users can view action items for their department" ON public.action_items;
DROP POLICY IF EXISTS "Users can update own dept action items" ON public.action_items;
DROP POLICY IF EXISTS "Users can delete action items" ON public.action_items;
DROP POLICY IF EXISTS "Users can insert action items" ON public.action_items;

CREATE POLICY "Users can view action items for their department"
ON public.action_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin', 'admin')
        OR p.is_department_lead = true
      )
  )
);

CREATE POLICY "Users can insert action items"
ON public.action_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (
            lower(trim(p.role::text)) = 'admin'
            AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
          )
        )
        OR (
          (
            lower(trim(p.role::text)) = 'admin'
            OR p.is_department_lead = true
          )
          AND (
            action_items.department = p.department
            OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);

CREATE POLICY "Users can update own dept action items"
ON public.action_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (
            lower(trim(p.role::text)) = 'admin'
            AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
          )
        )
        OR (
          (
            lower(trim(p.role::text)) = 'admin'
            OR p.is_department_lead = true
          )
          AND (
            action_items.department = p.department
            OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
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
        (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (
            lower(trim(p.role::text)) = 'admin'
            AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
          )
        )
        OR (
          (
            lower(trim(p.role::text)) = 'admin'
            OR p.is_department_lead = true
          )
          AND (
            action_items.department = p.department
            OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);

CREATE POLICY "Users can delete action items"
ON public.action_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (
            lower(trim(p.role::text)) = 'admin'
            AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
          )
        )
        OR (
          (
            lower(trim(p.role::text)) = 'admin'
            OR p.is_department_lead = true
          )
          AND (
            action_items.department = p.department
            OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);

-- -------------------------
-- weekly_reports policies
-- -------------------------
DROP POLICY IF EXISTS "Leads and admins can update weekly reports" ON public.weekly_reports;
DROP POLICY IF EXISTS "Only admins can delete weekly reports" ON public.weekly_reports;

CREATE POLICY "Leads and admins can update weekly reports"
ON public.weekly_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        -- owner can always update own report
        weekly_reports.user_id = auth.uid()
        -- global cross-department editors
        OR lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
        )
        -- scoped editors (same/lead departments only)
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
)
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
);

CREATE POLICY "Only admins can delete weekly reports"
ON public.weekly_reports
FOR DELETE
TO authenticated
USING (
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
);
