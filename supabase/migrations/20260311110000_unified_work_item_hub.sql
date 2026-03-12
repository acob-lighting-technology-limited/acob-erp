-- Phase 2a: Unified Work Item Hub
-- Add source tracking + TSK-NNNNNN numbering to existing tasks table.
-- The tasks table already has: week_number, year, category, completed_at, assignment_type, project_id
-- We only need to add: source_type, source_id, work_item_number

-- ─────────────────────────────────────────────────────────────
-- 1. Add new columns to tasks
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'help_desk', 'action_item', 'project_task')),
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS work_item_number text UNIQUE;

COMMENT ON COLUMN public.tasks.source_type IS 'Origin of this work item: manual, help_desk, action_item, or project_task';
COMMENT ON COLUMN public.tasks.source_id IS 'FK to the source record (e.g., help_desk_tickets.id) — nullable for manual tasks';
COMMENT ON COLUMN public.tasks.work_item_number IS 'Human-readable identifier in format TSK-NNNNNN';

-- ─────────────────────────────────────────────────────────────
-- 2. Sequence for TSK-NNNNNN numbering
-- ─────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.work_item_number_seq START WITH 1;

-- ─────────────────────────────────────────────────────────────
-- 3. Auto-assign TSK-NNNNNN on INSERT
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_work_item_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.work_item_number IS NULL THEN
    NEW.work_item_number := 'TSK-' || LPAD(nextval('public.work_item_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_work_item_number ON public.tasks;
CREATE TRIGGER trg_assign_work_item_number
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_work_item_number();

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill existing rows with TSK-NNNNNN
-- ─────────────────────────────────────────────────────────────

UPDATE public.tasks
SET work_item_number = 'TSK-' || LPAD(nextval('public.work_item_number_seq')::text, 6, '0')
WHERE work_item_number IS NULL;

-- Tag existing project-linked tasks
UPDATE public.tasks
SET source_type = 'project_task'
WHERE project_id IS NOT NULL AND source_type = 'manual';

-- Tag existing weekly_action tasks
UPDATE public.tasks
SET source_type = 'action_item'
WHERE category = 'weekly_action' AND source_type = 'manual';

-- ─────────────────────────────────────────────────────────────
-- 5. Create index for fast lookups
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_source_type ON public.tasks(source_type);
CREATE INDEX IF NOT EXISTS idx_tasks_source_id ON public.tasks(source_id);
CREATE INDEX IF NOT EXISTS idx_tasks_work_item_number ON public.tasks(work_item_number);

-- ─────────────────────────────────────────────────────────────
-- 6. Migrate action_items into tasks (232 rows)
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.tasks (
  title,
  description,
  status,
  department,
  assigned_by,
  category,
  week_number,
  year,
  completed_at,
  created_at,
  updated_at,
  source_type,
  assignment_type,
  priority
)
SELECT
  ai.title,
  ai.description,
  ai.status,
  ai.department,
  ai.assigned_by,
  'weekly_action',
  ai.week_number,
  ai.year,
  ai.completed_at,
  ai.created_at,
  ai.updated_at,
  'action_item',
  'department',
  'medium'
FROM public.action_items ai
WHERE NOT EXISTS (
  -- Skip if a tasks row already has the same title + week + year + dept (avoid duplicates)
  SELECT 1 FROM public.tasks t
  WHERE t.title = ai.title
    AND t.week_number = ai.week_number
    AND t.year = ai.year
    AND t.department = ai.department
    AND t.category = 'weekly_action'
);

-- ─────────────────────────────────────────────────────────────
-- 7. Create unified_work VIEW (tasks + assigned help desk)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.unified_work AS
  -- Tasks (all source types)
  SELECT
    t.id,
    t.work_item_number,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.department,
    t.assigned_to,
    t.assigned_by,
    t.assignment_type,
    t.due_date,
    t.started_at,
    t.completed_at,
    t.created_at,
    t.updated_at,
    t.source_type,
    t.source_id,
    t.project_id,
    t.category,
    t.week_number,
    t.year,
    t.progress,
    'tasks'::text AS source_table
  FROM public.tasks t

  UNION ALL

  -- Help desk tickets that are assigned (work for the resolver)
  SELECT
    hd.id,
    hd.ticket_number AS work_item_number,
    hd.title,
    hd.description,
    hd.status,
    hd.priority,
    hd.service_department AS department,
    hd.assigned_to,
    hd.assigned_by,
    'individual'::text AS assignment_type,
    (hd.sla_target_at)::date AS due_date,
    hd.started_at,
    hd.resolved_at AS completed_at,
    hd.created_at,
    hd.updated_at,
    'help_desk'::text AS source_type,
    hd.id AS source_id,
    NULL::uuid AS project_id,
    NULL::text AS category,
    NULL::integer AS week_number,
    NULL::integer AS year,
    CASE
      WHEN hd.status IN ('resolved', 'closed') THEN 100
      WHEN hd.status IN ('in_progress') THEN 50
      WHEN hd.status IN ('assigned', 'department_assigned') THEN 10
      ELSE 0
    END AS progress,
    'help_desk_tickets'::text AS source_table
  FROM public.help_desk_tickets hd
  WHERE hd.assigned_to IS NOT NULL
    AND hd.status NOT IN ('closed', 'cancelled');
