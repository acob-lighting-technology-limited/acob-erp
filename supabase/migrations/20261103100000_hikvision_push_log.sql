-- One row per request the Hikvision clock-in device sends us, with what we
-- answered it.
--
-- Why: since 19 Oct 2026 the device repeatedly stops sending punches and does
-- not recover until someone restarts it (19, 29, 30 Oct, 2 and 3 Nov). The
-- punches arrive later as a backlog, so attendance_events shows the outage but
-- not its cause, and Vercel keeps only minutes of request logs. If our endpoint
-- keeps refusing one punch (400, 401, 429, 503), the device retries it and
-- everything queued behind it waits; this log shows whether that is happening
-- or whether the device simply stops calling.
--
-- Written only by /api/devices/hikvision/events with the service role. Kept 90
-- days.

create table if not exists public.hikvision_push_log (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  -- HTTP status we returned to the device.
  status smallint not null,
  -- stored | skipped | not_stored | bad_request | unauthorized | rate_limited
  outcome text not null,
  reason text,
  -- From the payload, when it could be read.
  event_type text,
  device_time text,
  employee_no text,
  attendance_status text,
  sub_event_type integer,
  duration_ms integer,
  -- The raw event_log, kept only when we could not accept it, so a punch the
  -- device keeps resending can be identified.
  raw_event text
);

create index if not exists hikvision_push_log_received_at_idx on public.hikvision_push_log (received_at desc);

alter table public.hikvision_push_log enable row level security;
revoke all on public.hikvision_push_log from anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname = 'hikvision-push-log-prune';

-- 02:00 UTC = 03:00 WAT, when the device is idle.
select cron.schedule(
  'hikvision-push-log-prune', '0 2 * * *',
  $job$delete from public.hikvision_push_log where received_at < now() - interval '90 days'$job$
);
