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
          coalesce(p.is_department_lead, false) = true
          and (
            p_department = any(coalesce(p.lead_departments, '{}'::text[]))
            or coalesce(p.department, '') = p_department
          )
        )
      )
  );
$$;;
