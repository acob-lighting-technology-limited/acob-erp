-- Allow department leads (has_role('lead')) to view all projects and implementation plans.
-- This enables HODs to link tasks to any company project during task creation/delegation
-- and view project implementation plans/milestones.

DROP POLICY IF EXISTS "Projects select scoped" ON public.projects;
CREATE POLICY "Projects select scoped"
ON public.projects FOR SELECT TO authenticated
USING (
  public.is_admin_like()
  OR (SELECT public.has_role('lead'))
  OR created_by = auth.uid()
  OR project_manager_id = auth.uid()
  OR public.is_project_member(id, auth.uid())
  OR public.has_assigned_task_in_project(id, auth.uid())
);

DROP POLICY IF EXISTS "Implementation plans select scoped" ON public.implementation_plans;
CREATE POLICY "Implementation plans select scoped"
ON public.implementation_plans FOR SELECT TO authenticated
USING (
  public.is_admin_like()
  OR (SELECT public.has_role('lead'))
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = implementation_plans.project_id
      AND (
        p.created_by = auth.uid()
        OR p.project_manager_id = auth.uid()
        OR public.is_project_member(p.id, auth.uid())
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.plan_id = implementation_plans.id
      AND t.assigned_to = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
