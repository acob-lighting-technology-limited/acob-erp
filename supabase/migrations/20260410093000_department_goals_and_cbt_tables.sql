alter table public.goals_objectives
  add column if not exists department text;

update public.goals_objectives as goal
set department = profile.department
from public.profiles as profile
where goal.user_id = profile.id
  and goal.department is null;

create index if not exists goals_objectives_department_idx
  on public.goals_objectives (department);

create table if not exists public.cbt_questions (
  id uuid primary key default gen_random_uuid(),
  review_cycle_id uuid references public.review_cycles(id) on delete cascade,
  prompt text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cbt_questions_review_cycle_idx
  on public.cbt_questions (review_cycle_id, created_at desc);

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  review_cycle_id uuid references public.review_cycles(id) on delete set null,
  employee_number text,
  first_name_snapshot text,
  company_email text,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  question_ids uuid[] not null default '{}',
  answers jsonb,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  score numeric(5,2) not null default 0,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cbt_attempts_profile_cycle_idx
  on public.cbt_attempts (profile_id, review_cycle_id, created_at desc);
