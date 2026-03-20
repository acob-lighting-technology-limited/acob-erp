-- Unify help desk tickets with the task hub so actionable tickets share TSK numbers
-- and appear in the tasks module as source_type = 'help_desk'.

ALTER TABLE public.help_desk_tickets
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_help_desk_tickets_task_id
  ON public.help_desk_tickets(task_id)
  WHERE task_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.work_item_number_seq START WITH 1;

DO $$
DECLARE
  v_task_max bigint;
  v_ticket_max bigint;
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(work_item_number, '^TSK-', ''))::bigint), 0)
  INTO v_task_max
  FROM public.tasks
  WHERE work_item_number ~ '^TSK-[0-9]+$';

  SELECT COALESCE(MAX((regexp_replace(ticket_number, '^TSK-', ''))::bigint), 0)
  INTO v_ticket_max
  FROM public.help_desk_tickets
  WHERE ticket_number ~ '^TSK-[0-9]+$';

  v_max := GREATEST(v_task_max, v_ticket_max);

  IF v_max > 0 THEN
    PERFORM setval('public.work_item_number_seq', v_max, true);
  ELSE
    PERFORM setval('public.work_item_number_seq', 1, false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_work_item_number()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'TSK-' || LPAD(nextval('public.work_item_number_seq')::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_work_item_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.work_item_number IS NULL THEN
    NEW.work_item_number := public.generate_work_item_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_help_desk_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.generate_work_item_number();
END;
$$;

DO $$
DECLARE
  v_ticket record;
BEGIN
  FOR v_ticket IN
    SELECT id
    FROM public.help_desk_tickets
    WHERE ticket_number IS NULL
      OR ticket_number !~ '^TSK-[0-9]+$'
    ORDER BY created_at, id
  LOOP
    UPDATE public.help_desk_tickets
    SET ticket_number = public.generate_work_item_number()
    WHERE id = v_ticket.id;
  END LOOP;
END;
$$;

INSERT INTO public.tasks (
  title,
  description,
  priority,
  status,
  assigned_to,
  assigned_by,
  department,
  due_date,
  started_at,
  completed_at,
  created_at,
  updated_at,
  source_type,
  source_id,
  work_item_number,
  assignment_type
)
SELECT
  hd.title,
  hd.description,
  hd.priority,
  CASE
    WHEN hd.status = 'in_progress' THEN 'in_progress'
    WHEN hd.status IN ('resolved', 'closed') THEN 'completed'
    WHEN hd.status IN ('rejected', 'cancelled') THEN 'cancelled'
    ELSE 'pending'
  END,
  CASE
    WHEN hd.handling_mode = 'individual' THEN hd.assigned_to
    ELSE NULL
  END,
  COALESCE(hd.assigned_by, hd.created_by, hd.requester_id),
  COALESCE(hd.service_department, hd.requester_department),
  (hd.sla_target_at)::date,
  hd.started_at,
  COALESCE(hd.resolved_at, hd.closed_at),
  hd.created_at,
  hd.updated_at,
  'help_desk',
  hd.id,
  hd.ticket_number,
  CASE
    WHEN hd.handling_mode = 'individual' AND hd.assigned_to IS NOT NULL THEN 'individual'
    ELSE 'department'
  END
FROM public.help_desk_tickets hd
WHERE hd.status IN (
    'department_queue',
    'department_assigned',
    'assigned',
    'in_progress',
    'approved_for_procurement',
    'resolved',
    'closed'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.source_type = 'help_desk'
      AND t.source_id = hd.id
  );

UPDATE public.help_desk_tickets hd
SET task_id = t.id
FROM public.tasks t
WHERE t.source_type = 'help_desk'
  AND t.source_id = hd.id
  AND hd.task_id IS DISTINCT FROM t.id;

NOTIFY pgrst, 'reload schema';
