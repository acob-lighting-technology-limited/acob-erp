delete from public.meeting_week_documents
where document_type = 'action_points';

alter table public.meeting_week_documents
  drop constraint if exists meeting_week_documents_type_check;

alter table public.meeting_week_documents
  add constraint meeting_week_documents_type_check
  check (document_type in ('knowledge_sharing_session', 'minutes'));

alter table public.meeting_week_documents
  drop constraint if exists meeting_week_documents_kss_department_check;

alter table public.meeting_week_documents
  add constraint meeting_week_documents_kss_department_check
  check (
    (document_type = 'knowledge_sharing_session' and department is not null)
    or document_type = 'minutes'
  );
