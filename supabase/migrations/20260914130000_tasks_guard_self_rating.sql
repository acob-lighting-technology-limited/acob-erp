-- Nobody rates their own task.
--
-- /api/tasks/[id]/status let any department lead or admin approve and rate a
-- task, including one they had assigned to themselves. 30 tasks were self-rated
-- that way, and those ratings feed the rater's own KPI (70% of the appraisal).
-- The API now sends a reviewer's own task to the MD (head of the Executive
-- Management department, code MD); this trigger holds the same line for any
-- other write path (PostgREST, service role, future routes).
--
-- The MD is exempt: no one sits above them. Their self-rated tasks are left out
-- of KPI scoring in lib/performance/scoring.ts instead.
--
-- Existing self-rated rows are deliberately left as they are (decision
-- 2026-09-14). The guard only fires when the rating, rater or assignee
-- changes, so unrelated edits to those rows keep working.

BEGIN;

CREATE OR REPLACE FUNCTION public.tasks_guard_self_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.rated_by IS NULL OR NEW.rating IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.rating IS NOT DISTINCT FROM OLD.rating
     AND NEW.rated_by IS NOT DISTINCT FROM OLD.rated_by
     AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.department_code = 'MD' AND d.department_head_id = NEW.rated_by
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.rated_by = NEW.assigned_to
     OR EXISTS (
       SELECT 1 FROM public.task_assignments ta
       WHERE ta.task_id = NEW.id AND ta.user_id = NEW.rated_by
     ) THEN
    RAISE EXCEPTION 'A task cannot be rated by its own assignee; the MD rates it'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger-only function: never callable as an RPC.
REVOKE EXECUTE ON FUNCTION public.tasks_guard_self_rating() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_guard_self_rating ON public.tasks;
CREATE TRIGGER tasks_guard_self_rating
  BEFORE INSERT OR UPDATE OF rating, rated_by, assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_guard_self_rating();

COMMIT;
