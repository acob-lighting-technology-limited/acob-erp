create or replace function public.meeting_document_slot_is_empty(
  p_meeting_week integer,
  p_meeting_year integer,
  p_document_type text,
  p_department text
)
returns boolean
language sql
security definer
set search_path = public
as $function$
  select not exists (
    select 1
    from public.meeting_week_documents existing
    where existing.meeting_week = p_meeting_week
      and existing.meeting_year = p_meeting_year
      and existing.document_type = p_document_type
      and coalesce(existing.department, '') = coalesce(p_department, '')
      and existing.is_current = true
  );
$function$;

revoke all on function public.meeting_document_slot_is_empty(integer, integer, text, text) from public;
grant execute on function public.meeting_document_slot_is_empty(integer, integer, text, text) to authenticated, service_role;

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
    or public.meeting_document_slot_is_empty(
      meeting_week_documents.meeting_week,
      meeting_week_documents.meeting_year,
      meeting_week_documents.document_type,
      meeting_week_documents.department
    )
  )
);
