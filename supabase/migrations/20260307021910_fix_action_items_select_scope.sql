-- Fix Action Tracker visibility scope.
-- Previous select policy only allowed own department or has_role('lead'),
-- which excluded developer/super_admin global access in practice.

DROP POLICY IF EXISTS "Users can view action items for their department" ON public.action_items;

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
        -- Global access
        lower(trim(p.role::text)) IN ('developer', 'super_admin')
        -- Admins can read reports domain (or all when admin_domains is null for legacy full access)
        OR (
          lower(trim(p.role::text)) = 'admin'
          AND (
            p.admin_domains IS NULL
            OR ('reports' = ANY (p.admin_domains))
          )
        )
        -- Department lead scope
        OR (
          p.is_department_lead = true
          AND (
            action_items.department = p.department
            OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))
          )
        )
        -- Regular employee own department
        OR action_items.department = p.department
      )
  )
);;
