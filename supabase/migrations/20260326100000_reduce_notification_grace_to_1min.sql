-- Reduce asset notification queue grace period from 5 minutes to 1 minute
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
  v_send_after timestamptz := now() + interval '1 minute';
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
