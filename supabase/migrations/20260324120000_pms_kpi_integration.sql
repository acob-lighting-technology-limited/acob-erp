-- PMS KPI Integration
-- Links tasks/help-desk/projects to KPIs (goals_objectives).
-- Extends performance_reviews with 4-component weighted scoring.
-- Adds KPI approval workflow to goals_objectives.

-- ─────────────────────────────────────────────────────────────
-- 1. Add goal_id to tasks (nullable link to a KPI/goal)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals_objectives(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.goal_id IS 'Optional link to a KPI/goal this task contributes to';

CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks(goal_id);

-- ─────────────────────────────────────────────────────────────
-- 2. KPI approval workflow on goals_objectives
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.goals_objectives
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

COMMENT ON COLUMN public.goals_objectives.approval_status IS 'KPI approval state: pending → approved/rejected by manager';
COMMENT ON COLUMN public.goals_objectives.approved_by     IS 'Manager who approved or rejected this KPI';
COMMENT ON COLUMN public.goals_objectives.approved_at     IS 'Timestamp of approval/rejection';

-- ─────────────────────────────────────────────────────────────
-- 3. Extend performance_reviews with 4-component PMS scoring
--    KPI Achievement (70%) + CBT/Knowledge (10%) + Attendance (10%) + Behaviour (10%)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS kpi_score          numeric(5,2),  -- 0-100, weight 70%
  ADD COLUMN IF NOT EXISTS cbt_score          numeric(5,2),  -- 0-100, weight 10%
  ADD COLUMN IF NOT EXISTS attendance_score   numeric(5,2),  -- 0-100, weight 10%
  ADD COLUMN IF NOT EXISTS behaviour_score    numeric(5,2),  -- 0-100, weight 10%
  ADD COLUMN IF NOT EXISTS final_score        numeric(5,2),  -- computed weighted total
  ADD COLUMN IF NOT EXISTS behaviour_competencies jsonb,     -- per-competency breakdown
  ADD COLUMN IF NOT EXISTS strengths          text,
  ADD COLUMN IF NOT EXISTS areas_for_improvement text;

COMMENT ON COLUMN public.performance_reviews.kpi_score        IS 'KPI Achievement score 0-100 (contributes 70% to final)';
COMMENT ON COLUMN public.performance_reviews.cbt_score        IS 'Knowledge/CBT test score 0-100 (contributes 10%)';
COMMENT ON COLUMN public.performance_reviews.attendance_score IS 'Attendance score 0-100 (contributes 10%)';
COMMENT ON COLUMN public.performance_reviews.behaviour_score  IS 'Behavioural assessment 0-100 (contributes 10%)';
COMMENT ON COLUMN public.performance_reviews.final_score      IS 'Weighted final: kpi*0.7 + cbt*0.1 + att*0.1 + beh*0.1';
COMMENT ON COLUMN public.performance_reviews.behaviour_competencies IS 'JSON breakdown: {collaboration, accountability, communication, teamwork, loyalty, professional_conduct}';

-- ─────────────────────────────────────────────────────────────
-- 4. DB function: compute & store final_score from components
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_final_performance_score(
  p_kpi_score        numeric,
  p_cbt_score        numeric,
  p_attendance_score numeric,
  p_behaviour_score  numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(
    COALESCE(p_kpi_score, 0)        * 0.70 +
    COALESCE(p_cbt_score, 0)        * 0.10 +
    COALESCE(p_attendance_score, 0) * 0.10 +
    COALESCE(p_behaviour_score, 0)  * 0.10,
    2
  );
$$;

-- Trigger: auto-compute final_score whenever component scores change
CREATE OR REPLACE FUNCTION public.trg_compute_final_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.final_score := public.compute_final_performance_score(
    NEW.kpi_score,
    NEW.cbt_score,
    NEW.attendance_score,
    NEW.behaviour_score
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_final_score ON public.performance_reviews;
CREATE TRIGGER trg_auto_final_score
  BEFORE INSERT OR UPDATE OF kpi_score, cbt_score, attendance_score, behaviour_score
  ON public.performance_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_compute_final_score();

-- ─────────────────────────────────────────────────────────────
-- 5. View: kpi_achievement_summary
--    Per-user per-cycle: how many linked tasks completed vs total,
--    and the avg goal progress, feeding into kpi_score.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.kpi_achievement_summary AS
SELECT
  g.user_id,
  g.review_cycle_id,
  g.id                                             AS goal_id,
  g.title                                          AS goal_title,
  g.approval_status,
  g.target_value,
  g.achieved_value,
  ROUND(
    CASE
      WHEN COALESCE(g.target_value, 0) = 0 THEN 0
      ELSE LEAST(COALESCE(g.achieved_value, 0) / g.target_value * 100, 100)
    END,
    2
  )                                                AS goal_progress_pct,
  COUNT(t.id)                                      AS linked_tasks_total,
  COUNT(t.id) FILTER (WHERE t.status = 'completed') AS linked_tasks_completed,
  CASE
    WHEN COUNT(t.id) = 0 THEN
      ROUND(LEAST(COALESCE(g.achieved_value, 0) / NULLIF(g.target_value, 0) * 100, 100), 2)
    ELSE
      ROUND(COUNT(t.id) FILTER (WHERE t.status = 'completed')::numeric / COUNT(t.id) * 100, 2)
  END                                              AS effective_kpi_pct
FROM public.goals_objectives g
LEFT JOIN public.tasks t ON t.goal_id = g.id
GROUP BY g.id, g.user_id, g.review_cycle_id, g.title, g.approval_status, g.target_value, g.achieved_value;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS: allow approved_by / approval_status updates by managers
-- ─────────────────────────────────────────────────────────────

-- Managers/admins can approve or reject goals belonging to their department
CREATE POLICY "Managers can approve department goals"
  ON public.goals_objectives FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.id = goals_objectives.user_id
      WHERE p1.id = auth.uid()
        AND (
          p1.role IN ('admin', 'super_admin', 'developer')
          OR (p1.is_department_lead = true AND p1.department_id = p2.department_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.id = goals_objectives.user_id
      WHERE p1.id = auth.uid()
        AND (
          p1.role IN ('admin', 'super_admin', 'developer')
          OR (p1.is_department_lead = true AND p1.department_id = p2.department_id)
        )
    )
  );

NOTIFY pgrst, 'reload schema';
