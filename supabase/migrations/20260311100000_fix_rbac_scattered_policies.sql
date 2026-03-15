-- Phase 1: Fix scattered RBAC policies causing empty pages.
-- Fixes:
--   1. action_items INSERT/UPDATE/DELETE – replace stale 'lead' role with is_department_lead
--   2. audit_logs SELECT – replace stale has_role('lead') with is_department_lead
--   3. performance_reviews INSERT – replace stale has_role('lead')

-- ─────────────────────────────────────────────────────────────
-- 1. action_items – Fix INSERT / UPDATE / DELETE
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and leads can insert action items" ON public.action_items;
CREATE POLICY "Admins and leads can insert action items"
ON public.action_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (p.admin_domains IS NULL OR 'reports' = ANY(p.admin_domains))
        )
        OR (
          p.is_department_lead = true
          AND (
            action_items.department = p.department
            OR action_items.department = ANY(COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can update their own action items or admins/leads" ON public.action_items;
CREATE POLICY "Users can update their own action items or admins/leads"
ON public.action_items
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_by
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (p.admin_domains IS NULL OR 'reports' = ANY(p.admin_domains))
        )
        OR (
          p.is_department_lead = true
          AND (
            action_items.department = p.department
            OR action_items.department = ANY(COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can delete action items" ON public.action_items;
CREATE POLICY "Users can delete action items"
ON public.action_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (p.admin_domains IS NULL OR 'reports' = ANY(p.admin_domains))
        )
        OR (
          p.is_department_lead = true
          AND (
            action_items.department = p.department
            OR action_items.department = ANY(COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);

-- ─────────────────────────────────────────────────────────────
-- 2. audit_logs SELECT – replace has_role('lead') with is_department_lead
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;
CREATE POLICY "Audit logs select policy"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        -- Global access for admin-like roles
        lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (p.admin_domains IS NULL OR 'reports' = ANY(p.admin_domains))
        )
        -- Department lead scope
        OR (
          p.is_department_lead = true
          AND (
            (
              audit_logs.department IS NOT NULL
              AND audit_logs.department = ANY(
                CASE
                  WHEN COALESCE(array_length(p.lead_departments, 1), 0) > 0 THEN p.lead_departments
                  WHEN p.department IS NOT NULL THEN ARRAY[p.department]
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
                    WHEN COALESCE(array_length(p.lead_departments, 1), 0) > 0 THEN p.lead_departments
                    WHEN p.department IS NOT NULL THEN ARRAY[p.department]
                    ELSE ARRAY[]::text[]
                  END
                )
            )
          )
        )
      )
  )
);

-- ─────────────────────────────────────────────────────────────
-- 3. performance_reviews INSERT – replace stale has_role('lead')
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Performance reviews insert" ON public.performance_reviews;
CREATE POLICY "Performance reviews insert"
ON public.performance_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin', 'admin')
        OR p.is_department_lead = true
      )
  )
);

-- Also fix the SELECT policy which references has_role('lead')
DROP POLICY IF EXISTS "Performance reviews select" ON public.performance_reviews;
CREATE POLICY "Performance reviews select"
ON public.performance_reviews
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR reviewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin', 'admin')
        OR (
          p.is_department_lead = true
          AND user_id IN (
            SELECT pr.id FROM public.profiles pr
            WHERE pr.department = p.department
              OR pr.department = ANY(COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
      )
  )
);
