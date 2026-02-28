-- Help Desk Ticketing + Procurement Approval + KPI foundation

create table if not exists public.help_desk_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  title text not null,
  description text,
  request_type text not null default 'support' check (request_type in ('support', 'procurement')),
  category text,
  service_department text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new' check (
    status in (
      'new',
      'assigned',
      'in_progress',
      'pending_approval',
      'approved_for_procurement',
      'rejected',
      'resolved',
      'closed',
      'cancelled'
    )
  ),
  requester_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null,
  pivoted_to_procurement boolean not null default false,
  procurement_reason text,
  approval_required boolean not null default false,
  sla_target_at timestamptz,
  submitted_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  csat_rating int check (csat_rating between 1 and 5),
  csat_feedback text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_desk_approvals (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.help_desk_tickets(id) on delete cascade,
  approval_stage text not null check (approval_stage in ('department_lead', 'head_corporate_services', 'managing_director')),
  approver_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comments text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ticket_id, approval_stage)
);

create table if not exists public.help_desk_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.help_desk_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  comment text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'requester')),
  created_at timestamptz not null default now()
);

create table if not exists public.help_desk_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.help_desk_tickets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_help_desk_tickets_requester on public.help_desk_tickets(requester_id);
create index if not exists idx_help_desk_tickets_assigned_to on public.help_desk_tickets(assigned_to);
create index if not exists idx_help_desk_tickets_department_status on public.help_desk_tickets(service_department, status);
create index if not exists idx_help_desk_tickets_priority on public.help_desk_tickets(priority);
create index if not exists idx_help_desk_tickets_created_at on public.help_desk_tickets(created_at desc);
create index if not exists idx_help_desk_approvals_ticket_stage on public.help_desk_approvals(ticket_id, approval_stage);
create index if not exists idx_help_desk_comments_ticket on public.help_desk_comments(ticket_id, created_at desc);
create index if not exists idx_help_desk_events_ticket on public.help_desk_events(ticket_id, created_at desc);

create or replace function public.help_desk_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_help_desk_tickets_updated_at
before update on public.help_desk_tickets
for each row execute function public.help_desk_set_updated_at();

create trigger trg_help_desk_approvals_updated_at
before update on public.help_desk_approvals
for each row execute function public.help_desk_set_updated_at();

create or replace function public.generate_help_desk_ticket_number()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  select coalesce(max((regexp_replace(ticket_number, '^HD-', ''))::bigint), 0) + 1
  into next_number
  from public.help_desk_tickets
  where ticket_number like 'HD-%';

  return 'HD-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.help_desk_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or btrim(new.ticket_number) = '' then
    new.ticket_number := public.generate_help_desk_ticket_number();
  end if;
  if new.submitted_at is null then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_help_desk_before_insert
before insert on public.help_desk_tickets
for each row execute function public.help_desk_before_insert();

alter table public.help_desk_tickets enable row level security;
alter table public.help_desk_approvals enable row level security;
alter table public.help_desk_comments enable row level security;
alter table public.help_desk_events enable row level security;

-- Common role helpers
create or replace function public.help_desk_is_admin()
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

create or replace function public.help_desk_is_lead_for_department(p_department text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'super_admin')
        or (
          p.role = 'lead'
          and (
            p_department = any(coalesce(p.lead_departments, '{}'::text[]))
            or coalesce(p.department, '') = p_department
          )
        )
      )
  );
$$;

-- Tickets policies
create policy "help_desk_tickets_select"
on public.help_desk_tickets
for select
using (
  requester_id = auth.uid()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.help_desk_is_admin()
  or public.help_desk_is_lead_for_department(service_department)
);

create policy "help_desk_tickets_insert"
on public.help_desk_tickets
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and requester_id = auth.uid()
);

create policy "help_desk_tickets_update"
on public.help_desk_tickets
for update
using (
  assigned_to = auth.uid()
  or requester_id = auth.uid()
  or public.help_desk_is_admin()
  or public.help_desk_is_lead_for_department(service_department)
)
with check (
  assigned_to = auth.uid()
  or requester_id = auth.uid()
  or public.help_desk_is_admin()
  or public.help_desk_is_lead_for_department(service_department)
);

-- Approvals policies
create policy "help_desk_approvals_select"
on public.help_desk_approvals
for select
using (
  exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_approvals.ticket_id
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.help_desk_is_admin()
        or public.help_desk_is_lead_for_department(t.service_department)
      )
  )
);

create policy "help_desk_approvals_insert"
on public.help_desk_approvals
for insert
with check (
  public.help_desk_is_admin()
  or exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_approvals.ticket_id
      and public.help_desk_is_lead_for_department(t.service_department)
  )
);

create policy "help_desk_approvals_update"
on public.help_desk_approvals
for update
using (
  approver_id = auth.uid()
  or public.help_desk_is_admin()
)
with check (
  approver_id = auth.uid()
  or public.help_desk_is_admin()
);

-- Comments policies
create policy "help_desk_comments_select"
on public.help_desk_comments
for select
using (
  exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_comments.ticket_id
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.help_desk_is_admin()
        or public.help_desk_is_lead_for_department(t.service_department)
      )
  )
);

create policy "help_desk_comments_insert"
on public.help_desk_comments
for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_comments.ticket_id
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.help_desk_is_admin()
        or public.help_desk_is_lead_for_department(t.service_department)
      )
  )
);

-- Events policies
create policy "help_desk_events_select"
on public.help_desk_events
for select
using (
  exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_events.ticket_id
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.help_desk_is_admin()
        or public.help_desk_is_lead_for_department(t.service_department)
      )
  )
);

create policy "help_desk_events_insert"
on public.help_desk_events
for insert
with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_events.ticket_id
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.help_desk_is_admin()
        or public.help_desk_is_lead_for_department(t.service_department)
      )
  )
);
