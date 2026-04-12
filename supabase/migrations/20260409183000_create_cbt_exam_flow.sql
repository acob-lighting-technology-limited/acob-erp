create table if not exists public.cbt_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  employee_number text not null,
  first_name_snapshot text not null,
  company_email text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  total_questions integer not null default 0,
  correct_answers integer,
  score numeric(5,2),
  question_ids uuid[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cbt_questions_active on public.cbt_questions(is_active);
create index if not exists idx_cbt_attempts_profile on public.cbt_attempts(profile_id, created_at desc);

alter table public.cbt_questions enable row level security;
alter table public.cbt_attempts enable row level security;

drop policy if exists "cbt_questions_select_authenticated" on public.cbt_questions;
create policy "cbt_questions_select_authenticated"
on public.cbt_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('developer', 'super_admin', 'admin')
  )
);

drop policy if exists "cbt_questions_manage_authenticated" on public.cbt_questions;
create policy "cbt_questions_manage_authenticated"
on public.cbt_questions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('developer', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('developer', 'super_admin')
  )
);

drop policy if exists "cbt_attempts_select_authenticated" on public.cbt_attempts;
create policy "cbt_attempts_select_authenticated"
on public.cbt_attempts
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) in ('developer', 'super_admin', 'admin')
  )
);

comment on table public.cbt_questions is 'Standalone CBT question bank managed from HR PMS admin.';
comment on table public.cbt_attempts is 'Standalone CBT attempts started from the public /cbt flow.';

notify pgrst, 'reload schema';
