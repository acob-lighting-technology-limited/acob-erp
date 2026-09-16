-- Nobody rates their own task, the MD included.
--
-- 20260914130000 blocked self-rating but exempted one person: the head of the
-- Executive Management department. The reasoning was that a lead's own tasks
-- had to go somewhere, and only the MD sits above every lead.
--
-- That routing never worked. The MD reaches tasks through the lead view, which
-- is scoped to the departments they lead - Executive Management alone - so
-- every other lead's self-assigned work queued behind someone who could not
-- see it. Five tasks were sitting in submitted_for_review with the assignee as
-- their own reviewer when this was written.
--
-- Review is an admin-side job: super admin, developer, or an admin with tasks
-- access, all of whom have the cross-department view. The MD does it there too,
-- as a super admin rather than by name. That pool always contains somebody who
-- is not the assignee, so the exemption has nothing left to solve and the rule
-- becomes absolute: rated_by may never be an assignee of the task.
--
-- Existing self-rated rows are still left as they are (decision 2026-09-14).
-- The guard only fires when the rating, rater or assignee changes, so unrelated
-- edits to those rows keep working.

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

  IF NEW.rated_by = NEW.assigned_to
     OR EXISTS (
       SELECT 1 FROM public.task_assignments ta
       WHERE ta.task_id = NEW.id AND ta.user_id = NEW.rated_by
     ) THEN
    RAISE EXCEPTION 'A task cannot be rated by one of its assignees'
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
