-- Retention for pg_cron run history, and a one-time reclaim of its space.
--
-- WHY: the database was 566 MB against the 500 MB free-plan limit.
-- cron.job_run_details held 638k rows (114 MB) going back to Feb 2026 with no
-- cleanup at all, growing ~4.7k rows/day (two jobs run every minute). Nothing
-- reads it except manual debugging, which only ever needs recent runs.
--
-- The table is owned by supabase_admin, so postgres cannot VACUUM FULL it to
-- give space back after a DELETE. It can TRUNCATE, which frees the space at
-- once: keep the last 7 days aside, truncate, put them back.

-- One DO block so the save, truncate and restore are a single atomic statement
-- regardless of how the migration runner batches transactions.
do $reclaim$
begin
  create temp table keep_cron_runs as
  select * from cron.job_run_details
  where start_time >= now() - interval '7 days';

  truncate cron.job_run_details;

  insert into cron.job_run_details
  select * from keep_cron_runs;

  drop table keep_cron_runs;
end;
$reclaim$;

-- Ongoing: small daily deletes. Freed space is reused by new rows, so the table
-- stays at roughly 7 days' worth instead of growing.
create or replace function public.purge_cron_job_run_details(p_retain_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_deleted integer;
begin
  delete from cron.job_run_details
  where start_time < now() - make_interval(days => p_retain_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.purge_cron_job_run_details(integer) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname = 'purge-cron-job-run-details';

-- 03:20 UTC (04:20 WAT): clear of every other scheduled job.
select cron.schedule(
  'purge-cron-job-run-details', '20 3 * * *',
  $job$select public.purge_cron_job_run_details(7)$job$
);
