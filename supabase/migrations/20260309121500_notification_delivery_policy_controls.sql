-- Central notification delivery policy controls (system + per-user overrides).

create table if not exists public.notification_delivery_policies (
  notification_key text primary key,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  updated_by uuid null references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint notification_delivery_policies_key_check check (
    notification_key in (
      'onboarding',
      'help_desk',
      'leave',
      'assets',
      'meetings',
      'communications',
      'reports',
      'system'
    )
  )
);

insert into public.notification_delivery_policies (notification_key)
values
  ('onboarding'),
  ('help_desk'),
  ('leave'),
  ('assets'),
  ('meetings'),
  ('communications'),
  ('reports'),
  ('system')
on conflict (notification_key) do nothing;

create table if not exists public.notification_user_delivery_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_key text not null references public.notification_delivery_policies (notification_key) on delete cascade,
  in_app_enabled boolean null,
  email_enabled boolean null,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);

grant select on table public.notification_delivery_policies to authenticated;
grant select, insert, update on table public.notification_user_delivery_preferences to authenticated;
grant all on table public.notification_delivery_policies to service_role;
grant all on table public.notification_user_delivery_preferences to service_role;

alter table public.notification_user_delivery_preferences enable row level security;

drop policy if exists "Notification user prefs select own" on public.notification_user_delivery_preferences;
create policy "Notification user prefs select own"
  on public.notification_user_delivery_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Notification user prefs upsert own" on public.notification_user_delivery_preferences;
create policy "Notification user prefs upsert own"
  on public.notification_user_delivery_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Notification user prefs update own" on public.notification_user_delivery_preferences;
create policy "Notification user prefs update own"
  on public.notification_user_delivery_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_category text,
  p_title text,
  p_message text,
  p_priority text default 'normal',
  p_link_url text default null,
  p_actor_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_rich_content jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_notification_id uuid;
  v_preferences public.notification_preferences%rowtype;
  v_module_key text := 'system';
  v_system_in_app_enabled boolean := true;
  v_user_module_in_app_enabled boolean := true;
begin
  -- map category/entity into module key for in-app policy enforcement
  if p_category = 'assets' then
    v_module_key := 'assets';
  elsif p_entity_type = 'leave_request' then
    v_module_key := 'leave';
  elsif p_entity_type = 'help_desk_ticket' then
    v_module_key := 'help_desk';
  elsif p_entity_type = 'meeting' then
    v_module_key := 'meetings';
  elsif p_entity_type = 'weekly_report' then
    v_module_key := 'reports';
  elsif p_entity_type = 'communication_broadcast' then
    v_module_key := 'communications';
  elsif p_category = 'system' then
    v_module_key := 'system';
  end if;

  select *
  into v_preferences
  from public.notification_preferences
  where user_id = p_user_id;

  if not found then
    insert into public.notification_preferences (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    v_preferences.user_id := p_user_id;
    v_preferences.in_app_enabled := true;
  end if;

  select ndp.in_app_enabled
  into v_system_in_app_enabled
  from public.notification_delivery_policies ndp
  where ndp.notification_key = v_module_key;

  if v_system_in_app_enabled is null then
    v_system_in_app_enabled := true;
  end if;

  select coalesce(nudp.in_app_enabled, true)
  into v_user_module_in_app_enabled
  from public.notification_user_delivery_preferences nudp
  where nudp.user_id = p_user_id
    and nudp.notification_key = v_module_key;

  if v_user_module_in_app_enabled is null then
    v_user_module_in_app_enabled := true;
  end if;

  if coalesce(v_preferences.in_app_enabled, true)
     and v_system_in_app_enabled
     and v_user_module_in_app_enabled then
    insert into public.notifications (
      user_id,
      type,
      category,
      title,
      message,
      priority,
      link_url,
      actor_id,
      entity_type,
      entity_id,
      rich_content,
      data,
      created_at
    ) values (
      p_user_id,
      p_type,
      p_category,
      p_title,
      p_message,
      p_priority,
      p_link_url,
      p_actor_id,
      p_entity_type,
      p_entity_id,
      p_rich_content,
      coalesce(p_rich_content, '{}'::jsonb),
      now()
    )
    returning id into v_notification_id;

    return v_notification_id;
  end if;

  return null;
end;
$function$;
