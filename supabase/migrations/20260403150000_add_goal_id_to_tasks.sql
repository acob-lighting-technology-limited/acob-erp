-- Add the goal_id column that TaskFormDialog.tsx references but was never created
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals_objectives(id) ON DELETE SET NULL;

-- Index for KPI score queries that join tasks on goal_id
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks(goal_id) WHERE goal_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.goal_id IS 'FK to goals_objectives - links this task to a KPI goal for PMS scoring';
