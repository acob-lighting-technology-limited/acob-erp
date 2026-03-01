-- Correspondence module: reference numbering, workflow, approvals, audit trail

create table if not exists public.correspondence_department_codes (
  id uuid primary key default gen_random_uuid(),
  department_name text not null unique,
  department_code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(department_code)) between 2 and 10)
);

create table if not exists public.correspondence_counters (
  id uuid primary key default gen_random_uuid(),
  counter_key text not null,
  year integer not null,
  last_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(counter_key, year),
  check (year between 2000 and 2100),
  check (last_number >= 0)
);

create table if not exists public.correspondence_records (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  direction text not null check (direction in ('incoming', 'outgoing')),
  company_code text not null default 'ACOB',
  department_name text,
  department_code text,
  letter_type text check (letter_type in ('internal', 'external')),
  category text check (category in ('approval', 'notice', 'contract', 'invoice', 'other')),
  subject text not null,
  recipient_name text,
  sender_name text,
  status text not null check (
    status in (
      'draft',
      'under_review',
      'approved',
      'rejected',
      'returned_for_correction',
      'sent',
      'filed',
      'assigned_action_pending',
      'open',
      'closed',
      'cancelled'
    )
  ),
  action_required boolean not null default false,
  due_date date,
  responsible_officer_id uuid references auth.users(id) on delete set null,
  originator_id uuid not null references auth.users(id) on delete cascade,
  assigned_department_name text,
  source_mode text check (source_mode in ('email', 'physical', 'portal', 'courier')),
  dispatch_method text check (dispatch_method in ('email', 'courier', 'hand_delivery', 'regulatory_portal')),
  proof_of_delivery_path text,
  submitted_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  received_at timestamptz,
  incoming_reference_id uuid references public.correspondence_records(id) on delete set null,
  current_version integer not null default 1,
  is_locked boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(subject)) > 0),
  check (current_version >= 1),
  check ((direction = 'incoming') or (department_name is not null and department_code is not null))
);

create table if not exists public.correspondence_approvals (
  id uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references public.correspondence_records(id) on delete cascade,
  approval_stage text not null,
  approver_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'returned_for_correction')),
  comments text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(correspondence_id, approval_stage)
);

create table if not exists public.correspondence_events (
  id uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references public.correspondence_records(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.correspondence_versions (
  id uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references public.correspondence_records(id) on delete cascade,
  version_no integer not null,
  file_path text,
  change_summary text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(correspondence_id, version_no),
  check (version_no >= 1)
);

create index if not exists idx_correspondence_records_reference_number on public.correspondence_records(reference_number);
create index if not exists idx_correspondence_records_direction_status on public.correspondence_records(direction, status);
create index if not exists idx_correspondence_records_department_status on public.correspondence_records(department_name, status);
create index if not exists idx_correspondence_records_assigned_department on public.correspondence_records(assigned_department_name);
create index if not exists idx_correspondence_records_originator on public.correspondence_records(originator_id);
create index if not exists idx_correspondence_records_responsible on public.correspondence_records(responsible_officer_id);
create index if not exists idx_correspondence_records_created_at on public.correspondence_records(created_at desc);
create index if not exists idx_correspondence_approvals_correspondence on public.correspondence_approvals(correspondence_id, status);
create index if not exists idx_correspondence_events_correspondence on public.correspondence_events(correspondence_id, created_at desc);
create index if not exists idx_correspondence_versions_correspondence on public.correspondence_versions(correspondence_id, version_no desc);

create or replace function public.correspondence_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.correspondence_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.correspondence_is_lead_for_department(p_department text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'lead'
      and (
        p_department = any(coalesce(p.lead_departments, '{}'::text[]))
        or coalesce(p.department, '') = p_department
      )
  );
$$;

create or replace function public.generate_correspondence_reference(
  p_direction text,
  p_department_code text default null,
  p_company_code text default 'ACOB',
  p_reference_year integer default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := coalesce(p_reference_year, extract(year from now())::integer);
  v_key text;
  v_prefix text;
  v_next integer;
  v_code text;
begin
  if p_direction not in ('incoming', 'outgoing') then
    raise exception 'Invalid direction for correspondence reference: %', p_direction;
  end if;

  if p_direction = 'incoming' then
    v_code := 'IN';
    v_key := 'incoming:IN';
    v_prefix := format('%s/IN/%s/', coalesce(nullif(trim(p_company_code), ''), 'ACOB'), v_year::text);
  else
    if p_department_code is null or trim(p_department_code) = '' then
      raise exception 'Department code is required for outgoing correspondence references';
    end if;

    v_code := upper(trim(p_department_code));
    v_key := 'outgoing:' || v_code;
    v_prefix := format('%s/%s/%s/', coalesce(nullif(trim(p_company_code), ''), 'ACOB'), v_code, v_year::text);
  end if;

  insert into public.correspondence_counters (counter_key, year, last_number)
  values (v_key, v_year, 0)
  on conflict (counter_key, year) do nothing;

  perform 1
  from public.correspondence_counters
  where counter_key = v_key
    and year = v_year
  for update;

  update public.correspondence_counters
  set last_number = last_number + 1,
      updated_at = now()
  where counter_key = v_key
    and year = v_year
  returning last_number into v_next;

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.correspondence_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_department_code text;
  v_year integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if new.originator_id is null then
    new.originator_id := auth.uid();
  end if;

  if new.reference_number is not null and btrim(new.reference_number) <> '' and auth.role() <> 'service_role' then
    raise exception 'Reference number is system-generated and cannot be set manually';
  end if;

  new.company_code := coalesce(nullif(trim(new.company_code), ''), 'ACOB');
  v_year := extract(year from coalesce(new.submitted_at, new.created_at, now()))::integer;

  if new.direction = 'incoming' then
    new.department_code := 'IN';
    if new.status is null then
      new.status := 'open';
    end if;
  else
    if new.department_name is null or btrim(new.department_name) = '' then
      raise exception 'department_name is required for outgoing correspondence';
    end if;

    select c.department_code
      into v_department_code
    from public.correspondence_department_codes c
    where c.department_name = new.department_name
      and c.is_active = true
    limit 1;

    if v_department_code is null and new.department_code is not null and btrim(new.department_code) <> '' then
      v_department_code := upper(btrim(new.department_code));
    end if;

    if v_department_code is null then
      raise exception 'No active department code configured for %', new.department_name;
    end if;

    new.department_code := v_department_code;
    if new.status is null then
      new.status := 'draft';
    end if;
  end if;

  if new.reference_number is null or btrim(new.reference_number) = '' then
    new.reference_number := public.generate_correspondence_reference(
      new.direction,
      new.department_code,
      new.company_code,
      v_year
    );
  end if;

  return new;
end;
$$;

create or replace function public.correspondence_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.reference_number is distinct from new.reference_number then
    raise exception 'Reference number cannot be modified';
  end if;

  if old.is_locked then
    if old.subject is distinct from new.subject
      or old.department_name is distinct from new.department_name
      or old.department_code is distinct from new.department_code
      or old.letter_type is distinct from new.letter_type
      or old.category is distinct from new.category
      or old.recipient_name is distinct from new.recipient_name
      or old.sender_name is distinct from new.sender_name
      or old.due_date is distinct from new.due_date
      or old.action_required is distinct from new.action_required
      or old.source_mode is distinct from new.source_mode
      or old.metadata is distinct from new.metadata
    then
      raise exception 'Locked correspondence cannot be edited';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_correspondence_department_codes_updated_at
before update on public.correspondence_department_codes
for each row execute function public.correspondence_set_updated_at();

create trigger trg_correspondence_counters_updated_at
before update on public.correspondence_counters
for each row execute function public.correspondence_set_updated_at();

create trigger trg_correspondence_records_updated_at
before update on public.correspondence_records
for each row execute function public.correspondence_set_updated_at();

create trigger trg_correspondence_approvals_updated_at
before update on public.correspondence_approvals
for each row execute function public.correspondence_set_updated_at();

create trigger trg_correspondence_records_before_insert
before insert on public.correspondence_records
for each row execute function public.correspondence_before_insert();

create trigger trg_correspondence_records_before_update
before update on public.correspondence_records
for each row execute function public.correspondence_before_update();

alter table public.correspondence_department_codes enable row level security;
alter table public.correspondence_counters enable row level security;
alter table public.correspondence_records enable row level security;
alter table public.correspondence_approvals enable row level security;
alter table public.correspondence_events enable row level security;
alter table public.correspondence_versions enable row level security;

create policy "correspondence_department_codes_select"
on public.correspondence_department_codes
for select
using (auth.uid() is not null);

create policy "correspondence_department_codes_manage"
on public.correspondence_department_codes
for all
using (public.correspondence_is_admin())
with check (public.correspondence_is_admin());

create policy "correspondence_records_select"
on public.correspondence_records
for select
using (
  originator_id = auth.uid()
  or responsible_officer_id = auth.uid()
  or public.correspondence_is_admin()
  or (
    department_name is not null and public.correspondence_is_lead_for_department(department_name)
  )
  or (
    assigned_department_name is not null and public.correspondence_is_lead_for_department(assigned_department_name)
  )
);

create policy "correspondence_records_insert"
on public.correspondence_records
for insert
with check (
  auth.uid() is not null
  and originator_id = auth.uid()
);

create policy "correspondence_records_update"
on public.correspondence_records
for update
using (
  originator_id = auth.uid()
  or responsible_officer_id = auth.uid()
  or public.correspondence_is_admin()
  or (
    department_name is not null and public.correspondence_is_lead_for_department(department_name)
  )
  or (
    assigned_department_name is not null and public.correspondence_is_lead_for_department(assigned_department_name)
  )
)
with check (
  originator_id = auth.uid()
  or responsible_officer_id = auth.uid()
  or public.correspondence_is_admin()
  or (
    department_name is not null and public.correspondence_is_lead_for_department(department_name)
  )
  or (
    assigned_department_name is not null and public.correspondence_is_lead_for_department(assigned_department_name)
  )
);

create policy "correspondence_approvals_select"
on public.correspondence_approvals
for select
using (
  exists (
    select 1
    from public.correspondence_records r
    where r.id = correspondence_approvals.correspondence_id
      and (
        r.originator_id = auth.uid()
        or r.responsible_officer_id = auth.uid()
        or public.correspondence_is_admin()
        or (r.department_name is not null and public.correspondence_is_lead_for_department(r.department_name))
        or (r.assigned_department_name is not null and public.correspondence_is_lead_for_department(r.assigned_department_name))
      )
  )
);

create policy "correspondence_approvals_insert"
on public.correspondence_approvals
for insert
with check (
  public.correspondence_is_admin()
  or exists (
    select 1
    from public.correspondence_records r
    where r.id = correspondence_approvals.correspondence_id
      and (
        (r.department_name is not null and public.correspondence_is_lead_for_department(r.department_name))
        or (r.assigned_department_name is not null and public.correspondence_is_lead_for_department(r.assigned_department_name))
      )
  )
);

create policy "correspondence_approvals_update"
on public.correspondence_approvals
for update
using (
  approver_id = auth.uid()
  or public.correspondence_is_admin()
)
with check (
  approver_id = auth.uid()
  or public.correspondence_is_admin()
);

create policy "correspondence_events_select"
on public.correspondence_events
for select
using (
  exists (
    select 1
    from public.correspondence_records r
    where r.id = correspondence_events.correspondence_id
      and (
        r.originator_id = auth.uid()
        or r.responsible_officer_id = auth.uid()
        or public.correspondence_is_admin()
        or (r.department_name is not null and public.correspondence_is_lead_for_department(r.department_name))
        or (r.assigned_department_name is not null and public.correspondence_is_lead_for_department(r.assigned_department_name))
      )
  )
);

create policy "correspondence_events_insert"
on public.correspondence_events
for insert
with check (
  actor_id = auth.uid()
  or public.correspondence_is_admin()
);

create policy "correspondence_versions_select"
on public.correspondence_versions
for select
using (
  exists (
    select 1
    from public.correspondence_records r
    where r.id = correspondence_versions.correspondence_id
      and (
        r.originator_id = auth.uid()
        or r.responsible_officer_id = auth.uid()
        or public.correspondence_is_admin()
        or (r.department_name is not null and public.correspondence_is_lead_for_department(r.department_name))
        or (r.assigned_department_name is not null and public.correspondence_is_lead_for_department(r.assigned_department_name))
      )
  )
);

create policy "correspondence_versions_insert"
on public.correspondence_versions
for insert
with check (
  uploaded_by = auth.uid()
  or public.correspondence_is_admin()
);

create policy "correspondence_counters_select_admin_only"
on public.correspondence_counters
for select
using (public.correspondence_is_admin());

create policy "correspondence_counters_manage_service"
on public.correspondence_counters
for all
using (auth.role() = 'service_role' or public.correspondence_is_admin())
with check (auth.role() = 'service_role' or public.correspondence_is_admin());

grant all on table public.correspondence_department_codes to authenticated;
grant all on table public.correspondence_records to authenticated;
grant all on table public.correspondence_approvals to authenticated;
grant all on table public.correspondence_events to authenticated;
grant all on table public.correspondence_versions to authenticated;

grant execute on function public.generate_correspondence_reference(text, text, text, integer) to authenticated;
grant execute on function public.correspondence_is_admin() to authenticated;
grant execute on function public.correspondence_is_lead_for_department(text) to authenticated;

insert into public.correspondence_department_codes (department_name, department_code)
values
  ('Human Resources', 'HRM'),
  ('Business Development', 'BD'),
  ('MD/CEO Office', 'MD'),
  ('Project Development', 'PD'),
  ('Accounts', 'ACC'),
  ('Legal/Regulatory', 'LGR'),
  ('MD OFFICE', 'MDO'),
  ('Admin & HR', 'HR'),
  ('Business, Growth and Innovation', 'BGI'),
  ('Legal, Regulatory and Compliance', 'LEG'),
  ('IT and Communications', 'IT'),
  ('Operations', 'OPS'),
  ('Technical', 'TECH')
on conflict (department_name) do update
set department_code = excluded.department_code,
    is_active = true,
    updated_at = now();
