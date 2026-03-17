-- Dynamic KSS roster + weekly meeting document repository

create table if not exists public.kss_weekly_roster (
  id uuid primary key default gen_random_uuid(),
  meeting_week integer not null,
  meeting_year integer not null,
  department text not null,
  presenter_id uuid references public.profiles(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kss_weekly_roster_week_check check (meeting_week between 1 and 53),
  constraint kss_weekly_roster_year_check check (meeting_year between 2000 and 2100),
  constraint kss_weekly_roster_unique unique (meeting_week, meeting_year)
);

create index if not exists idx_kss_weekly_roster_week_year on public.kss_weekly_roster(meeting_year, meeting_week);
create index if not exists idx_kss_weekly_roster_department on public.kss_weekly_roster(department);

alter table public.kss_weekly_roster enable row level security;

drop policy if exists "kss_weekly_roster_select" on public.kss_weekly_roster;
create policy "kss_weekly_roster_select"
on public.kss_weekly_roster
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin', 'admin')
        or p.is_department_lead = true
      )
  )
);

drop policy if exists "kss_weekly_roster_insert" on public.kss_weekly_roster;
create policy "kss_weekly_roster_insert"
on public.kss_weekly_roster
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
        or (
          p.is_department_lead = true
          and (
            kss_weekly_roster.department = p.department
            or kss_weekly_roster.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
);

drop policy if exists "kss_weekly_roster_update" on public.kss_weekly_roster;
create policy "kss_weekly_roster_update"
on public.kss_weekly_roster
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
        or (
          p.is_department_lead = true
          and (
            kss_weekly_roster.department = p.department
            or kss_weekly_roster.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
        or (
          p.is_department_lead = true
          and (
            kss_weekly_roster.department = p.department
            or kss_weekly_roster.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
);

drop policy if exists "kss_weekly_roster_delete" on public.kss_weekly_roster;
create policy "kss_weekly_roster_delete"
on public.kss_weekly_roster
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

create table if not exists public.meeting_week_documents (
  id uuid primary key default gen_random_uuid(),
  meeting_week integer not null,
  meeting_year integer not null,
  document_type text not null,
  department text,
  presenter_id uuid references public.profiles(id) on delete set null,
  notes text,
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size bigint not null,
  version_no integer not null default 1,
  is_current boolean not null default true,
  replaced_by uuid references public.meeting_week_documents(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_week_documents_week_check check (meeting_week between 1 and 53),
  constraint meeting_week_documents_year_check check (meeting_year between 2000 and 2100),
  constraint meeting_week_documents_type_check check (document_type in ('knowledge_sharing_session', 'minutes', 'action_points')),
  constraint meeting_week_documents_file_size_check check (file_size > 0),
  constraint meeting_week_documents_version_check check (version_no >= 1),
  constraint meeting_week_documents_kss_department_check check (
    (document_type = 'knowledge_sharing_session' and department is not null)
    or (document_type in ('minutes', 'action_points'))
  )
);

create index if not exists idx_meeting_week_documents_lookup
  on public.meeting_week_documents(meeting_year, meeting_week, document_type);
create index if not exists idx_meeting_week_documents_department
  on public.meeting_week_documents(department);
create index if not exists idx_meeting_week_documents_uploaded_by
  on public.meeting_week_documents(uploaded_by);
create unique index if not exists uq_meeting_week_documents_current
  on public.meeting_week_documents(meeting_year, meeting_week, document_type, coalesce(department, ''))
  where is_current = true;

alter table public.meeting_week_documents enable row level security;

drop policy if exists "meeting_week_documents_select" on public.meeting_week_documents;
create policy "meeting_week_documents_select"
on public.meeting_week_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin', 'admin')
        or p.is_department_lead = true
      )
  )
);

drop policy if exists "meeting_week_documents_insert" on public.meeting_week_documents;
create policy "meeting_week_documents_insert"
on public.meeting_week_documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
        or (
          p.is_department_lead = true
          and meeting_week_documents.document_type = 'knowledge_sharing_session'
          and (
            meeting_week_documents.department = p.department
            or meeting_week_documents.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
);

drop policy if exists "meeting_week_documents_update" on public.meeting_week_documents;
create policy "meeting_week_documents_update"
on public.meeting_week_documents
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
        or (
          p.is_department_lead = true
          and meeting_week_documents.document_type = 'knowledge_sharing_session'
          and (
            meeting_week_documents.department = p.department
            or meeting_week_documents.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
        or (
          p.is_department_lead = true
          and meeting_week_documents.document_type = 'knowledge_sharing_session'
          and (
            meeting_week_documents.department = p.department
            or meeting_week_documents.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
);

drop policy if exists "meeting_week_documents_delete" on public.meeting_week_documents;
create policy "meeting_week_documents_delete"
on public.meeting_week_documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

grant all on table public.kss_weekly_roster to authenticated, service_role;
grant all on table public.meeting_week_documents to authenticated, service_role;

-- Trigger updated_at columns
create or replace function public.meeting_docs_set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_kss_weekly_roster_updated_at on public.kss_weekly_roster;
create trigger trg_kss_weekly_roster_updated_at
before update on public.kss_weekly_roster
for each row
execute function public.meeting_docs_set_updated_at();

drop trigger if exists trg_meeting_week_documents_updated_at on public.meeting_week_documents;
create trigger trg_meeting_week_documents_updated_at
before update on public.meeting_week_documents
for each row
execute function public.meeting_docs_set_updated_at();

-- Storage bucket for meeting documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting_documents',
  'meeting_documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Meeting documents read'
  ) THEN
    CREATE POLICY "Meeting documents read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'meeting_documents'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
            lower(trim(p.role::text)) IN ('developer', 'super_admin', 'admin')
            OR p.is_department_lead = true
          )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Meeting documents insert'
  ) THEN
    CREATE POLICY "Meeting documents insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'meeting_documents'
      AND owner = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
            lower(trim(p.role::text)) IN ('developer', 'super_admin', 'admin')
            OR p.is_department_lead = true
          )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Meeting documents update'
  ) THEN
    CREATE POLICY "Meeting documents update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'meeting_documents'
      AND owner = auth.uid()
    )
    WITH CHECK (
      bucket_id = 'meeting_documents'
      AND owner = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Meeting documents delete'
  ) THEN
    CREATE POLICY "Meeting documents delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'meeting_documents'
      AND owner = auth.uid()
    );
  END IF;
END $$;

-- Dynamic KSS enrichment in recurring reminder processing.
create or replace function public.process_reminder_schedules()
returns void
language plpgsql
security definer
as $function$
declare
  schedule record;
  payload jsonb;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI0NTcsImV4cCI6MjA3NzIxODQ1N30.eVYpuw_VqDrg28DXJFoeYGAbth4Q-t0tXokA1Nq1dog';
  lagos_now timestamp;
  lagos_today date;
  meeting_seed date;
  target_dow int;
  today_dow int;
  days_until int;
  target_date date;
  meeting_time_val time;
  office_year int;
  office_week int;
  office_year_start date;
  kss_department text;
  kss_presenter_id uuid;
  kss_presenter_name text;
  kss_presenter_department text;
begin
  for schedule in
    select *
    from public.reminder_schedules
    where is_active = true
      and next_run_at is not null
      and next_run_at <= now()
  loop
    payload := coalesce(schedule.meeting_config, '{}'::jsonb);

    payload := payload || jsonb_build_object(
      'type', coalesce(payload->>'type', schedule.reminder_type),
      'recipients', schedule.recipients
    );

    if schedule.schedule_type = 'recurring' and coalesce(payload->>'type', schedule.reminder_type) = 'meeting' then
      lagos_now := now() at time zone 'Africa/Lagos';
      lagos_today := lagos_now::date;

      begin
        meeting_seed := nullif(payload->>'meetingDate', '')::date;
      exception when others then
        meeting_seed := null;
      end;

      if meeting_seed is null then
        -- Backward-compatible fallback for old schedules with no explicit meeting date.
        target_dow := 1; -- Monday
      else
        target_dow := extract(dow from meeting_seed)::int;
      end if;

      today_dow := extract(dow from lagos_today)::int;
      days_until := (target_dow - today_dow + 7) % 7;
      target_date := lagos_today + days_until;

      begin
        meeting_time_val := coalesce(nullif(payload->>'meetingTime', '')::time, time '08:30');
      exception when others then
        meeting_time_val := time '08:30';
      end;

      if days_until = 0 and (lagos_now::time >= meeting_time_val) then
        target_date := target_date + interval '7 days';
      end if;

      payload := payload || jsonb_build_object('meetingDate', to_char(target_date, 'YYYY-MM-DD'));

      -- Resolve office week/year from the computed target date.
      office_year := extract(year from target_date)::int;
      office_year_start := public.office_week_year_start(office_year);
      if target_date < office_year_start then
        office_year := office_year - 1;
        office_year_start := public.office_week_year_start(office_year);
      end if;
      office_week := floor((target_date - office_year_start)::numeric / 7) + 1;

      select r.department, r.presenter_id, p.full_name, p.department
      into kss_department, kss_presenter_id, kss_presenter_name, kss_presenter_department
      from public.kss_weekly_roster r
      left join public.profiles p on p.id = r.presenter_id
      where r.meeting_week = office_week
        and r.meeting_year = office_year
        and r.is_active = true
      order by r.updated_at desc
      limit 1;

      -- Remove stale values from initial schedule payload, then inject dynamic values.
      payload := payload - 'knowledgeSharingDepartment' - 'knowledgeSharingPresenter';

      if kss_department is not null then
        payload := payload || jsonb_build_object('knowledgeSharingDepartment', kss_department);

        if kss_presenter_id is not null and kss_presenter_name is not null then
          payload := payload || jsonb_build_object(
            'knowledgeSharingPresenter',
            jsonb_build_object(
              'id', kss_presenter_id,
              'full_name', kss_presenter_name,
              'department', coalesce(kss_presenter_department, kss_department)
            )
          );
          payload := payload || jsonb_build_object('kssRosterStatus', 'enriched_with_presenter');
        else
          payload := payload || jsonb_build_object('kssRosterStatus', 'enriched_department_only');
        end if;
      else
        payload := payload || jsonb_build_object('kssRosterStatus', 'missing');
        raise warning 'KSS roster missing for meeting week % year % (schedule %)', office_week, office_year, schedule.id;
      end if;
    end if;

    perform net.http_post(
      url := base_url || '/functions/v1/send-meeting-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );

    if schedule.schedule_type = 'recurring' then
      update public.reminder_schedules
      set
        next_run_at = greatest(next_run_at, now()) + interval '7 days',
        updated_at = now()
      where id = schedule.id;
    else
      update public.reminder_schedules
      set
        is_active = false,
        updated_at = now()
      where id = schedule.id;
    end if;
  end loop;
end;
$function$;
