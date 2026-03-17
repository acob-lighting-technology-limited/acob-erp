-- Enforce soft-delete behavior for departments and office locations.
-- 1) Hard delete is disallowed.
-- 2) Soft delete (is_active = false) is disallowed when profiles are assigned.

create or replace function public.prevent_department_hard_delete_or_invalid_soft_delete()
returns trigger
language plpgsql
as $$
declare
  assigned_count integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'Hard delete is disabled for departments. Use is_active=false instead.';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.is_active, true) = true
     and coalesce(new.is_active, true) = false then
    select count(*)
      into assigned_count
    from public.profiles p
    where p.department = old.name;

    if assigned_count > 0 then
      raise exception 'Cannot deactivate department "%" while % profile(s) are assigned.', old.name, assigned_count;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_department_delete_or_invalid_soft_delete on public.departments;
create trigger trg_prevent_department_delete_or_invalid_soft_delete
before update or delete on public.departments
for each row
execute function public.prevent_department_hard_delete_or_invalid_soft_delete();

create or replace function public.prevent_office_location_hard_delete_or_invalid_soft_delete()
returns trigger
language plpgsql
as $$
declare
  assigned_count integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'Hard delete is disabled for office locations. Use is_active=false instead.';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.is_active, true) = true
     and coalesce(new.is_active, true) = false then
    select count(*)
      into assigned_count
    from public.profiles p
    where p.office_location = old.name;

    if assigned_count > 0 then
      raise exception 'Cannot deactivate office location "%" while % profile(s) are assigned.', old.name, assigned_count;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_office_location_delete_or_invalid_soft_delete on public.office_locations;
create trigger trg_prevent_office_location_delete_or_invalid_soft_delete
before update or delete on public.office_locations
for each row
execute function public.prevent_office_location_hard_delete_or_invalid_soft_delete();;
