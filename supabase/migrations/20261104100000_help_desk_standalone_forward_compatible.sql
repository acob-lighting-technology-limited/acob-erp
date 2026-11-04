-- Help Desk Standalone: Phase E Migration 1 (Forward-Compatible Additions)
--
-- Adds standalone lifecycle columns (resolved_by, closed_by, 1-5 service rating,
-- converted_task_id) to public.help_desk_tickets, backfills rating from csat_*,
-- extends status check constraint with 'converted' and 'paused', and adds a
-- self-rating guard trigger preventing assignees from rating their own tickets.
--
-- This migration is completely additive and safe to run while the application
-- is running. Destructive column drops are in a separate later migration.

BEGIN;

-- 1. Add standalone lifecycle and rating columns
ALTER TABLE public.help_desk_tickets
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS rating_comment text,
  ADD COLUMN IF NOT EXISTS rated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS converted_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- 2. Add rating range check constraint (1 to 5)
ALTER TABLE public.help_desk_tickets
  DROP CONSTRAINT IF EXISTS help_desk_tickets_rating_check;

ALTER TABLE public.help_desk_tickets
  ADD CONSTRAINT help_desk_tickets_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- 3. Backfill rating and rating_comment from existing csat_* data
UPDATE public.help_desk_tickets
SET
  rating = csat_rating,
  rating_comment = csat_feedback,
  rated_by = requester_id,
  rated_at = closed_at
WHERE csat_rating IS NOT NULL AND rating IS NULL;

-- 4. Extend the status check constraint to include 'converted' and 'paused'
-- Preserves all existing status values so no historical data is invalidated.
ALTER TABLE public.help_desk_tickets
  DROP CONSTRAINT IF EXISTS help_desk_tickets_status_check;

ALTER TABLE public.help_desk_tickets
  ADD CONSTRAINT help_desk_tickets_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,
    'pending_lead_review'::text,
    'department_queue'::text,
    'department_assigned'::text,
    'assigned'::text,
    'in_progress'::text,
    'paused'::text,
    'pending_approval'::text,
    'approved_for_procurement'::text,
    'rejected'::text,
    'returned'::text,
    'resolved'::text,
    'closed'::text,
    'cancelled'::text,
    'converted'::text
  ]));

-- 5. Guard trigger: Assignees may never rate their own tickets
CREATE OR REPLACE FUNCTION public.help_desk_guard_self_rating()
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

  IF NEW.assigned_to IS NOT NULL AND NEW.rated_by = NEW.assigned_to THEN
    RAISE EXCEPTION 'A help desk ticket cannot be rated by its assignee'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Security lockdown per Database Security Standard
REVOKE EXECUTE ON FUNCTION public.help_desk_guard_self_rating() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.help_desk_guard_self_rating() TO service_role;

DROP TRIGGER IF EXISTS help_desk_guard_self_rating ON public.help_desk_tickets;
CREATE TRIGGER help_desk_guard_self_rating
  BEFORE INSERT OR UPDATE OF rating, rated_by, assigned_to
  ON public.help_desk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.help_desk_guard_self_rating();

COMMIT;
