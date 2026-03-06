create or replace function public.prevent_employee_number_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.employee_number is not null and new.employee_number is distinct from old.employee_number then
    raise exception 'Employee number is immutable once set';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_employee_number_mutation on public.profiles;
create trigger trg_profiles_prevent_employee_number_mutation
before update on public.profiles
for each row
execute function public.prevent_employee_number_mutation();

create or replace function public.prevent_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'User deletion is disabled. Suspend or deactivate the employee instead.';
end;
$$;

drop trigger if exists trg_profiles_prevent_delete on public.profiles;
create trigger trg_profiles_prevent_delete
before delete on public.profiles
for each row
execute function public.prevent_profile_delete();
