-- Why a task was cancelled.
--
-- Cancelled work drops out of the employee's KPI entirely - neither credit nor
-- failure - so cancelling is a reviewer's decision and it has to say why, the
-- way GitHub separates "closed as completed" from "closed as not planned".
-- The free-text note goes to task_updates with every other status change.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_cancel_reason_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_cancel_reason_check
  CHECK (cancel_reason IS NULL OR cancel_reason IN ('not_planned', 'duplicate', 'other'));

COMMENT ON COLUMN public.tasks.cancel_reason IS
  'Set when status is cancelled: not_planned, duplicate or other. Cleared when the task is reopened.';

NOTIFY pgrst, 'reload schema';
