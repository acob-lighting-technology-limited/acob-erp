-- Which "what's new" heads-ups (lib/whats-new.ts) each person has already
-- seen, so each one is shown once per account rather than once per device.
-- The announcements themselves live in code; this only records dismissals.

create table if not exists public.whats_new_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  announcement_id text not null check (char_length(announcement_id) between 1 and 100),
  seen_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

comment on table public.whats_new_seen is
  'One row per person per what''s-new announcement they dismissed. Written only by /api/whats-new/seen (service role).';

alter table public.whats_new_seen enable row level security;

-- Read-your-own only. Writes go through the server route, so authenticated
-- holds no write grant at all.
drop policy if exists "whats_new_seen_select_own" on public.whats_new_seen;
create policy "whats_new_seen_select_own"
  on public.whats_new_seen
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.whats_new_seen from anon, authenticated, public;
grant select on table public.whats_new_seen to authenticated;
grant all on table public.whats_new_seen to service_role;
