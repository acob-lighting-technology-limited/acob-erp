-- Align Help Desk policy helpers with department-lead identity
-- and requester/service department visibility.

create or replace function public.help_desk_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'developer')
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
        p.role in ('admin', 'super_admin', 'developer')
        or (
          p.is_department_lead = true
          and (
            p_department = any(coalesce(p.lead_departments, '{}'::text[]))
            or coalesce(p.department, '') = p_department
          )
        )
      )
  );
$$;

drop policy if exists "help_desk_tickets_select" on public.help_desk_tickets;
create policy "help_desk_tickets_select"
on public.help_desk_tickets
for select
using (
  requester_id = auth.uid()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.help_desk_is_admin()
  or public.help_desk_is_lead_for_department(service_department)
  or public.help_desk_is_lead_for_department(requester_department)
);

drop policy if exists "help_desk_tickets_update" on public.help_desk_tickets;
create policy "help_desk_tickets_update"
on public.help_desk_tickets
for update
using (
  assigned_to = auth.uid()
  or requester_id = auth.uid()
  or public.help_desk_is_admin()
  or public.help_desk_is_lead_for_department(service_department)
  or public.help_desk_is_lead_for_department(requester_department)
)
with check (
  assigned_to = auth.uid()
  or requester_id = auth.uid()
  or public.help_desk_is_admin()
  or public.help_desk_is_lead_for_department(service_department)
  or public.help_desk_is_lead_for_department(requester_department)
);

drop policy if exists "help_desk_approvals_select" on public.help_desk_approvals;
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
        or public.help_desk_is_lead_for_department(t.requester_department)
      )
  )
);

drop policy if exists "help_desk_approvals_insert" on public.help_desk_approvals;
create policy "help_desk_approvals_insert"
on public.help_desk_approvals
for insert
with check (
  public.help_desk_is_admin()
  or exists (
    select 1
    from public.help_desk_tickets t
    where t.id = help_desk_approvals.ticket_id
      and (
        public.help_desk_is_lead_for_department(t.service_department)
        or public.help_desk_is_lead_for_department(t.requester_department)
      )
  )
);

drop policy if exists "help_desk_comments_select" on public.help_desk_comments;
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
        or public.help_desk_is_lead_for_department(t.requester_department)
      )
  )
);

drop policy if exists "help_desk_comments_insert" on public.help_desk_comments;
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
        or public.help_desk_is_lead_for_department(t.requester_department)
      )
  )
);

drop policy if exists "help_desk_events_select" on public.help_desk_events;
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
        or public.help_desk_is_lead_for_department(t.requester_department)
      )
  )
);
