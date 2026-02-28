-- Harden project access to prevent unscoped read/write.
-- Inventory/purchasing table hardening is pending until those tables exist in DB.

create or replace function public.is_admin_like()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_project_member(project_uuid uuid, user_uuid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_uuid
      and pm.user_id = user_uuid
      and coalesce(pm.is_active, true)
  );
$$;

create or replace function public.can_manage_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_like()
    or exists (
      select 1
      from public.projects p
      where p.id = project_uuid
        and (
          p.created_by = auth.uid()
          or p.project_manager_id = auth.uid()
          or public.is_project_member(project_uuid, auth.uid())
        )
    );
$$;

create or replace function public.can_admin_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_like()
    or exists (
      select 1
      from public.projects p
      where p.id = project_uuid
        and (
          p.created_by = auth.uid()
          or p.project_manager_id = auth.uid()
        )
    );
$$;

grant execute on function public.is_admin_like() to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;
grant execute on function public.can_admin_project(uuid) to authenticated;

drop policy if exists "Projects management policy" on public.projects;
drop policy if exists "Projects select scoped" on public.projects;
drop policy if exists "Projects insert scoped" on public.projects;
drop policy if exists "Projects update scoped" on public.projects;
drop policy if exists "Projects delete scoped" on public.projects;

create policy "Projects select scoped"
on public.projects
for select
to authenticated
using (
  public.is_admin_like()
  or created_by = auth.uid()
  or project_manager_id = auth.uid()
  or public.is_project_member(id, auth.uid())
);

create policy "Projects insert scoped"
on public.projects
for insert
to authenticated
with check (
  public.is_admin_like()
  or created_by = auth.uid()
  or project_manager_id = auth.uid()
);

create policy "Projects update scoped"
on public.projects
for update
to authenticated
using (
  public.can_manage_project(id)
)
with check (
  public.can_manage_project(id)
);

create policy "Projects delete scoped"
on public.projects
for delete
to authenticated
using (
  public.can_admin_project(id)
);

drop policy if exists "Project members select policy" on public.project_members;
drop policy if exists "Project members insert policy" on public.project_members;
drop policy if exists "Project members update policy" on public.project_members;
drop policy if exists "Project members delete policy" on public.project_members;

create policy "Project members select scoped"
on public.project_members
for select
to authenticated
using (
  public.can_manage_project(project_id)
);

create policy "Project members insert scoped"
on public.project_members
for insert
to authenticated
with check (
  public.can_admin_project(project_id)
);

create policy "Project members update scoped"
on public.project_members
for update
to authenticated
using (
  public.can_admin_project(project_id)
)
with check (
  public.can_admin_project(project_id)
);

create policy "Project members delete scoped"
on public.project_members
for delete
to authenticated
using (
  public.can_admin_project(project_id)
);

drop policy if exists "Project items select policy" on public.project_items;
drop policy if exists "Project items insert policy" on public.project_items;
drop policy if exists "Project items update policy" on public.project_items;
drop policy if exists "Project items delete policy" on public.project_items;

create policy "Project items select scoped"
on public.project_items
for select
to authenticated
using (
  public.can_manage_project(project_id)
);

create policy "Project items insert scoped"
on public.project_items
for insert
to authenticated
with check (
  public.can_manage_project(project_id)
);

create policy "Project items update scoped"
on public.project_items
for update
to authenticated
using (
  public.can_manage_project(project_id)
)
with check (
  public.can_manage_project(project_id)
);

create policy "Project items delete scoped"
on public.project_items
for delete
to authenticated
using (
  public.can_admin_project(project_id)
);
