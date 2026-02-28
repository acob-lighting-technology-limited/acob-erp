-- Align RBAC role source with profiles.role and add scoped helpers for lead access.

create or replace function public.normalize_department_name(p_department text)
returns text
language sql
immutable
as $$
  select case
    when p_department is null then null
    when lower(trim(p_department)) = 'finance' then 'Accounts'
    else trim(p_department)
  end;
$$;

create or replace function public.user_managed_departments(p_user_id uuid default auth.uid())
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_department text;
  v_lead_departments text[];
  v_managed text[];
begin
  select role::text, department, coalesce(lead_departments, '{}'::text[])
  into v_role, v_department, v_lead_departments
  from public.profiles
  where id = p_user_id;

  if v_role is null then
    return '{}'::text[];
  end if;

  if v_role in ('admin', 'super_admin') then
    return null;
  end if;

  select array_agg(distinct public.normalize_department_name(value))
  into v_managed
  from unnest(v_lead_departments) value
  where value is not null and trim(value) <> '';

  if coalesce(array_length(v_managed, 1), 0) = 0 and v_department is not null then
    v_managed := array[public.normalize_department_name(v_department)];
  end if;

  return coalesce(v_managed, '{}'::text[]);
end;
$$;

create or replace function public.user_managed_offices(p_user_id uuid default auth.uid())
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_offices text[] := '{}'::text[];
  v_profile_office text;
  v_departments text[];
begin
  select office_location into v_profile_office from public.profiles where id = p_user_id;
  v_departments := public.user_managed_departments(p_user_id);

  if v_profile_office is not null and trim(v_profile_office) <> '' then
    v_offices := array_append(v_offices, v_profile_office);
  end if;

  if v_departments is not null and coalesce(array_length(v_departments, 1), 0) > 0 then
    select array_cat(
      v_offices,
      coalesce(array_agg(distinct ol.name), '{}'::text[])
    )
    into v_offices
    from public.office_locations ol
    where public.normalize_department_name(ol.department) = any(v_departments);
  end if;

  return (
    select coalesce(array_agg(distinct office_name), '{}'::text[])
    from unnest(v_offices) office_name
    where office_name is not null and trim(office_name) <> ''
  );
end;
$$;

create or replace function public.has_role(required_role text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_role text;
begin
  select role::text into current_role
  from public.profiles
  where id = auth.uid();

  case required_role
    when 'visitor' then
      return current_role in ('visitor', 'employee', 'lead', 'admin', 'super_admin');
    when 'employee' then
      return current_role in ('employee', 'lead', 'admin', 'super_admin');
    when 'lead' then
      return current_role in ('lead', 'admin', 'super_admin');
    when 'admin' then
      return current_role in ('admin', 'super_admin');
    when 'super_admin' then
      return current_role = 'super_admin';
    else
      return false;
  end case;
end;
$$;

drop policy if exists "Assets select policy" on public.assets;
create policy "Assets select policy"
on public.assets
for select
to authenticated
using (
  public.has_role('employee')
  or public.has_role('admin')
  or (
    public.has_role('lead')
    and (
      public.normalize_department_name(department) = any(coalesce(public.user_managed_departments(), '{}'::text[]))
      or office_location = any(coalesce(public.user_managed_offices(), '{}'::text[]))
      or exists (
        select 1
        from public.asset_assignments aa
        left join public.profiles p on p.id = aa.assigned_to
        where aa.asset_id = assets.id
          and aa.is_current = true
          and (
            public.normalize_department_name(aa.department) = any(coalesce(public.user_managed_departments(), '{}'::text[]))
            or aa.office_location = any(coalesce(public.user_managed_offices(), '{}'::text[]))
            or public.normalize_department_name(p.department) = any(coalesce(public.user_managed_departments(), '{}'::text[]))
          )
      )
    )
  )
);

drop policy if exists "Asset assignments select policy" on public.asset_assignments;
create policy "Asset assignments select policy"
on public.asset_assignments
for select
to authenticated
using (
  assigned_to = auth.uid()
  or public.has_role('admin')
  or (
    public.has_role('lead')
    and (
      public.normalize_department_name(department) = any(coalesce(public.user_managed_departments(), '{}'::text[]))
      or office_location = any(coalesce(public.user_managed_offices(), '{}'::text[]))
      or exists (
        select 1
        from public.profiles p
        where p.id = asset_assignments.assigned_to
          and public.normalize_department_name(p.department) = any(coalesce(public.user_managed_departments(), '{}'::text[]))
      )
    )
  )
);
