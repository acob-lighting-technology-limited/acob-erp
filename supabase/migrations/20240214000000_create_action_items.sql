
-- Create action_items table
create table if not exists public.action_items (
    id uuid not null default gen_random_uuid(),
    title text not null,
    department text,
    description text,
    status text not null default 'pending' check (status in ('pending', 'not_started', 'in_progress', 'completed')),
    week_number integer not null,
    year integer not null,
    assigned_by uuid references auth.users(id),
    completed_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    constraint action_items_pkey primary key (id)
);

-- Add RLS policies
alter table public.action_items enable row level security;

create policy "Users can view action items for their department"
    on public.action_items for select
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and (
                profiles.department = action_items.department
                or profiles.role in ('admin', 'super_admin', 'lead')
            )
        )
    );

create policy "Admins and leads can insert action items"
    on public.action_items for insert
    with check (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin', 'lead')
        )
    );

create policy "Users can update their own action items or admins/leads"
    on public.action_items for update
    using (
        auth.uid() = assigned_by
        or exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin', 'lead')
        )
    );

create policy "Users can delete action items"
    on public.action_items for delete
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin', 'lead')
        )
    );

-- Add indexes
create index action_items_week_year_idx on public.action_items(week_number, year);
create index action_items_department_idx on public.action_items(department);
