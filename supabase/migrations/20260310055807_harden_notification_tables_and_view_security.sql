begin;

-- 1) Enable RLS on advisor-flagged tables.
alter table public.notification_queue enable row level security;
alter table public.notification_delivery_policies enable row level security;

-- 2) notification_delivery_policies: readable by authenticated users, mutable by admins.
drop policy if exists "Notification delivery policies select" on public.notification_delivery_policies;
create policy "Notification delivery policies select"
on public.notification_delivery_policies
for select
to authenticated
using (true);

drop policy if exists "Notification delivery policies admin insert" on public.notification_delivery_policies;
create policy "Notification delivery policies admin insert"
on public.notification_delivery_policies
for insert
to authenticated
with check (has_role('admin'));

drop policy if exists "Notification delivery policies admin update" on public.notification_delivery_policies;
create policy "Notification delivery policies admin update"
on public.notification_delivery_policies
for update
to authenticated
using (has_role('admin'))
with check (has_role('admin'));

drop policy if exists "Notification delivery policies admin delete" on public.notification_delivery_policies;
create policy "Notification delivery policies admin delete"
on public.notification_delivery_policies
for delete
to authenticated
using (has_role('admin'));

-- 3) notification_queue: no broad read; allow operational writes for leads/admins.
drop policy if exists "Notification queue select" on public.notification_queue;
create policy "Notification queue select"
on public.notification_queue
for select
to authenticated
using (
  has_role('admin')
  or user_id = auth.uid()
);

drop policy if exists "Notification queue insert" on public.notification_queue;
create policy "Notification queue insert"
on public.notification_queue
for insert
to authenticated
with check (
  has_role('admin')
  or has_role('lead')
);

drop policy if exists "Notification queue update" on public.notification_queue;
create policy "Notification queue update"
on public.notification_queue
for update
to authenticated
using (
  has_role('admin')
  or has_role('lead')
)
with check (
  has_role('admin')
  or has_role('lead')
);

drop policy if exists "Notification queue delete" on public.notification_queue;
create policy "Notification queue delete"
on public.notification_queue
for delete
to authenticated
using (has_role('admin'));

-- 4) Remove SECURITY DEFINER behavior from the flagged view.
alter view public.leave_routing_health_v set (security_invoker = true);

commit;;
