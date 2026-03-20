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
  and (
    public.weekly_report_can_mutate(meeting_week_documents.meeting_week, meeting_week_documents.meeting_year)
    or not exists (
      select 1
      from public.meeting_week_documents existing
      where existing.meeting_week = meeting_week_documents.meeting_week
        and existing.meeting_year = meeting_week_documents.meeting_year
        and existing.document_type = meeting_week_documents.document_type
        and coalesce(existing.department, '') = coalesce(meeting_week_documents.department, '')
        and existing.is_current = true
    )
  )
);
