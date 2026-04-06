-- PMS Scoring Improvements
-- 1. Add is_system_generated flag to goals_objectives
-- 2. Update kpi_achievement_summary view to include priority and system-generated flag
-- 3. Backfill is_system_generated for existing auto-created goals

-- ─────────────────────────────────────────────────────────────
-- 1. Add is_system_generated to goals_objectives
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.goals_objectives
  ADD COLUMN IF NOT EXISTS is_system_generated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.goals_objectives.is_system_generated
  IS 'True if this goal was auto-created by the system (e.g. fallback KPI bucket from goal-linking). System goals bypass the approval workflow.';

-- Backfill: mark existing auto-created goals
UPDATE public.goals_objectives
SET is_system_generated = true
WHERE description LIKE 'System-generated KPI bucket%'
  AND is_system_generated = false;

-- ─────────────────────────────────────────────────────────────
-- 2. Update kpi_achievement_summary view to include priority,
--    priority weight, and system-generated flag
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.kpi_achievement_summary AS
SELECT
  g.user_id,
  g.review_cycle_id,
  g.id                                             AS goal_id,
  g.title                                          AS goal_title,
  g.approval_status,
  g.priority,
  g.is_system_generated,
  CASE
    WHEN LOWER(COALESCE(g.priority, 'medium')) = 'low'  THEN 1
    WHEN LOWER(COALESCE(g.priority, 'medium')) = 'high' THEN 3
    ELSE 2
  END                                              AS priority_weight,
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
GROUP BY g.id, g.user_id, g.review_cycle_id, g.title, g.approval_status,
         g.priority, g.is_system_generated, g.target_value, g.achieved_value;

NOTIFY pgrst, 'reload schema';
