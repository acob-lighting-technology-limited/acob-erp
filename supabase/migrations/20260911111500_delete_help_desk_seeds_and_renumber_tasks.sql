-- Migration: Purge mock/test help desk tickets and renumber tasks
-- Version: 20260911111500_delete_help_desk_seeds_and_renumber_tasks.sql
--
-- 1. Deletes all 13 seed, test, and misfiled help desk tickets in public.help_desk_tickets.
-- 2. Resets public.help_desk_ticket_number_seq so new tickets start at HD-000001.
-- 3. Deletes the 10 mirror tasks (TSK-000171..TSK-000180) from public.tasks.
-- 4. Renumbers surviving tasks to a contiguous TSK-000001..TSK-000202 sequence.
-- 5. Resets public.work_item_number_seq so the next created task is TSK-000203.

BEGIN;

-- 1. Purge all existing mock/test/seed help desk tickets.
-- Foreign keys on help_desk_comments, help_desk_events, help_desk_approvals,
-- and help_desk_attachments are ON DELETE CASCADE and will clean up cleanly.
DELETE FROM public.help_desk_tickets;

-- 2. Reset the help desk ticket sequence so the next ticket starts at HD-000001.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'help_desk_ticket_number_seq') THEN
    PERFORM setval('public.help_desk_ticket_number_seq', 1, false);
  END IF;
END;
$$;

-- 3. Delete the 10 mirror help desk tasks from public.tasks.
DELETE FROM public.tasks
WHERE work_item_number >= 'TSK-000171'
  AND work_item_number <= 'TSK-000180';

-- 4. Renumber remaining tasks so the sequence remains strictly contiguous.
-- Temporarily disable triggers so updated_at and audit logs are not flooded.
ALTER TABLE public.tasks DISABLE TRIGGER update_tasks_updated_at;
ALTER TABLE public.tasks DISABLE TRIGGER audit_tasks_changes;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.tasks
)
UPDATE public.tasks t
SET work_item_number = 'TMP-' || ordered.rn::text
FROM ordered
WHERE t.id = ordered.id;

UPDATE public.tasks
SET work_item_number = 'TSK-' || LPAD(
  regexp_replace(work_item_number, '^TMP-', '')::text, 6, '0'
)
WHERE work_item_number LIKE 'TMP-%';

-- Update backup mapping table if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks_work_item_number_backup') THEN
    UPDATE public.tasks_work_item_number_backup b
    SET new_work_item_number = t.work_item_number
    FROM public.tasks t
    WHERE t.id = b.task_id
      AND b.new_work_item_number IS DISTINCT FROM t.work_item_number;
  END IF;
END;
$$;

-- 5. Align the work_item_number sequence to the new maximum (202).
DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(work_item_number, '^TSK-', ''))::bigint), 0)
  INTO v_max
  FROM public.tasks
  WHERE work_item_number ~ '^TSK-[0-9]+$';

  IF v_max > 0 THEN
    PERFORM setval('public.work_item_number_seq', v_max, true);
  ELSE
    PERFORM setval('public.work_item_number_seq', 1, false);
  END IF;
END;
$$;

ALTER TABLE public.tasks ENABLE TRIGGER audit_tasks_changes;
ALTER TABLE public.tasks ENABLE TRIGGER update_tasks_updated_at;

-- 6. Verification assertions:
DO $$
DECLARE
  v_tickets_count bigint;
  v_tasks_count   bigint;
  v_tasks_max     bigint;
  v_bad_format    bigint;
BEGIN
  SELECT count(*) INTO v_tickets_count FROM public.help_desk_tickets;
  IF v_tickets_count <> 0 THEN
    RAISE EXCEPTION 'help_desk_tickets is not empty (% rows). Rolling back.', v_tickets_count;
  END IF;

  SELECT count(*), COALESCE(MAX((regexp_replace(work_item_number, '^TSK-', ''))::bigint), 0)
  INTO v_tasks_count, v_tasks_max
  FROM public.tasks;

  IF v_tasks_count <> v_tasks_max THEN
    RAISE EXCEPTION 'Task numbering is not contiguous: % tasks, max is %. Rolling back.', v_tasks_count, v_tasks_max;
  END IF;

  SELECT count(*) INTO v_bad_format
  FROM public.tasks
  WHERE work_item_number !~ '^TSK-[0-9]{6}$';

  IF v_bad_format > 0 THEN
    RAISE EXCEPTION 'Found % task(s) with malformed work_item_number. Rolling back.', v_bad_format;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
