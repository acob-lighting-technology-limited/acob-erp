-- Task expiry: run at WAT midnight, and warn before failing.
--
-- Two problems with the job as scheduled:
--
--   1. It ran at 01:15 UTC = 02:15 WAT. That time means nothing - the nightly
--      jobs are staggered 00:00 / 00:30 / 01:00 / 01:15 UTC purely so they do
--      not land at once, and task expiry got the next free slot. The effect was
--      a silent, undocumented two-hour grace after midnight: work submitted at
--      01:00 survived, the same work at 02:20 was failed, while every screen
--      had already been calling the task overdue since midnight.
--
--   2. It failed a task on the first night past its deadline. `failed` scores
--      zero at full weight and an employee cannot reverse it, but the last
--      reminder went out the previous morning, and the way out - a lead
--      extending the deadline, or closing the task out - needs a human.
--
-- 23:00 UTC is 00:00 WAT the following day, so the job now runs at the moment
-- the deadline day ends and agrees with what the task screens display. The
-- route handles the grace itself: first run past the deadline warns, and the
-- task is failed only after two working days have elapsed - weekends, public
-- holidays and the assignee's own approved leave all excluded.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'app-tasks-expire-overdue';

SELECT cron.schedule(
  'app-tasks-expire-overdue', '0 23 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/tasks/expire-overdue', 'GET')$job$
);

-- The grace-period warning needs its own notification type. Without it the
-- insert fails the CHECK and is swallowed by the caller's try/catch, exactly as
-- happened to 'task_blocked' before 20260821180000 - so the constraint is
-- restated in full here rather than appended to.

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (
  type = ANY (
    ARRAY[
      -- Existing legacy/system types
      'token_generated',
      'token_cancelled',
      'task_completed',
      'task_failed',
      'customer_added',
      'customer_updated',
      'meter_status_change',
      'meter_added',
      'activity_reminder',
      'crm_contact_added',
      'opportunity_won',
      'opportunity_lost',
      'system_alert',
      'asset_assigned',
      'asset_transfer_outgoing',
      'asset_transfer_incoming',
      'asset_returned',
      'asset_status_alert',
      'asset_status_fixed',
      'system_restored',
      -- App notification types
      'task_assigned',
      'task_updated',
      'mention',
      'feedback',
      'approval_request',
      'approval_granted',
      'approval_rejected',
      'announcement',
      'system',
      -- Project/task governance reminders
      'task_due_soon',
      'task_awaiting_review',
      'task_needs_rating',
      'project_delayed',
      'task_blocked',
      -- Deadline passed, grace period running: extend it or mark it unable to
      -- complete before the nightly job records it as failed.
      'task_overdue'
    ]::text[]
  )
);

NOTIFY pgrst, 'reload schema';
