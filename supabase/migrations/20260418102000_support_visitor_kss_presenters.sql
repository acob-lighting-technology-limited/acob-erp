alter table public.kss_weekly_roster
  add column if not exists presenter_name text;

alter table public.meeting_week_documents
  add column if not exists presenter_name text;

update public.kss_weekly_roster r
set presenter_name = p.full_name
from public.profiles p
where r.presenter_id = p.id
  and (r.presenter_name is null or length(trim(r.presenter_name)) = 0);

update public.meeting_week_documents d
set presenter_name = p.full_name
from public.profiles p
where d.presenter_id = p.id
  and (d.presenter_name is null or length(trim(d.presenter_name)) = 0);
