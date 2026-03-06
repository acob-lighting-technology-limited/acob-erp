create or replace function public.handle_new_asset_issue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assigned_to uuid;
  v_created_by_name text;
begin
  select aa.assigned_to
  into v_assigned_to
  from public.asset_assignments aa
  where aa.asset_id = new.asset_id
    and aa.is_current = true
  limit 1;

  if v_assigned_to is null then
    return new;
  end if;

  select coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name), p.company_email)
  into v_created_by_name
  from public.profiles p
  where p.id = new.created_by;

  perform public.enqueue_asset_notification_bundle(
    v_assigned_to,
    'asset_status_alert',
    'Asset Status Update: Issue Reported',
    'Asset issue has been reported and requires attention.',
    new.asset_id,
    v_created_by_name,
    coalesce(new.created_at, now()),
    jsonb_build_object(
      'status_action', 'Issue Reported',
      'status_description', new.description,
      'reported_by', coalesce(v_created_by_name, 'System'),
      'date', coalesce(new.created_at, now())
    ),
    'issue_new_' || new.id::text
  );

  return new;
end;
$$;

create or replace function public.handle_asset_issue_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assigned_to uuid;
  v_resolved_by_name text;
begin
  if not ((old.resolved is false or old.resolved is null) and new.resolved is true) then
    return new;
  end if;

  select aa.assigned_to
  into v_assigned_to
  from public.asset_assignments aa
  where aa.asset_id = new.asset_id
    and aa.is_current = true
  limit 1;

  if v_assigned_to is null then
    return new;
  end if;

  select coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name), p.company_email)
  into v_resolved_by_name
  from public.profiles p
  where p.id = new.resolved_by;

  perform public.enqueue_asset_notification_bundle(
    v_assigned_to,
    'asset_status_fixed',
    'Asset Status Update: Issue Resolved',
    'Asset issue has been resolved and the asset is operational.',
    new.asset_id,
    v_resolved_by_name,
    coalesce(new.resolved_at, now()),
    jsonb_build_object(
      'status_action', 'Issue Resolved',
      'resolution_note', 'Issue Resolved (Working)',
      'resolved_by', coalesce(v_resolved_by_name, 'System'),
      'date', coalesce(new.resolved_at, now())
    ),
    'issue_fixed_' || new.id::text
  );

  return new;
end;
$$;
