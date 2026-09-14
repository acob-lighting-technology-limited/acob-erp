-- Alert IT when a meeting reminder fails outright.
--
-- 20260914160000 made process_reminder_schedules() retry up to three times and
-- confirm delivery through mark_reminder_schedule_sent(). What remained silent:
-- all attempts failing, or the scheduler never picking a schedule up at all.
-- /api/cron/reminders/health checks for both every 10 minutes and emails plus
-- notifies the users listed in system_settings.reminder_failure_alert.
--
-- Runs through call_app_endpoint, so like every app cron job it is a no-op
-- until the app_base_url and app_cron_secret vault secrets exist.

alter table public.reminder_schedules
  add column if not exists last_alerted_at timestamptz;

comment on column public.reminder_schedules.last_alerted_at is
  'When IT was last alerted about this schedule failing; suppresses repeat alerts for the same failure.';

-- Recipients by user id, so the email follows the account. The route falls back
-- to the ICT mailbox if this is empty or missing.
insert into public.system_settings (key, value, description, updated_at)
values (
  'reminder_failure_alert',
  jsonb_build_object('user_ids', jsonb_build_array('1aeae0c5-ef2f-4790-be14-d0e696be01af')),
  'Users emailed and notified when a meeting reminder fails to send after all retries.',
  now()
)
on conflict (key) do nothing;

select cron.unschedule(jobname) from cron.job where jobname = 'app-reminders-health';

select cron.schedule(
  'app-reminders-health', '*/10 * * * *',
  $job$select public.call_app_endpoint('/api/cron/reminders/health', 'GET')$job$
);
