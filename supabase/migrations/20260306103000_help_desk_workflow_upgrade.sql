-- Help Desk workflow upgrade:
-- - support categories with workflow mode
-- - explicit queue/department assignment modes
-- - requester-department-first procurement approvals

create table if not exists public.help_desk_categories (
  id uuid primary key default gen_random_uuid(),
  service_department text not null,
  request_type text not null check (request_type in ('support', 'procurement')),
  code text not null unique,
  name text not null,
  description text,
  support_mode text check (support_mode in ('open_queue', 'lead_review_required')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_help_desk_categories_updated_at
before update on public.help_desk_categories
for each row execute function public.help_desk_set_updated_at();

alter table public.help_desk_categories enable row level security;

drop policy if exists "help_desk_categories_select" on public.help_desk_categories;
create policy "help_desk_categories_select"
on public.help_desk_categories
for select
using (auth.uid() is not null);

drop policy if exists "help_desk_categories_manage" on public.help_desk_categories;
create policy "help_desk_categories_manage"
on public.help_desk_categories
for all
using (public.help_desk_is_admin())
with check (public.help_desk_is_admin());

alter table public.help_desk_tickets
  add column if not exists category_id uuid references public.help_desk_categories(id) on delete set null,
  add column if not exists requester_department text,
  add column if not exists support_mode text check (support_mode in ('open_queue', 'lead_review_required')),
  add column if not exists handling_mode text not null default 'individual'
    check (handling_mode in ('individual', 'queue', 'department')),
  add column if not exists current_approval_stage text;

update public.help_desk_tickets
set requester_department = p.department
from public.profiles p
where p.id = help_desk_tickets.requester_id
  and help_desk_tickets.requester_department is null;

alter table public.help_desk_tickets
  drop constraint if exists help_desk_tickets_status_check;

alter table public.help_desk_tickets
  add constraint help_desk_tickets_status_check
  check (
    status in (
      'new',
      'pending_lead_review',
      'department_queue',
      'department_assigned',
      'assigned',
      'in_progress',
      'pending_approval',
      'approved_for_procurement',
      'rejected',
      'returned',
      'resolved',
      'closed',
      'cancelled'
    )
  );

alter table public.help_desk_approvals
  drop constraint if exists help_desk_approvals_approval_stage_check;

update public.help_desk_approvals
set approval_stage = 'service_department_lead'
where approval_stage = 'department_lead';

alter table public.help_desk_approvals
  add constraint help_desk_approvals_approval_stage_check
  check (
    approval_stage in (
      'requester_department_lead',
      'service_department_lead',
      'head_corporate_services',
      'managing_director'
    )
  );

create index if not exists idx_help_desk_tickets_requester_department_status
  on public.help_desk_tickets(requester_department, status);

create index if not exists idx_help_desk_tickets_handling_mode_status
  on public.help_desk_tickets(handling_mode, status);

insert into public.help_desk_categories (service_department, request_type, code, name, description, support_mode)
values
  ('IT and Communications', 'support', 'it_general_support', 'General IT Support', 'Standard IT issues and troubleshooting.', 'open_queue'),
  ('IT and Communications', 'support', 'it_access_request', 'System Access Request', 'Access, permissions, and account setup.', 'lead_review_required'),
  ('Operations', 'support', 'ops_internal_support', 'Operations Support', 'Routine operations issues.', 'open_queue'),
  ('Operations', 'support', 'ops_special_request', 'Special Operations Request', 'Support requiring lead review or coordination.', 'lead_review_required'),
  ('Admin & HR', 'support', 'hr_office_support', 'Office Support', 'General Admin & HR support issues.', 'open_queue'),
  ('Accounts', 'procurement', 'accounts_procurement', 'Procurement Request', 'Procurement and spending requests.', null)
on conflict (code) do update
set
  service_department = excluded.service_department,
  request_type = excluded.request_type,
  name = excluded.name,
  description = excluded.description,
  support_mode = excluded.support_mode,
  is_active = true,
  updated_at = now();
