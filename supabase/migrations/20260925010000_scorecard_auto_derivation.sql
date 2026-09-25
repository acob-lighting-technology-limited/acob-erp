-- Migration: Add override tracking to kpi_actuals and index on tasks for auto-derivation
ALTER TABLE public.kpi_actuals ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT true;

-- Index tasks by kpi_id and department for efficient live derivation
CREATE INDEX IF NOT EXISTS idx_tasks_kpi_dept_status ON public.tasks (kpi_id, department, status) WHERE is_archived = false;

COMMENT ON COLUMN public.kpi_actuals.is_override IS 'True when this progress record is a manual manager override. False when auto-recorded.';
