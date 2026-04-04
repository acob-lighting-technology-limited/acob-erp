create table if not exists public.department_document_metadata (
  id uuid primary key default gen_random_uuid(),
  item_id text not null unique,
  department_name text not null,
  department_key text not null,
  current_path text not null unique,
  item_name text not null,
  is_folder boolean not null default false,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_by_email text,
  created_at timestamptz not null default now(),
  last_modified_by_user_id uuid references public.profiles(id) on delete set null,
  last_modified_by_name text,
  last_modified_by_email text,
  last_modified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_department_document_metadata_department_key
  on public.department_document_metadata (department_key);

create index if not exists idx_department_document_metadata_department_name
  on public.department_document_metadata (department_name);

alter table public.department_document_metadata enable row level security;

drop policy if exists "department_document_metadata_select_scoped" on public.department_document_metadata;
create policy "department_document_metadata_select_scoped"
  on public.department_document_metadata
  for select
  to authenticated
  using (
    public.is_admin_like()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.department = department_name
          or (
            coalesce(p.is_department_lead, false)
            and (
              department_name = p.department
              or department_name = any(coalesce(p.lead_departments, '{}'::text[]))
            )
          )
        )
    )
  );

drop policy if exists "department_document_metadata_mutate_scoped" on public.department_document_metadata;
create policy "department_document_metadata_mutate_scoped"
  on public.department_document_metadata
  for all
  to authenticated
  using (
    public.is_admin_like()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_department_lead, false)
        and (
          department_name = p.department
          or department_name = any(coalesce(p.lead_departments, '{}'::text[]))
        )
    )
  )
  with check (
    public.is_admin_like()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_department_lead, false)
        and (
          department_name = p.department
          or department_name = any(coalesce(p.lead_departments, '{}'::text[]))
        )
    )
  );
