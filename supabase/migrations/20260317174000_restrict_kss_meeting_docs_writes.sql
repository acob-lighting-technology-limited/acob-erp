-- Restrict KSS + meeting documents writes to reports admins only.

drop policy if exists "kss_weekly_roster_insert" on public.kss_weekly_roster;
create policy "kss_weekly_roster_insert"
on public.kss_weekly_roster
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "kss_weekly_roster_update" on public.kss_weekly_roster;
create policy "kss_weekly_roster_update"
on public.kss_weekly_roster
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "kss_weekly_roster_delete" on public.kss_weekly_roster;
create policy "kss_weekly_roster_delete"
on public.kss_weekly_roster
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "meeting_week_documents_insert" on public.meeting_week_documents;
create policy "meeting_week_documents_insert"
on public.meeting_week_documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "meeting_week_documents_update" on public.meeting_week_documents;
create policy "meeting_week_documents_update"
on public.meeting_week_documents
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "meeting_week_documents_delete" on public.meeting_week_documents;
create policy "meeting_week_documents_delete"
on public.meeting_week_documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "Meeting documents insert" on storage.objects;
create policy "Meeting documents insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'meeting_documents'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "Meeting documents update" on storage.objects;
create policy "Meeting documents update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'meeting_documents'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
)
with check (
  bucket_id = 'meeting_documents'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);

drop policy if exists "Meeting documents delete" on storage.objects;
create policy "Meeting documents delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'meeting_documents'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(trim(p.role::text)) in ('developer', 'super_admin')
        or (
          lower(trim(p.role::text)) = 'admin'
          and (p.admin_domains is null or 'reports' = any (p.admin_domains))
        )
      )
  )
);
