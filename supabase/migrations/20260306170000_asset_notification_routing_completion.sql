create or replace function public.resolve_asset_notification_recent_owner(p_asset_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  select aa.assigned_to
  into v_user_id
  from public.asset_assignments aa
  where aa.asset_id = p_asset_id
    and aa.assigned_to is not null
  order by aa.is_current desc, coalesce(aa.handed_over_at, aa.assigned_at) desc nulls last, aa.assigned_at desc nulls last
  limit 1;

  return v_user_id;
end;
$$;

create or replace function public.enqueue_asset_notification_bundle(
  p_target_user_id uuid,
  p_notification_type text,
  p_notification_title text,
  p_notification_message text,
  p_asset_id uuid,
  p_actor_name text default null,
  p_event_at timestamptz default now(),
  p_extra_data jsonb default '{}'::jsonb,
  p_fingerprint_suffix text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_send_after timestamptz := now() + interval '5 minutes';
  v_unique_code text;
  v_asset_data jsonb;
  v_target_name text;
  v_target_department text;
  v_target_email text;
  v_fingerprint text;
  v_escalation record;
  v_notification_data jsonb;
  v_oversight_data jsonb;
begin
  if p_target_user_id is null then
    return;
  end if;

  select
    unique_code,
    jsonb_build_object(
      'unique_code', unique_code,
      'asset_type', asset_type,
      'asset_model', asset_model,
      'serial_number', serial_number,
      'department', department
    )
  into v_unique_code, v_asset_data
  from public.assets
  where id = p_asset_id;

  select
    coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name), p.company_email, 'Staff Member'),
    p.department,
    p.company_email
  into v_target_name, v_target_department, v_target_email
  from public.profiles p
  where p.id = p_target_user_id;

  v_notification_data := coalesce(v_asset_data, '{}'::jsonb)
    || jsonb_build_object(
      'mail_audience', 'assignee',
      'assigned_employee_name', v_target_name,
      'assigned_employee_department', v_target_department,
      'assigned_employee_email', v_target_email,
      'assigned_by', coalesce(p_actor_name, 'System Admin'),
      'assigned_date', p_event_at
    )
    || coalesce(p_extra_data, '{}'::jsonb);

  v_fingerprint := p_notification_type || '_' || p_target_user_id::text || '_' || coalesce(v_unique_code, p_asset_id::text) || '_'
    || coalesce(p_fingerprint_suffix, to_char(date_trunc('second', p_event_at), 'YYYYMMDDHH24MISS'));

  if not exists (
    select 1
    from public.notification_queue nq
    where nq.user_id = p_target_user_id
      and nq.fingerprint = v_fingerprint
      and nq.status in ('pending', 'processing', 'sent')
  ) then
    insert into public.notifications (user_id, type, title, message, category, data)
    values (p_target_user_id, p_notification_type, p_notification_title, p_notification_message, 'assets', v_notification_data);

    insert into public.notification_queue (
      user_id, type, title, message, data, status, fingerprint, scheduled_for, process_after
    ) values (
      p_target_user_id, p_notification_type, p_notification_title, p_notification_message, v_notification_data,
      'pending', v_fingerprint, v_send_after, v_send_after
    );
  end if;

  for v_escalation in
    select recipient_id, recipient_role
    from public.resolve_asset_notification_escalation_recipient(p_target_user_id)
  loop
    if v_escalation.recipient_id is null or v_escalation.recipient_id = p_target_user_id then
      continue;
    end if;

    v_oversight_data := v_notification_data || jsonb_build_object(
      'mail_audience', 'oversight',
      'oversight_target_role', coalesce(v_escalation.recipient_role, 'Oversight Recipient')
    );

    v_fingerprint := p_notification_type || '_oversight_' || v_escalation.recipient_id::text || '_' || coalesce(v_unique_code, p_asset_id::text) || '_'
      || coalesce(p_fingerprint_suffix, to_char(date_trunc('second', p_event_at), 'YYYYMMDDHH24MISS'));

    if not exists (
      select 1
      from public.notification_queue nq
      where nq.user_id = v_escalation.recipient_id
        and nq.fingerprint = v_fingerprint
        and nq.status in ('pending', 'processing', 'sent')
    ) then
      insert into public.notifications (user_id, type, title, message, category, data)
      values (
        v_escalation.recipient_id,
        p_notification_type,
        case
          when p_notification_type = 'asset_assigned' then 'Asset Assignment Notice'
          when p_notification_type in ('asset_transfer_incoming', 'asset_transfer_outgoing') then 'Asset Transfer Notice'
          when p_notification_type = 'asset_returned' then 'Asset Return Notice'
          when p_notification_type = 'asset_status_alert' then 'Asset Status Alert Notice'
          when p_notification_type = 'asset_status_fixed' then 'Asset Status Restored Notice'
          else p_notification_title
        end,
        p_notification_message,
        'assets',
        v_oversight_data
      );

      insert into public.notification_queue (
        user_id, type, title, message, data, status, fingerprint, scheduled_for, process_after
      ) values (
        v_escalation.recipient_id,
        p_notification_type,
        case
          when p_notification_type = 'asset_assigned' then 'Asset Assignment Notice'
          when p_notification_type in ('asset_transfer_incoming', 'asset_transfer_outgoing') then 'Asset Transfer Notice'
          when p_notification_type = 'asset_returned' then 'Asset Return Notice'
          when p_notification_type = 'asset_status_alert' then 'Asset Status Alert Notice'
          when p_notification_type = 'asset_status_fixed' then 'Asset Status Restored Notice'
          else p_notification_title
        end,
        p_notification_message,
        v_oversight_data,
        'pending',
        v_fingerprint,
        v_send_after,
        v_send_after
      );
    end if;
  end loop;
end;
$$;

create or replace function public.handle_new_asset_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assigner_name text;
  v_prev_owner_id uuid;
  v_target_user_id uuid;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select full_name
  into v_assigner_name
  from public.profiles
  where id = new.assigned_by;

  v_target_user_id := new.assigned_to;

  if v_target_user_id is null and new.department is not null then
    select department_head_id
    into v_target_user_id
    from public.departments
    where name = new.department;
  end if;

  select assigned_to
  into v_prev_owner_id
  from public.asset_assignments
  where asset_id = new.asset_id
    and id != new.id
    and (
      is_current = true
      or (is_current = false and handed_over_at >= (now() - interval '10 seconds'))
    )
  order by handed_over_at desc nulls first
  limit 1;

  perform public.enqueue_asset_notification_bundle(
    v_target_user_id,
    case when v_prev_owner_id is not null then 'asset_transfer_incoming' else 'asset_assigned' end,
    case when v_prev_owner_id is not null then 'Asset Transfer Received' else 'Asset Officially Assigned' end,
    case
      when v_prev_owner_id is not null then 'An asset has been transferred to your custody. You are now responsible for this item.'
      else 'This is to officially notify you that an organizational asset has been assigned to you. Kindly review the details below.'
    end,
    new.asset_id,
    v_assigner_name,
    new.assigned_at,
    jsonb_build_object(
      'assignment_type', new.assignment_type,
      'condition', 'Good / Working'
    ),
    'incoming_' || new.id::text
  );

  if v_prev_owner_id is not null then
    perform public.enqueue_asset_notification_bundle(
      v_prev_owner_id,
      'asset_transfer_outgoing',
      'Asset Transfer Initiated',
      'This asset has been transferred from your custody. It is no longer assigned to your account.',
      new.asset_id,
      v_assigner_name,
      new.assigned_at,
      jsonb_build_object(
        'authorized_by', coalesce(v_assigner_name, 'System Admin'),
        'transfer_date', new.assigned_at
      ),
      'outgoing_' || new.id::text
    );
  end if;

  return new;
end;
$$;

create or replace function public.handle_asset_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_user_id uuid;
  v_actor_name text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  select full_name
  into v_actor_name
  from public.profiles
  where id = auth.uid();

  v_target_user_id := public.resolve_asset_notification_recent_owner(new.id);

  if old.status = 'assigned' and new.status in ('available', 'retired') then
    perform public.enqueue_asset_notification_bundle(
      v_target_user_id,
      'asset_returned',
      'Asset Officially Returned',
      'We confirm that you have returned the following asset. It has been successfully unassigned from your account.',
      new.id,
      v_actor_name,
      now(),
      jsonb_build_object(
        'authorized_by', coalesce(v_actor_name, 'System Admin'),
        'return_date', now()
      ),
      'returned_' || new.id::text || '_' || extract(epoch from now())::bigint::text
    );
    return new;
  end if;

  if new.status = 'maintenance' then
    perform public.enqueue_asset_notification_bundle(
      v_target_user_id,
      'asset_status_alert',
      'Asset Status Alert',
      'The status of the following asset has been updated to MAINTENANCE.',
      new.id,
      v_actor_name,
      now(),
      jsonb_build_object(
        'reported_by', coalesce(v_actor_name, 'System Admin'),
        'status_description', coalesce(new.notes, 'Asset moved to maintenance.')
      ),
      'status_alert_' || new.id::text || '_' || extract(epoch from now())::bigint::text
    );
    return new;
  end if;

  if old.status = 'maintenance' and new.status in ('available', 'assigned') then
    perform public.enqueue_asset_notification_bundle(
      v_target_user_id,
      'asset_status_fixed',
      'Asset Status Restored',
      'The following asset has been repaired and is now fully OPERATIONAL.',
      new.id,
      v_actor_name,
      now(),
      jsonb_build_object(
        'resolution_note', coalesce(new.notes, 'Issue Resolved')
      ),
      'status_fixed_' || new.id::text || '_' || extract(epoch from now())::bigint::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assets_status_notifications on public.assets;
create trigger trg_assets_status_notifications
after update of status on public.assets
for each row
execute function public.handle_asset_status_notifications();
