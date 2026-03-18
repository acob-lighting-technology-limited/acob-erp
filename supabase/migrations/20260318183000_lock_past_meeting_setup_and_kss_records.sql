-- Freeze past meeting setup and KSS records once the weekly report grace window closes.

drop policy if exists "Weekly report meeting windows admin manage" on public.weekly_report_meeting_windows;

create policy "Weekly report meeting windows admin manage"
  on public.weekly_report_meeting_windows
  for all
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
    and public.weekly_report_can_mutate(week_number, year)
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
    and public.weekly_report_can_mutate(week_number, year)
  );

drop policy if exists "kss_weekly_roster_insert" on public.kss_weekly_roster;
create policy "kss_weekly_roster_insert"
on public.kss_weekly_roster
for insert
to authenticated
with check (
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
        or (
          p.is_department_lead = true
          and (
            kss_weekly_roster.department = p.department
            or kss_weekly_roster.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
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
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
        or (
          p.is_department_lead = true
          and (
            kss_weekly_roster.department = p.department
            or kss_weekly_roster.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
)
with check (
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
        or (
          p.is_department_lead = true
          and (
            kss_weekly_roster.department = p.department
            or kss_weekly_roster.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
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
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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

drop policy if exists "meeting_week_documents_insert" on public.meeting_week_documents;
create policy "meeting_week_documents_insert"
on public.meeting_week_documents
for insert
to authenticated
with check (
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
        or (
          p.is_department_lead = true
          and meeting_week_documents.document_type = 'knowledge_sharing_session'
          and (
            meeting_week_documents.department = p.department
            or meeting_week_documents.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
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
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
        or (
          p.is_department_lead = true
          and meeting_week_documents.document_type = 'knowledge_sharing_session'
          and (
            meeting_week_documents.department = p.department
            or meeting_week_documents.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
        )
      )
  )
)
with check (
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
        or (
          p.is_department_lead = true
          and meeting_week_documents.document_type = 'knowledge_sharing_session'
          and (
            meeting_week_documents.department = p.department
            or meeting_week_documents.department = any (coalesce(p.lead_departments, array[]::text[]))
          )
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
  public.weekly_report_can_mutate(meeting_week, meeting_year)
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
