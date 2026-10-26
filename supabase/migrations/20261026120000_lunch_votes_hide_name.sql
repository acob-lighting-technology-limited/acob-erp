-- Lets a member of staff keep their lunch vote off the poll their colleagues
-- see. The vote itself is unchanged — it still counts in the tallies, still
-- writes attendance_lunch_log, and admins still see who cast it. Only the
-- name and photo are withheld from everyone else.

alter table public.lunch_votes
  add column if not exists hide_name boolean not null default false;

comment on column public.lunch_votes.hide_name is
  'True when the voter chose to hide their name from colleagues. The vote still counts; the voter and admins can still see it.';

-- The poll was readable by every member of staff by design. A hidden vote is
-- now readable only by its own voter and by admins, so the flag cannot be
-- side-stepped by querying the table directly instead of going through /lunch.
drop policy if exists "lunch_votes_select" on public.lunch_votes;
create policy "lunch_votes_select"
  on public.lunch_votes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lunch_menus m
      where m.id = menu_id and (m.status <> 'draft' or (select public.has_role('admin')))
    )
    and (
      not hide_name
      or user_id = (select auth.uid())
      or (select public.has_role('admin'))
    )
  );

drop policy if exists "lunch_vote_selections_select" on public.lunch_vote_selections;
create policy "lunch_vote_selections_select"
  on public.lunch_vote_selections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lunch_votes v
      join public.lunch_menus m on m.id = v.menu_id
      where v.id = vote_id
        and (m.status <> 'draft' or (select public.has_role('admin')))
        and (
          not v.hide_name
          or v.user_id = (select auth.uid())
          or (select public.has_role('admin'))
        )
    )
  );
