create or replace function public.asset_notification_requester_kind(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_managed_departments text[] := '{}'::text[];
begin
  select *
  into v_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    return 'employee';
  end if;

  v_managed_departments := coalesce(v_profile.lead_departments, '{}'::text[]);

  if v_profile.is_department_lead
     and (
       v_profile.department = 'Executive Management'
       or 'Executive Management' = any(v_managed_departments)
     ) then
    return 'md';
  end if;

  if v_profile.is_department_lead
     and (
       v_profile.department = 'Corporate Services'
       or 'Corporate Services' = any(v_managed_departments)
     ) then
    return 'hcs';
  end if;

  if v_profile.is_department_lead then
    return 'dept_lead';
  end if;

  return 'employee';
end;
$$;

create or replace function public.resolve_asset_notification_department_lead(p_department_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_head_id uuid;
  v_profile_id uuid;
begin
  if p_department_name is null or btrim(p_department_name) = '' then
    return null;
  end if;

  select d.department_head_id
  into v_department_head_id
  from public.departments d
  where d.name = p_department_name
  limit 1;

  if v_department_head_id is not null then
    perform 1
    from public.profiles p
    where p.id = v_department_head_id
      and p.employment_status = 'active';

    if found then
      return v_department_head_id;
    end if;
  end if;

  select p.id
  into v_profile_id
  from public.profiles p
  where p.employment_status = 'active'
    and p.is_department_lead = true
    and (
      p.department = p_department_name
      or p_department_name = any(coalesce(p.lead_departments, '{}'::text[]))
    )
  order by p.updated_at desc nulls last, p.created_at asc
  limit 1;

  return v_profile_id;
end;
$$;

create or replace function public.resolve_asset_notification_escalation_recipient(p_user_id uuid)
returns table(recipient_id uuid, recipient_role text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_kind text;
  v_department text;
  v_recipient_id uuid;
  v_hcs_id uuid;
  v_md_id uuid;
begin
  select department
  into v_department
  from public.profiles
  where id = p_user_id;

  v_requester_kind := public.asset_notification_requester_kind(p_user_id);

  if v_requester_kind = 'employee' then
    v_recipient_id := public.resolve_asset_notification_department_lead(v_department);
    if v_recipient_id is not null and v_recipient_id <> p_user_id then
      recipient_id := v_recipient_id;
      recipient_role := 'Department Lead';
      return next;
    end if;
    return;
  end if;

  if v_requester_kind = 'dept_lead' then
    v_hcs_id := public.resolve_asset_notification_department_lead('Corporate Services');
    if v_hcs_id is not null and v_hcs_id <> p_user_id then
      recipient_id := v_hcs_id;
      recipient_role := 'Head of Corporate Services';
      return next;
    end if;

    v_md_id := public.resolve_asset_notification_department_lead('Executive Management');
    if v_md_id is not null and v_md_id <> p_user_id and v_md_id <> coalesce(v_hcs_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      recipient_id := v_md_id;
      recipient_role := 'Managing Director';
      return next;
    end if;
    return;
  end if;

  if v_requester_kind = 'hcs' then
    v_recipient_id := public.resolve_asset_notification_department_lead('Executive Management');
    if v_recipient_id is not null and v_recipient_id <> p_user_id then
      recipient_id := v_recipient_id;
      recipient_role := 'Managing Director';
      return next;
    end if;
    return;
  end if;

  return;
end;
$$;

create or replace function public.handle_new_asset_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_asset_data jsonb;
  v_assigner_name text;
  v_prev_owner_id uuid;
  v_target_user_id uuid;
  v_notification_type text;
  v_notification_title text;
  v_notification_message text;
  v_notification_id uuid;
  v_unique_code text;
  v_fingerprint text;
  v_send_after timestamptz := now() + interval '5 minutes';
  v_escalation_user_id uuid;
  v_escalation_role text;
  v_escalation_title text;
  v_escalation_message text;
  v_escalation_fingerprint text;
  v_assigned_employee_name text;
  v_assigned_employee_department text;
  v_assigned_employee_email text;
  v_escalation_record record;
begin
  if tg_op = 'INSERT' then
    select
      jsonb_build_object(
        'unique_code', unique_code,
        'asset_type', asset_type,
        'asset_model', asset_model,
        'serial_number', serial_number,
        'department', department
      ),
      unique_code
    into v_asset_data, v_unique_code
    from public.assets
    where id = new.asset_id;

    select full_name into v_assigner_name
    from public.profiles
    where id = new.assigned_by;

    v_target_user_id := new.assigned_to;

    if v_target_user_id is null and new.department is not null then
      select department_head_id
      into v_target_user_id
      from public.departments
      where name = new.department;
    end if;

    if v_target_user_id is null then
      return new;
    end if;

    select
      coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name), p.company_email, 'Staff Member'),
      p.department,
      p.company_email
    into
      v_assigned_employee_name,
      v_assigned_employee_department,
      v_assigned_employee_email
    from public.profiles p
    where p.id = v_target_user_id;

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

    v_notification_type := case when v_prev_owner_id is not null then 'asset_transfer_incoming' else 'asset_assigned' end;
    v_notification_title := case when v_prev_owner_id is not null then 'Asset Transfer Received' else 'Asset Officially Assigned' end;
    v_notification_message := case
      when v_prev_owner_id is not null then 'An asset has been transferred to your custody/unit.'
      else 'An asset (' || coalesce(v_unique_code, new.asset_id::text) || ') has been assigned to you/your unit.'
    end;

    v_asset_data := coalesce(v_asset_data, '{}'::jsonb) || jsonb_build_object(
      'assigned_by', coalesce(v_assigner_name, 'System Admin'),
      'assigned_date', new.assigned_at,
      'assignment_type', new.assignment_type,
      'mail_audience', 'assignee',
      'assigned_employee_name', v_assigned_employee_name,
      'assigned_employee_department', v_assigned_employee_department,
      'assigned_employee_email', v_assigned_employee_email
    );

    v_fingerprint := v_notification_type || '_' || v_target_user_id::text || '_' || coalesce(v_unique_code, new.asset_id::text);

    if not exists (
      select 1
      from public.notification_queue nq
      where nq.user_id = v_target_user_id
        and nq.fingerprint = v_fingerprint
        and nq.status in ('pending', 'processing', 'sent')
    ) then
      insert into public.notifications (user_id, type, title, message, category, data)
      values (
        v_target_user_id,
        v_notification_type,
        v_notification_title,
        v_notification_message,
        'assets',
        v_asset_data
      )
      returning id into v_notification_id;

      insert into public.notification_queue (
        user_id,
        type,
        title,
        message,
        data,
        status,
        fingerprint,
        scheduled_for,
        process_after
      ) values (
        v_target_user_id,
        v_notification_type,
        v_notification_title,
        v_notification_message,
        v_asset_data,
        'pending',
        v_fingerprint,
        v_send_after,
        v_send_after
      );
    end if;

    for v_escalation_record in
      select recipient_id, recipient_role
      from public.resolve_asset_notification_escalation_recipient(v_target_user_id)
    loop
      v_escalation_user_id := v_escalation_record.recipient_id;
      v_escalation_role := v_escalation_record.recipient_role;

      if v_escalation_user_id is null or v_escalation_user_id = v_target_user_id then
        continue;
      end if;

      v_escalation_title := case
        when v_prev_owner_id is not null then 'Asset Transfer Notice'
        else 'Asset Assignment Notice'
      end;

      v_escalation_message := case
        when v_prev_owner_id is not null then
          'An asset (' || coalesce(v_unique_code, new.asset_id::text) || ') has been transferred to '
          || coalesce(v_assigned_employee_name, 'a staff member')
          || '. You are receiving this as ' || coalesce(v_escalation_role, 'an oversight recipient') || '.'
        else
          'An asset (' || coalesce(v_unique_code, new.asset_id::text) || ') has been assigned to '
          || coalesce(v_assigned_employee_name, 'a staff member')
          || '. You are receiving this as ' || coalesce(v_escalation_role, 'an oversight recipient') || '.'
      end;

      v_escalation_fingerprint := v_notification_type || '_oversight_' || v_escalation_user_id::text || '_'
        || coalesce(v_unique_code, new.asset_id::text);

      if not exists (
        select 1
        from public.notification_queue nq
        where nq.user_id = v_escalation_user_id
          and nq.fingerprint = v_escalation_fingerprint
          and nq.status in ('pending', 'processing', 'sent')
      ) then
        insert into public.notifications (user_id, type, title, message, category, data)
        values (
          v_escalation_user_id,
          v_notification_type,
          v_escalation_title,
          v_escalation_message,
          'assets',
          v_asset_data || jsonb_build_object(
            'mail_audience', 'oversight',
            'oversight_target_role', coalesce(v_escalation_role, 'Oversight Recipient')
          )
        );

        insert into public.notification_queue (
          user_id,
          type,
          title,
          message,
          data,
          status,
          fingerprint,
          scheduled_for,
          process_after
        ) values (
          v_escalation_user_id,
          v_notification_type,
          v_escalation_title,
          v_escalation_message,
          v_asset_data || jsonb_build_object(
            'mail_audience', 'oversight',
            'oversight_target_role', coalesce(v_escalation_role, 'Oversight Recipient')
          ),
          'pending',
          v_escalation_fingerprint,
          v_send_after,
          v_send_after
        );
      end if;
    end loop;
  end if;

  return new;
end;
$function$;
