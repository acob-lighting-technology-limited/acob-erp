-- Help Desk Standalone: Phase E Migration 2 (Destructive Cleanup Follow-Up)
--
-- CAUTION: RUN ONLY AFTER THE STANDALONE CODE HAS BEEN DEPLOYED, RUNNING LIVE,
-- AND VERIFIED IN PRODUCTION.
--
-- Drops legacy columns and procurement artifacts:
-- - Drops request_type, approval_required, current_approval_stage, category_id,
--   csat_rating, csat_feedback, task_id, pivoted_to_procurement, procurement_reason.
-- - Drops legacy help_desk_approvals table.
-- - Tightens status check constraint to active standalone support statuses only.

BEGIN;

-- 1. Tighten status check constraint to standalone support statuses
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
    'returned'::text,
    'resolved'::text,
    'closed'::text,
    'cancelled'::text,
    'converted'::text
  ]));

-- 2. Drop legacy constraints
ALTER TABLE public.help_desk_tickets
  DROP CONSTRAINT IF EXISTS help_desk_tickets_request_type_check,
  DROP CONSTRAINT IF EXISTS help_desk_tickets_csat_rating_check;

-- 3. Drop legacy columns
ALTER TABLE public.help_desk_tickets
  DROP COLUMN IF EXISTS request_type,
  DROP COLUMN IF EXISTS approval_required,
  DROP COLUMN IF EXISTS current_approval_stage,
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS csat_rating,
  DROP COLUMN IF EXISTS csat_feedback,
  DROP COLUMN IF EXISTS task_id,
  DROP COLUMN IF EXISTS pivoted_to_procurement,
  DROP COLUMN IF EXISTS procurement_reason;

-- 4. Drop legacy approvals table if present
DROP TABLE IF EXISTS public.help_desk_approvals CASCADE;

COMMIT;
