-- ============================================================================
-- Watch sensitive tables for changes made outside the ERP.
--
-- Why: between Jun and Oct 2026 a staff member rewrote 38 of his own attendance
-- days (earlier clock-ins, invented clock-outs, backdated created_at) through a
-- direct `postgres` login. The app's audit log is written by API routes, so a
-- change made straight on the database left no trace at all.
--
-- How "outside the ERP" is decided: every ERP request reaches Postgres through
-- PostgREST, whose session user is `authenticator`; Auth and Storage use their
-- own service roles. A dashboard SQL/table editor session, a psql or CLI login,
-- or an AI tool holding the database password runs with a different session
-- user. `session_user` cannot be changed by SET ROLE or set_config, and
-- `postgres` on Supabase is not a superuser, so it cannot impersonate
-- `authenticator`.
--
-- What happens: each such change is appended to db_change_log (who, from where,
-- before/after) and the app is pinged to email it out at once. The email is the
-- part that cannot be undone afterwards. A pg_cron job every 5 minutes and the
-- nightly Vercel reconciliation also flush anything not yet emailed.
--
-- Tripwire: altering or dropping a watched table, its trigger or these objects
-- is logged and emailed too.
-- ============================================================================

-- ── Log ─────────────────────────────────────────────────────────────────────
create table if not exists public.db_change_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  table_name text not null,
  operation text not null,
  row_id text,
  -- The staff member the row is about (user_id, or id for profiles), when known.
  subject_user_id uuid,
  db_user text not null,
  session_user_name text not null,
  client_addr inet,
  application_name text,
  changed_columns text[],
  old_row jsonb,
  new_row jsonb,
  -- For tripwire entries: the statement that ran.
  detail text
);

create index if not exists db_change_log_occurred_at_idx on public.db_change_log (occurred_at desc);

-- Which log rows have been emailed. Kept apart so the log itself never changes.
create table if not exists public.db_change_alert_sent (
  log_id bigint primary key references public.db_change_log (id),
  sent_at timestamptz not null default now()
);

-- Single-row throttle so a bulk script pings the app at most once a minute.
create table if not exists public.db_change_alert_dispatch (
  id boolean primary key default true check (id),
  last_dispatch_at timestamptz
);
insert into public.db_change_alert_dispatch (id) values (true) on conflict (id) do nothing;

alter table public.db_change_log enable row level security;
alter table public.db_change_alert_sent enable row level security;
alter table public.db_change_alert_dispatch enable row level security;
revoke all on public.db_change_log, public.db_change_alert_sent, public.db_change_alert_dispatch from anon, authenticated;

-- The log is append-only: no edits, no deletes, no truncation.
create or replace function public.db_change_log_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'db_change_log is append-only';
end;
$$;

drop trigger if exists db_change_log_no_edit on public.db_change_log;
create trigger db_change_log_no_edit
  before update or delete on public.db_change_log
  for each row execute function public.db_change_log_append_only();

drop trigger if exists db_change_log_no_truncate on public.db_change_log;
create trigger db_change_log_no_truncate
  before truncate on public.db_change_log
  for each statement execute function public.db_change_log_append_only();

-- ── Classification ──────────────────────────────────────────────────────────
create or replace function public.db_change_is_outside_erp()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select session_user::text not in ('authenticator', 'supabase_auth_admin', 'supabase_storage_admin')
$$;

-- ── Alert dispatch ──────────────────────────────────────────────────────────
-- Pings the app at most once per transaction and once a minute overall. Rows
-- logged inside the throttle window are picked up by the 5-minute flush.
create or replace function public.db_change_dispatch_alert()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('db_change_watch.dispatched', true) = 'on' then
    return;
  end if;
  perform set_config('db_change_watch.dispatched', 'on', true);

  update public.db_change_alert_dispatch
  set last_dispatch_at = now()
  where id and (last_dispatch_at is null or last_dispatch_at < now() - interval '1 minute');

  if found then
    perform public.call_app_endpoint('/api/cron/security/db-changes', 'GET');
  end if;
end;
$$;

-- ── Row trigger ─────────────────────────────────────────────────────────────
create or replace function public.log_db_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_src jsonb;
  v_changed text[];
  v_subject text;
begin
  if not public.db_change_is_outside_erp() then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('UPDATE', 'INSERT') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.value is distinct from (v_old -> n.key);

    -- A no-op or timestamp-only touch is not worth an alert.
    if v_changed is null or v_changed <@ array['updated_at'] then
      return null;
    end if;

    -- Profiles: only the fields that grant access or change pay and attendance.
    if tg_table_name = 'profiles' and not (v_changed && array[
      'role', 'admin_domains', 'admin_routes', 'is_department_lead', 'lead_departments',
      'employment_status', 'department', 'department_id', 'device_key', 'employee_number',
      'attendance_exempt', 'attendance_exempt_reason', 'attendance_exempt_until'
    ]) then
      return null;
    end if;
  end if;

  v_src := coalesce(v_new, v_old);
  v_subject := case when tg_table_name = 'profiles' then v_src ->> 'id' else v_src ->> 'user_id' end;

  insert into public.db_change_log (
    table_name, operation, row_id, subject_user_id, db_user, session_user_name,
    client_addr, application_name, changed_columns, old_row, new_row
  ) values (
    tg_table_name, tg_op, v_src ->> 'id',
    case when v_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_subject::uuid end,
    current_user, session_user, inet_client_addr(), current_setting('application_name', true),
    v_changed, v_old, v_new
  );

  perform public.db_change_dispatch_alert();
  return null;
exception when others then
  -- Never let the watcher break the write it is watching.
  raise warning 'db change watch failed on %: %', tg_table_name, sqlerrm;
  return null;
end;
$$;

-- ── Attach to the watched tables ────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'attendance_records', 'attendance_appeals',
    'leave_requests', 'leave_balances', 'leave_approvals',
    'payroll_entries', 'payroll_periods', 'payslips', 'salary_structures', 'salary_components',
    'performance_reviews', 'performance_ratings', 'kpi_actuals',
    'profiles'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists zz_db_change_watch on public.%I', t);
      execute format(
        'create trigger zz_db_change_watch after insert or update or delete on public.%I '
        'for each row execute function public.log_db_change()', t);
    end if;
  end loop;
end;
$$;

-- ── Email claim (service role only) ─────────────────────────────────────────
-- Atomically marks up to p_limit unsent rows as sent and returns them, so two
-- overlapping runs never email the same change twice.
create or replace function public.claim_db_change_alerts(p_limit integer default 200)
returns setof public.db_change_log
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with claimed as (
    insert into public.db_change_alert_sent (log_id)
    select l.id
    from public.db_change_log l
    where not exists (select 1 from public.db_change_alert_sent s where s.log_id = l.id)
    order by l.id
    limit greatest(p_limit, 1)
    on conflict do nothing
    returning log_id
  )
  select l.* from public.db_change_log l join claimed c on c.log_id = l.id order by l.id;
end;
$$;

-- Hands rows back when the email could not be sent, so the next run retries them.
create or replace function public.release_db_change_alerts(p_ids bigint[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.db_change_alert_sent where log_id = any (p_ids);
$$;

revoke all on function public.claim_db_change_alerts(integer) from public, anon, authenticated;
revoke all on function public.release_db_change_alerts(bigint[]) from public, anon, authenticated;
revoke all on function public.log_db_change() from public, anon, authenticated;
revoke all on function public.db_change_dispatch_alert() from public, anon, authenticated;
grant execute on function public.claim_db_change_alerts(integer) to service_role;
grant execute on function public.release_db_change_alerts(bigint[]) to service_role;

-- ── Tripwire ────────────────────────────────────────────────────────────────
create or replace function public.db_change_watch_ddl()
returns event_trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hits text[] := array[]::text[];
  r record;
  v_watched text[] := array[
    'public.attendance_records', 'public.attendance_appeals',
    'public.leave_requests', 'public.leave_balances', 'public.leave_approvals',
    'public.payroll_entries', 'public.payroll_periods', 'public.payslips',
    'public.salary_structures', 'public.salary_components',
    'public.performance_reviews', 'public.performance_ratings', 'public.kpi_actuals',
    'public.profiles'
  ];
begin
  if tg_event = 'sql_drop' then
    for r in select object_identity from pg_event_trigger_dropped_objects() loop
      if r.object_identity = any (v_watched)
         or r.object_identity ~ '(db_change|log_db_change|zz_db_change_watch)' then
        v_hits := v_hits || r.object_identity;
      end if;
    end loop;
  else
    for r in select object_identity from pg_event_trigger_ddl_commands() loop
      if r.object_identity = any (v_watched)
         or r.object_identity ~ '(db_change|log_db_change|zz_db_change_watch)' then
        v_hits := v_hits || r.object_identity;
      end if;
    end loop;
  end if;

  if cardinality(v_hits) = 0 then
    return;
  end if;

  insert into public.db_change_log (
    table_name, operation, db_user, session_user_name, client_addr, application_name, detail
  ) values (
    array_to_string(v_hits, ', '), 'DDL: ' || tg_tag, current_user, session_user,
    inet_client_addr(), current_setting('application_name', true), left(current_query(), 4000)
  );
  perform public.db_change_dispatch_alert();
exception when others then
  -- A tripwire must never block a migration.
  raise warning 'db change tripwire failed: %', sqlerrm;
end;
$$;

-- Event triggers need privileges Supabase grants to `postgres` on current
-- platforms; if this project's role cannot create them, skip the tripwire
-- rather than fail the migration.
do $$
begin
  drop event trigger if exists db_change_watch_ddl_end;
  drop event trigger if exists db_change_watch_ddl_drop;
  create event trigger db_change_watch_ddl_end on ddl_command_end
    execute function public.db_change_watch_ddl();
  create event trigger db_change_watch_ddl_drop on sql_drop
    execute function public.db_change_watch_ddl();
exception when others then
  raise notice 'db change tripwire not installed: %', sqlerrm;
end;
$$;

-- ── Fallback flush ──────────────────────────────────────────────────────────
select cron.unschedule(jobname) from cron.job where jobname = 'app-db-change-alerts';
select cron.schedule(
  'app-db-change-alerts', '*/5 * * * *',
  $job$select public.call_app_endpoint('/api/cron/security/db-changes', 'GET')$job$
);
