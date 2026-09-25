-- ─────────────────────────────────────────────────────────────
-- Migration: Revamp task workflow and restore auto-failed tasks
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. Restore all tasks that were automatically failed by the overdue cron
UPDATE public.tasks
SET status = 'in_progress',
    failure_reason = NULL,
    updated_at = now()
WHERE status = 'failed'
  AND failure_reason = 'Deadline passed without completion (recorded automatically)';

-- 2. Update self-rating guard trigger to permit department leads and administrators
--    to approve and rate their own tasks, while preserving the guard for regular employees.
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

  -- Department leads and administrators are permitted to approve and rate tasks
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.rated_by
      AND (p.is_department_lead = true OR p.role IN ('admin', 'super_admin', 'developer'))
  ) THEN
    RETURN NEW;
  END IF;

  -- Regular employees cannot rate their own tasks
  IF NEW.rated_by = NEW.assigned_to
     OR EXISTS (
       SELECT 1 FROM public.task_assignments ta
       WHERE ta.task_id = NEW.id AND ta.user_id = NEW.rated_by
     ) THEN
    RAISE EXCEPTION 'A regular employee cannot rate their own task'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Revoke execute from public/anon/authenticated as this is a trigger-only function
REVOKE EXECUTE ON FUNCTION public.tasks_guard_self_rating() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_guard_self_rating ON public.tasks;
CREATE TRIGGER tasks_guard_self_rating
  BEFORE INSERT OR UPDATE OF rating, rated_by, assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_guard_self_rating();

COMMIT;
