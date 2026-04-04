DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;

CREATE POLICY "Tasks select policy" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR (lower(trim(p.role::text)) = 'admin' AND (p.admin_domains IS NULL OR 'tasks' = ANY(p.admin_domains)))
          OR (
            p.is_department_lead = true
            AND (
              tasks.department = p.department
              OR tasks.department = ANY(COALESCE(p.lead_departments, ARRAY[]::text[]))
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;

CREATE POLICY "Tasks update policy" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
    OR has_role('admin')
    OR has_role('lead')
  );

DROP POLICY IF EXISTS "Tasks insert policy" ON public.tasks;

CREATE POLICY "Tasks insert policy" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role('admin')
    OR has_role('lead')
    OR assigned_by = auth.uid()
  );
