-- ---------------------------------------------------------------------------
-- Wrap auth.uid() / auth.role() in a scalar subquery inside every RLS policy.
--
-- Postgres re-evaluates a volatile-looking function call once PER ROW inside a
-- policy predicate. Wrapping it as (select auth.uid()) turns it into an
-- InitPlan the planner evaluates ONCE per statement, so a policy stops costing
-- O(rows) function calls. Supabase's own linter flags the unwrapped form as
-- `auth_rls_initplan`; it reported 119 instances across 166 tables.
--
-- 234 policies are rewritten here. The predicates are otherwise UNCHANGED:
-- this is the same boolean expression with the auth call hoisted, so no
-- policy becomes more or less permissive. Generated from pg_policies and
-- verified to contain no bare auth.uid()/auth.role() and no double wrapping.
--
-- ALTER POLICY is used rather than DROP + CREATE deliberately. DROP would
-- leave a window, however brief, in which the table has one fewer policy —
-- on a permissive-policy table that means a window of wider access.
-- ---------------------------------------------------------------------------

ALTER POLICY "Authenticated users can write own acobot logs" ON public.acobot_logs
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND ((select auth.uid()) = user_id)));

ALTER POLICY "Leads and admins can manage action item assignees" ON public.action_item_assignees
  USING ((EXISTS ( SELECT 1
   FROM (profiles p
     LEFT JOIN action_items ai ON ((ai.id = action_item_assignees.action_item_id)))
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR ((p.is_department_lead = true) AND ((ai.department = p.department) OR (ai.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (profiles p
     LEFT JOIN action_items ai ON ((ai.id = action_item_assignees.action_item_id)))
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR ((p.is_department_lead = true) AND ((ai.department = p.department) OR (ai.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Leads and admins can add action item evidence" ON public.action_item_evidence
  WITH CHECK (((uploaded_by = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM (profiles p
     LEFT JOIN action_items ai ON ((ai.id = action_item_evidence.action_item_id)))
  WHERE ((p.id = ( SELECT (select auth.uid()) AS uid)) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR ((p.is_department_lead = true) AND ((ai.department = p.department) OR (ai.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))));

ALTER POLICY "Uploader or admin can remove action item evidence" ON public.action_item_evidence
  USING (((uploaded_by = ( SELECT (select auth.uid()) AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT (select auth.uid()) AS uid)) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])))))));

ALTER POLICY "Admins and leads can insert action items" ON public.action_items
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND ((action_items.department = p.department) OR (action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Users can delete action items" ON public.action_items
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND ((action_items.department = p.department) OR (action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Users can insert action items" ON public.action_items
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((action_items.department = p.department) OR (action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Users can update own dept action items" ON public.action_items
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((action_items.department = p.department) OR (action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((action_items.department = p.department) OR (action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Users can update their own action items or admins/leads" ON public.action_items
  USING (((( SELECT (select auth.uid()) AS uid) = assigned_by) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT (select auth.uid()) AS uid)) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text]))) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND ((action_items.department = p.department) OR (action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Applications insert policy" ON public.applications
  WITH CHECK ((( SELECT (select auth.uid()) AS uid) IS NOT NULL));

ALTER POLICY "Asset assignments select policy" ON public.asset_assignments
  USING (((assigned_to = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = asset_assignments.assigned_to) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Asset issues insert policy" ON public.asset_issues
  WITH CHECK ((( SELECT (select auth.uid()) AS uid) IS NOT NULL));

ALTER POLICY "Asset issues select policy" ON public.asset_issues
  USING (((created_by = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = asset_issues.created_by) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Asset issues update policy" ON public.asset_issues
  USING (((created_by = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Assets select policy" ON public.assets
  USING (((deleted_at IS NULL) AND (( SELECT has_role('staff'::text) AS has_role) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (department = ( SELECT profiles.department
   FROM profiles
  WHERE (profiles.id = ( SELECT (select auth.uid()) AS uid))
 LIMIT 1))))));

ALTER POLICY employees_insert_own_appeals ON public.attendance_appeals
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY employees_select_own_appeals ON public.attendance_appeals
  USING ((user_id = (select auth.uid())));

ALTER POLICY employees_select_own_attendance_events ON public.attendance_events
  USING ((user_id = (select auth.uid())));

ALTER POLICY attendance_exempt_periods_manage ON public.attendance_exempt_periods
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY attendance_exempt_periods_select ON public.attendance_exempt_periods
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])))))));

ALTER POLICY "Lunch select policy" ON public.attendance_lunch_log
  USING (((user_id = (select auth.uid())) OR has_role('admin'::text)));

ALTER POLICY attendance_oos_periods_manage ON public.attendance_oos_periods
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY attendance_oos_periods_select ON public.attendance_oos_periods
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])))))));

ALTER POLICY "Attendance select policy" ON public.attendance_records
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = attendance_records.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Users can clock in" ON public.attendance_records
  WITH CHECK ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Users can clock out" ON public.attendance_records
  USING (((( SELECT (select auth.uid()) AS uid) = user_id) AND (clock_out IS NULL)))
  WITH CHECK ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Audit logs insert policy" ON public.audit_logs
  WITH CHECK (((( SELECT (select auth.uid()) AS uid) IS NOT NULL) AND ((user_id IS NULL) OR (user_id = ( SELECT (select auth.uid()) AS uid)))));

ALTER POLICY "Audit logs select policy" ON public.audit_logs
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND (((audit_logs.department IS NOT NULL) AND (audit_logs.department = ANY (
        CASE
            WHEN (COALESCE(array_length(p.lead_departments, 1), 0) > 0) THEN p.lead_departments
            WHEN (p.department IS NOT NULL) THEN ARRAY[p.department]
            ELSE ARRAY[]::text[]
        END))) OR (EXISTS ( SELECT 1
           FROM profiles actor
          WHERE ((actor.id = audit_logs.user_id) AND (actor.department = ANY (
                CASE
                    WHEN (COALESCE(array_length(p.lead_departments, 1), 0) > 0) THEN p.lead_departments
                    WHEN (p.department IS NOT NULL) THEN ARRAY[p.department]
                    ELSE ARRAY[]::text[]
                END))))))))))));

ALTER POLICY cbt_attempts_select_authenticated ON public.cbt_attempts
  USING (((profile_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])))))));

ALTER POLICY cbt_questions_manage_authenticated ON public.cbt_questions
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text]))))));

ALTER POLICY cbt_questions_select_authenticated ON public.cbt_questions
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY competency_frameworks_admin_write ON public.competency_frameworks
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['developer'::user_role, 'admin'::user_role, 'super_admin'::user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['developer'::user_role, 'admin'::user_role, 'super_admin'::user_role]))))));

ALTER POLICY "Controlled document acknowledgements insert own" ON public.controlled_document_acknowledgements
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM controlled_documents d
  WHERE ((d.id = controlled_document_acknowledgements.document_id) AND (d.current_version_id = controlled_document_acknowledgements.version_id) AND (d.status = 'published'::text) AND (d.doc_type = 'policy'::text))))));

ALTER POLICY "Controlled document acknowledgements select own or admin" ON public.controlled_document_acknowledgements
  USING (((user_id = (select auth.uid())) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Controlled documents select visible" ON public.controlled_documents
  USING ((( SELECT has_role('admin'::text) AS has_role) OR ((status = 'published'::text) AND ((doc_type = 'policy'::text) OR is_company_wide OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.department = ANY (controlled_documents.departments))))))) OR ((doc_type = 'sop'::text) AND (owner_department IS NOT NULL) AND ( SELECT is_lead_for_department(controlled_documents.owner_department) AS is_lead_for_department))));

ALTER POLICY correspondence_approvals_select ON public.correspondence_approvals
  USING ((EXISTS ( SELECT 1
   FROM correspondence_records r
  WHERE ((r.id = correspondence_approvals.correspondence_id) AND ((r.originator_id = (select auth.uid())) OR (r.responsible_officer_id = (select auth.uid())) OR correspondence_is_admin() OR ((r.department_name IS NOT NULL) AND correspondence_is_lead_for_department(r.department_name)) OR ((r.assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(r.assigned_department_name)))))));

ALTER POLICY correspondence_approvals_update ON public.correspondence_approvals
  USING (((approver_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin()))
  WITH CHECK (((approver_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin()));

ALTER POLICY "Authenticated can insert correspondence categories" ON public.correspondence_categories
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Authenticated can read correspondence categories" ON public.correspondence_categories
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY correspondence_counters_manage_service ON public.correspondence_counters
  USING ((((select auth.role()) = 'service_role'::text) OR correspondence_is_admin()))
  WITH CHECK ((((select auth.role()) = 'service_role'::text) OR correspondence_is_admin()));

ALTER POLICY correspondence_department_codes_select ON public.correspondence_department_codes
  USING ((( SELECT (select auth.uid()) AS uid) IS NOT NULL));

ALTER POLICY correspondence_events_insert ON public.correspondence_events
  WITH CHECK (((actor_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin()));

ALTER POLICY correspondence_events_select ON public.correspondence_events
  USING ((EXISTS ( SELECT 1
   FROM correspondence_records r
  WHERE ((r.id = correspondence_events.correspondence_id) AND ((r.originator_id = (select auth.uid())) OR (r.responsible_officer_id = (select auth.uid())) OR correspondence_is_admin() OR ((r.department_name IS NOT NULL) AND correspondence_is_lead_for_department(r.department_name)) OR ((r.assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(r.assigned_department_name)))))));

ALTER POLICY correspondence_records_insert ON public.correspondence_records
  WITH CHECK (((( SELECT (select auth.uid()) AS uid) IS NOT NULL) AND ((originator_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin())));

ALTER POLICY correspondence_records_select ON public.correspondence_records
  USING (((originator_id = ( SELECT (select auth.uid()) AS uid)) OR (responsible_officer_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin() OR ((department_name IS NOT NULL) AND correspondence_is_lead_for_department(department_name)) OR ((assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(assigned_department_name))));

ALTER POLICY correspondence_records_update ON public.correspondence_records
  USING (((originator_id = ( SELECT (select auth.uid()) AS uid)) OR (responsible_officer_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin() OR ((department_name IS NOT NULL) AND correspondence_is_lead_for_department(department_name)) OR ((assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(assigned_department_name))))
  WITH CHECK (((originator_id = ( SELECT (select auth.uid()) AS uid)) OR (responsible_officer_id = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin() OR ((department_name IS NOT NULL) AND correspondence_is_lead_for_department(department_name)) OR ((assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(assigned_department_name))));

ALTER POLICY correspondence_versions_insert ON public.correspondence_versions
  WITH CHECK (((uploaded_by = ( SELECT (select auth.uid()) AS uid)) OR correspondence_is_admin()));

ALTER POLICY correspondence_versions_select ON public.correspondence_versions
  USING ((EXISTS ( SELECT 1
   FROM correspondence_records r
  WHERE ((r.id = correspondence_versions.correspondence_id) AND ((r.originator_id = (select auth.uid())) OR (r.responsible_officer_id = (select auth.uid())) OR correspondence_is_admin() OR ((r.department_name IS NOT NULL) AND correspondence_is_lead_for_department(r.department_name)) OR ((r.assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(r.assigned_department_name)))))));

ALTER POLICY "Manage own daily report tasks" ON public.daily_report_tasks
  USING ((EXISTS ( SELECT 1
   FROM daily_reports r
  WHERE ((r.id = daily_report_tasks.report_id) AND (r.user_id = ( SELECT (select auth.uid()) AS uid)) AND (r.acknowledged_at IS NULL)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM daily_reports r
  WHERE ((r.id = daily_report_tasks.report_id) AND (r.user_id = ( SELECT (select auth.uid()) AS uid))))));

ALTER POLICY "View daily report tasks via parent" ON public.daily_report_tasks
  USING ((EXISTS ( SELECT 1
   FROM daily_reports r
  WHERE ((r.id = daily_report_tasks.report_id) AND ((r.user_id = ( SELECT (select auth.uid()) AS uid)) OR (EXISTS ( SELECT 1
           FROM (profiles p1
             JOIN profiles p2 ON ((p2.id = r.user_id)))
          WHERE ((p1.id = ( SELECT (select auth.uid()) AS uid)) AND ((p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role])) OR ((p1.is_department_lead = true) AND (p1.department_id = p2.department_id) AND (p1.department_id IS NOT NULL)))))))))));

ALTER POLICY "Admins and leads can acknowledge daily reports" ON public.daily_reports
  USING ((EXISTS ( SELECT 1
   FROM (profiles p1
     JOIN profiles p2 ON ((p2.id = daily_reports.user_id)))
  WHERE ((p1.id = ( SELECT (select auth.uid()) AS uid)) AND ((p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role])) OR ((p1.is_department_lead = true) AND (p1.department_id = p2.department_id) AND (p1.department_id IS NOT NULL)))))));

ALTER POLICY "Admins can view all daily reports" ON public.daily_reports
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT (select auth.uid()) AS uid)) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role]))))));

ALTER POLICY "Department leads can view department daily reports" ON public.daily_reports
  USING ((EXISTS ( SELECT 1
   FROM (profiles p1
     JOIN profiles p2 ON ((p2.id = daily_reports.user_id)))
  WHERE ((p1.id = ( SELECT (select auth.uid()) AS uid)) AND (p1.is_department_lead = true) AND (p1.department_id = p2.department_id) AND (p1.department_id IS NOT NULL)))));

ALTER POLICY "Users can create own daily reports" ON public.daily_reports
  WITH CHECK ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Users can delete own daily reports" ON public.daily_reports
  USING ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Users can update own unacknowledged daily reports" ON public.daily_reports
  USING (((( SELECT (select auth.uid()) AS uid) = user_id) AND (acknowledged_at IS NULL)))
  WITH CHECK ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Users can view own daily reports" ON public.daily_reports
  USING ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY department_document_metadata_mutate_scoped ON public.department_document_metadata
  USING ((is_admin_like() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND COALESCE(p.is_department_lead, false) AND ((department_document_metadata.department_name = p.department) OR (department_document_metadata.department_name = ANY (COALESCE(p.lead_departments, '{}'::text[])))))))))
  WITH CHECK ((is_admin_like() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND COALESCE(p.is_department_lead, false) AND ((department_document_metadata.department_name = p.department) OR (department_document_metadata.department_name = ANY (COALESCE(p.lead_departments, '{}'::text[])))))))));

ALTER POLICY department_document_metadata_select_scoped ON public.department_document_metadata
  USING ((is_admin_like() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.department = department_document_metadata.department_name) OR (COALESCE(p.is_department_lead, false) AND ((department_document_metadata.department_name = p.department) OR (department_document_metadata.department_name = ANY (COALESCE(p.lead_departments, '{}'::text[])))))))))));

ALTER POLICY "Department payments delete policy" ON public.department_payments
  USING (((created_by = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Department payments insert policy" ON public.department_payments
  WITH CHECK ((has_role('admin'::text) OR (has_role('lead'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.department_id = department_payments.department_id)))))));

ALTER POLICY "Department payments select policy" ON public.department_payments
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles p1
  WHERE ((p1.id = ( SELECT (select auth.uid()) AS uid)) AND (p1.department_id = department_payments.department_id)))))));

ALTER POLICY "Department payments update policy" ON public.department_payments
  USING ((has_role('admin'::text) OR (has_role('lead'::text) AND (created_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.department_id = department_payments.department_id)))))))
  WITH CHECK ((has_role('admin'::text) OR (has_role('lead'::text) AND (created_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.department_id = department_payments.department_id)))))));

ALTER POLICY "Departments delete policy" ON public.departments
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT (profiles.role)::text AS role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY "Departments insert policy" ON public.departments
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT (profiles.role)::text AS role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY "Departments update policy" ON public.departments
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT (profiles.role)::text AS role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY "Authenticated users can write own dev login logs" ON public.dev_login_logs
  WITH CHECK (((( SELECT (select auth.uid()) AS uid) IS NOT NULL) AND (( SELECT (select auth.uid()) AS uid) = user_id)));

ALTER POLICY admins_all_plan_actions ON public.development_plan_actions
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['developer'::user_role, 'admin'::user_role, 'super_admin'::user_role]))))));

ALTER POLICY read_own_plan_actions ON public.development_plan_actions
  USING ((EXISTS ( SELECT 1
   FROM development_plans dp
  WHERE ((dp.id = development_plan_actions.plan_id) AND (dp.user_id = (select auth.uid()))))));

ALTER POLICY admins_all_plans ON public.development_plans
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['developer'::user_role, 'admin'::user_role, 'super_admin'::user_role]))))));

ALTER POLICY employees_read_own_plans ON public.development_plans
  USING (((select auth.uid()) = user_id));

ALTER POLICY leads_read_dept_plans ON public.development_plans
  USING ((EXISTS ( SELECT 1
   FROM (profiles actor
     JOIN profiles subject ON ((subject.id = development_plans.user_id)))
  WHERE ((actor.id = (select auth.uid())) AND (actor.is_department_lead = true) AND ((actor.department = subject.department) OR (subject.department = ANY (actor.lead_departments)))))));

ALTER POLICY "Life events insert policy" ON public.employee_life_events
  WITH CHECK (((employee_id = (select auth.uid())) OR has_role('admin'::text)));

ALTER POLICY "Life events select policy" ON public.employee_life_events
  USING (((employee_id = (select auth.uid())) OR has_role('admin'::text)));

ALTER POLICY "Life events update policy" ON public.employee_life_events
  USING (((employee_id = (select auth.uid())) OR has_role('admin'::text)))
  WITH CHECK (((employee_id = (select auth.uid())) OR has_role('admin'::text)));

ALTER POLICY "Employee salaries select policy" ON public.employee_salaries
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR has_role('admin'::text)));

ALTER POLICY "Employee suspensions select policy" ON public.employee_suspensions
  USING (((employee_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Event attendees select visible" ON public.event_attendees
  USING (((profile_id = ( SELECT (select auth.uid()) AS uid)) OR can_view_event(event_id)));

ALTER POLICY "Event attendees update" ON public.event_attendees
  USING (((profile_id = ( SELECT (select auth.uid()) AS uid)) OR can_manage_event(event_id)))
  WITH CHECK (((profile_id = ( SELECT (select auth.uid()) AS uid)) OR can_manage_event(event_id)));

ALTER POLICY "Events staff acknowledge" ON public.event_notifications
  USING ((( SELECT has_role('staff'::text) AS has_role) AND (acknowledged = false)))
  WITH CHECK (((acknowledged = true) AND (acknowledged_by = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY "Events update policy" ON public.event_notifications
  USING ((( SELECT has_role('admin'::text) AS has_role) OR ( SELECT has_role('staff'::text) AS has_role)))
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR ((acknowledged = true) AND (acknowledged_by = ( SELECT (select auth.uid()) AS uid)))));

ALTER POLICY "Events insert by creators" ON public.events
  WITH CHECK (((created_by = ( SELECT (select auth.uid()) AS uid)) AND can_create_events()));

ALTER POLICY "Events select visible" ON public.events
  USING (((created_by = ( SELECT (select auth.uid()) AS uid)) OR (organizer_id = ( SELECT (select auth.uid()) AS uid)) OR can_view_event(id)));

ALTER POLICY "Admins can view all feedback" ON public.feedback
  USING ((((target_lead_id IS NULL) OR (target_lead_id <> (select auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND ((profiles.is_admin = true) OR (profiles.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role]))))))));

ALTER POLICY "Feedback delete policy" ON public.feedback
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR has_role('admin'::text)));

ALTER POLICY "Feedback insert policy" ON public.feedback
  WITH CHECK (((user_id = ( SELECT (select auth.uid()) AS uid)) OR has_role('admin'::text)));

ALTER POLICY "Feedback update policy" ON public.feedback
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR has_role('admin'::text)));

ALTER POLICY "Feedback view policy" ON public.feedback
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR has_role('admin'::text)));

ALTER POLICY "Leads can view dept team feedback" ON public.feedback
  USING ((EXISTS ( SELECT 1
   FROM (profiles lead
     JOIN profiles subject ON ((subject.id = feedback.user_id)))
  WHERE ((lead.id = (select auth.uid())) AND (lead.is_department_lead = true) AND ((subject.department = lead.department) OR (subject.department = ANY (COALESCE(lead.lead_departments, ARRAY[]::text[]))))))));

ALTER POLICY "Fleet attachments create" ON public.fleet_booking_attachments
  WITH CHECK (((uploaded_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM fleet_bookings b
  WHERE ((b.id = fleet_booking_attachments.booking_id) AND (b.requester_id = (select auth.uid())))))));

ALTER POLICY "Fleet attachments read" ON public.fleet_booking_attachments
  USING ((EXISTS ( SELECT 1
   FROM fleet_bookings b
  WHERE ((b.id = fleet_booking_attachments.booking_id) AND ((b.requester_id = (select auth.uid())) OR has_role('admin'::text) OR has_role('super_admin'::text))))));

ALTER POLICY "Fleet bookings create" ON public.fleet_bookings
  WITH CHECK (((requester_id = (select auth.uid())) AND (status = 'pending'::text)));

ALTER POLICY "Fleet bookings read" ON public.fleet_bookings
  USING (((requester_id = (select auth.uid())) OR has_role('admin'::text) OR has_role('super_admin'::text)));

ALTER POLICY "Fleet bookings update" ON public.fleet_bookings
  USING (((requester_id = (select auth.uid())) OR has_role('admin'::text) OR has_role('super_admin'::text)))
  WITH CHECK (((requester_id = (select auth.uid())) OR has_role('admin'::text) OR has_role('super_admin'::text)));

ALTER POLICY "Goals insert policy" ON public.goals_objectives
  WITH CHECK (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = goals_objectives.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Goals select policy" ON public.goals_objectives
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = goals_objectives.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Goals update policy" ON public.goals_objectives
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Managers can approve department goals" ON public.goals_objectives
  USING ((EXISTS ( SELECT 1
   FROM (profiles p1
     JOIN profiles p2 ON ((p2.id = goals_objectives.user_id)))
  WHERE ((p1.id = (select auth.uid())) AND ((p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'developer'::user_role])) OR ((p1.is_department_lead = true) AND (p1.department = p2.department)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (profiles p1
     JOIN profiles p2 ON ((p2.id = goals_objectives.user_id)))
  WHERE ((p1.id = (select auth.uid())) AND ((p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'developer'::user_role])) OR ((p1.is_department_lead = true) AND (p1.department = p2.department)))))));

ALTER POLICY help_desk_approvals_select ON public.help_desk_approvals
  USING ((EXISTS ( SELECT 1
   FROM help_desk_tickets t
  WHERE ((t.id = help_desk_approvals.ticket_id) AND ((t.requester_id = (select auth.uid())) OR (t.assigned_to = (select auth.uid())) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department))))));

ALTER POLICY help_desk_approvals_update ON public.help_desk_approvals
  USING (((approver_id = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin()))
  WITH CHECK (((approver_id = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin()));

ALTER POLICY help_desk_attachments_delete_own ON public.help_desk_attachments
  USING ((uploaded_by = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY help_desk_attachments_insert_own ON public.help_desk_attachments
  WITH CHECK ((uploaded_by = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY help_desk_attachments_select ON public.help_desk_attachments
  USING ((EXISTS ( SELECT 1
   FROM (help_desk_tickets t
     LEFT JOIN profiles me ON ((me.id = ( SELECT (select auth.uid()) AS uid))))
  WHERE ((t.id = help_desk_attachments.ticket_id) AND ((t.requester_id = ( SELECT (select auth.uid()) AS uid)) OR (t.created_by = ( SELECT (select auth.uid()) AS uid)) OR (t.assigned_to = ( SELECT (select auth.uid()) AS uid)) OR ((me.is_department_lead = true) AND ((t.service_department = me.department) OR (t.requester_department = me.department) OR (t.service_department = ANY (COALESCE(me.lead_departments, ARRAY[]::text[]))) OR (t.requester_department = ANY (COALESCE(me.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY help_desk_categories_select ON public.help_desk_categories
  USING ((( SELECT (select auth.uid()) AS uid) IS NOT NULL));

ALTER POLICY help_desk_comments_insert ON public.help_desk_comments
  WITH CHECK (((author_id = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM help_desk_tickets t
  WHERE ((t.id = help_desk_comments.ticket_id) AND ((t.requester_id = ( SELECT (select auth.uid()) AS uid)) OR (t.assigned_to = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department)))))));

ALTER POLICY help_desk_comments_select ON public.help_desk_comments
  USING ((EXISTS ( SELECT 1
   FROM help_desk_tickets t
  WHERE ((t.id = help_desk_comments.ticket_id) AND ((t.requester_id = (select auth.uid())) OR (t.assigned_to = (select auth.uid())) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department))))));

ALTER POLICY help_desk_events_insert ON public.help_desk_events
  WITH CHECK (((actor_id = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM help_desk_tickets t
  WHERE ((t.id = help_desk_events.ticket_id) AND ((t.requester_id = ( SELECT (select auth.uid()) AS uid)) OR (t.assigned_to = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department)))))));

ALTER POLICY help_desk_events_select ON public.help_desk_events
  USING ((EXISTS ( SELECT 1
   FROM help_desk_tickets t
  WHERE ((t.id = help_desk_events.ticket_id) AND ((t.requester_id = (select auth.uid())) OR (t.assigned_to = (select auth.uid())) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department))))));

ALTER POLICY help_desk_tickets_insert ON public.help_desk_tickets
  WITH CHECK (((( SELECT (select auth.uid()) AS uid) IS NOT NULL) AND (created_by = ( SELECT (select auth.uid()) AS uid)) AND (requester_id = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY help_desk_tickets_select ON public.help_desk_tickets
  USING (((requester_id = ( SELECT (select auth.uid()) AS uid)) OR (assigned_to = ( SELECT (select auth.uid()) AS uid)) OR (created_by = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin() OR help_desk_is_lead_for_department(service_department)));

ALTER POLICY help_desk_tickets_update ON public.help_desk_tickets
  USING (((assigned_to = ( SELECT (select auth.uid()) AS uid)) OR (requester_id = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin() OR help_desk_is_lead_for_department(service_department)))
  WITH CHECK (((assigned_to = ( SELECT (select auth.uid()) AS uid)) OR (requester_id = ( SELECT (select auth.uid()) AS uid)) OR help_desk_is_admin() OR help_desk_is_lead_for_department(service_department)));

ALTER POLICY "service role can manage idempotency keys" ON public.idempotency_keys
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));

ALTER POLICY "Implementation plans select scoped" ON public.implementation_plans
  USING ((is_admin_like() OR ( SELECT has_role('lead'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = implementation_plans.project_id) AND ((p.created_by = (select auth.uid())) OR (p.project_manager_id = (select auth.uid())) OR is_project_member(p.id, (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM tasks t
  WHERE ((t.plan_id = implementation_plans.id) AND (t.assigned_to = (select auth.uid())))))));

ALTER POLICY "Interviews select policy" ON public.interviews
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (interviewer_id = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY "Interviews update policy" ON public.interviews
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (interviewer_id = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY "super_admin/admin can view known devices" ON public.known_devices
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role]))))));

ALTER POLICY "KPI actuals write scoped" ON public.kpi_actuals
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_department_lead AND ((p.department = kpi_actuals.department) OR (kpi_actuals.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_department_lead AND ((p.department = kpi_actuals.department) OR (kpi_actuals.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))));

ALTER POLICY "KPI assignments write scoped" ON public.kpi_assignments
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_department_lead AND ((p.department = kpi_assignments.department) OR (kpi_assignments.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND p.is_department_lead AND ((p.department = kpi_assignments.department) OR (kpi_assignments.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))));

ALTER POLICY kss_heads_up_log_select ON public.kss_heads_up_log
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY kss_results_insert ON public.kss_results
  WITH CHECK ((evaluator_id = (select auth.uid())));

ALTER POLICY kss_results_select ON public.kss_results
  USING (((presenter_id = (select auth.uid())) OR (evaluator_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])))))));

ALTER POLICY kss_results_update ON public.kss_results
  USING ((evaluator_id = (select auth.uid())));

ALTER POLICY kss_rotation_skips_select ON public.kss_rotation_skips
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY kss_weekly_roster_delete ON public.kss_weekly_roster
  USING ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains))))))))));

ALTER POLICY kss_weekly_roster_insert ON public.kss_weekly_roster
  WITH CHECK ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND ((kss_weekly_roster.department = p.department) OR (kss_weekly_roster.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))));

ALTER POLICY kss_weekly_roster_select ON public.kss_weekly_roster
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR (p.is_department_lead = true))))));

ALTER POLICY kss_weekly_roster_update ON public.kss_weekly_roster
  USING ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND ((kss_weekly_roster.department = p.department) OR (kss_weekly_roster.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))))
  WITH CHECK ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND ((kss_weekly_roster.department = p.department) OR (kss_weekly_roster.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))));

ALTER POLICY "Leave approvals approver insert policy" ON public.leave_approvals
  WITH CHECK (((approver_id = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM leave_requests lr
  WHERE ((lr.id = leave_approvals.leave_request_id) AND (lr.current_approver_user_id = ( SELECT (select auth.uid()) AS uid)) AND ((lr.status)::text = ANY ((ARRAY['pending'::character varying, 'pending_evidence'::character varying])::text[])))))));

ALTER POLICY "Leave approvals select policy" ON public.leave_approvals
  USING (((approver_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = leave_approvals.approver_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid)))))))) OR (EXISTS ( SELECT 1
   FROM leave_requests
  WHERE ((leave_requests.id = leave_approvals.leave_request_id) AND (leave_requests.user_id = ( SELECT (select auth.uid()) AS uid)))))));

ALTER POLICY "Leave balances select policy" ON public.leave_balances
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = leave_balances.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Leave evidence insert policy" ON public.leave_evidence
  WITH CHECK ((EXISTS ( SELECT 1
   FROM leave_requests lr
  WHERE ((lr.id = leave_evidence.leave_request_id) AND (lr.user_id = ( SELECT (select auth.uid()) AS uid))))));

ALTER POLICY "Leave evidence select policy" ON public.leave_evidence
  USING ((EXISTS ( SELECT 1
   FROM leave_requests lr
  WHERE ((lr.id = leave_evidence.leave_request_id) AND ((lr.user_id = (select auth.uid())) OR (lr.reliever_id = (select auth.uid())) OR (lr.supervisor_id = (select auth.uid())) OR has_role('admin'::text))))));

ALTER POLICY "Leave request segments select policy" ON public.leave_request_segments
  USING ((EXISTS ( SELECT 1
   FROM leave_requests lr
  WHERE ((lr.id = leave_request_segments.leave_request_id) AND ((lr.user_id = (select auth.uid())) OR (lr.reliever_id = (select auth.uid())) OR (lr.supervisor_id = (select auth.uid())) OR (lr.current_approver_user_id = (select auth.uid())) OR has_role('admin'::text))))));

ALTER POLICY "Leave requests approver select policy" ON public.leave_requests
  USING ((current_approver_user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Leave requests approver update policy" ON public.leave_requests
  USING (((current_approver_user_id = ( SELECT (select auth.uid()) AS uid)) AND ((status)::text = ANY ((ARRAY['pending'::character varying, 'pending_evidence'::character varying])::text[]))))
  WITH CHECK (((current_approver_user_id = ( SELECT (select auth.uid()) AS uid)) AND ((status)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying, 'pending_evidence'::character varying, 'pending'::character varying])::text[]))));

ALTER POLICY "Leave requests insert policy" ON public.leave_requests
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Leave requests select policy" ON public.leave_requests
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = leave_requests.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Leave requests update policy" ON public.leave_requests
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = leave_requests.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid)))))))) OR ((user_id = ( SELECT (select auth.uid()) AS uid)) AND ((status)::text = 'pending'::text))));

ALTER POLICY lunch_menu_views_insert ON public.lunch_menu_views
  WITH CHECK (((user_id = (select auth.uid())) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY lunch_menu_views_select ON public.lunch_menu_views
  USING (((user_id = (select auth.uid())) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY lunch_menu_views_update ON public.lunch_menu_views
  USING (((user_id = (select auth.uid())) OR ( SELECT has_role('admin'::text) AS has_role)))
  WITH CHECK (((user_id = (select auth.uid())) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY lunch_reviews_delete_own ON public.lunch_reviews
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY lunch_reviews_insert_own ON public.lunch_reviews
  WITH CHECK (((user_id = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM lunch_menus m
  WHERE ((m.id = lunch_reviews.menu_id) AND (m.date < CURRENT_DATE))))));

ALTER POLICY lunch_reviews_select_own ON public.lunch_reviews
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY lunch_reviews_update_own ON public.lunch_reviews
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)))
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY lunch_vote_selections_write_own ON public.lunch_vote_selections
  USING ((EXISTS ( SELECT 1
   FROM lunch_votes v
  WHERE ((v.id = lunch_vote_selections.vote_id) AND ((v.user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM lunch_votes v
  WHERE ((v.id = lunch_vote_selections.vote_id) AND ((v.user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role))))));

ALTER POLICY lunch_votes_delete_own ON public.lunch_votes
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY lunch_votes_insert_own ON public.lunch_votes
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY lunch_votes_update_own ON public.lunch_votes
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)))
  WITH CHECK (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY meeting_artifact_ledger_select ON public.meeting_artifact_ledger
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY meeting_artifact_sources_select ON public.meeting_artifact_sources
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY meeting_artifact_sources_write ON public.meeting_artifact_sources
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))))))));

ALTER POLICY meeting_challenges_delete ON public.meeting_challenges
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['developer'::user_role, 'super_admin'::user_role, 'admin'::user_role])) OR ((p.is_department_lead = true) AND (p.department = meeting_challenges.department)))))));

ALTER POLICY meeting_challenges_insert ON public.meeting_challenges
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['developer'::user_role, 'super_admin'::user_role, 'admin'::user_role])) OR (p.is_department_lead = true) OR (p.department = meeting_challenges.department) OR (meeting_challenges.department IS NULL))))));

ALTER POLICY meeting_challenges_update ON public.meeting_challenges
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['developer'::user_role, 'super_admin'::user_role, 'admin'::user_role])) OR ((p.is_department_lead = true) AND ((p.department = meeting_challenges.department) OR ((p.lead_departments IS NOT NULL) AND (p.lead_departments @> ARRAY[meeting_challenges.department])))) OR (meeting_challenges.owner_id = (select auth.uid())))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((p.role = ANY (ARRAY['developer'::user_role, 'super_admin'::user_role, 'admin'::user_role])) OR ((p.is_department_lead = true) AND ((p.department = meeting_challenges.department) OR ((p.lead_departments IS NOT NULL) AND (p.lead_departments @> ARRAY[meeting_challenges.department])))) OR (meeting_challenges.owner_id = (select auth.uid())))))));

ALTER POLICY meeting_week_documents_delete ON public.meeting_week_documents
  USING ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains))))))))));

ALTER POLICY meeting_week_documents_insert ON public.meeting_week_documents
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))))))) AND (weekly_report_can_mutate(meeting_week, meeting_year) OR meeting_document_slot_is_empty(meeting_week, meeting_year, document_type, department))));

ALTER POLICY meeting_week_documents_select ON public.meeting_week_documents
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR (p.is_department_lead = true))))));

ALTER POLICY meeting_week_documents_update ON public.meeting_week_documents
  USING ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND (meeting_week_documents.document_type = 'knowledge_sharing_session'::text) AND ((meeting_week_documents.department = p.department) OR (meeting_week_documents.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))))
  WITH CHECK ((weekly_report_can_mutate(meeting_week, meeting_year) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR ((p.is_department_lead = true) AND (meeting_week_documents.document_type = 'knowledge_sharing_session'::text) AND ((meeting_week_documents.department = p.department) OR (meeting_week_documents.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))));

ALTER POLICY "super_admin/admin can view network activity logs" ON public.network_activity_logs
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role]))))));

ALTER POLICY "super_admin/admin can view network bandwidth snapshots" ON public.network_bandwidth_snapshots
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role]))))));

ALTER POLICY "Notification preferences insert" ON public.notification_preferences
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Notification preferences select policy" ON public.notification_preferences
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Notification preferences update" ON public.notification_preferences
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Notification queue select" ON public.notification_queue
  USING ((has_role('admin'::text) OR (user_id = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY "Notification user prefs select own" ON public.notification_user_delivery_preferences
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Notification user prefs update own" ON public.notification_user_delivery_preferences
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)))
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Notification user prefs upsert own" ON public.notification_user_delivery_preferences
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Notifications insert policy" ON public.notifications
  WITH CHECK ((has_role('staff'::text) OR has_role('admin'::text) OR (( SELECT (select auth.uid()) AS uid) IS NOT NULL)));

ALTER POLICY "Users can update own notifications" ON public.notifications
  USING ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Users can view own notifications" ON public.notifications
  USING ((( SELECT (select auth.uid()) AS uid) = user_id));

ALTER POLICY "Office locations delete policy" ON public.office_locations
  USING ((( SELECT has_role('super_admin'::text) AS has_role) OR (( SELECT (profiles.role)::text AS role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY "Office locations insert policy" ON public.office_locations
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT (profiles.role)::text AS role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY "Office locations update policy" ON public.office_locations
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT (profiles.role)::text AS role
   FROM profiles
  WHERE (profiles.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY "Overtime requests select policy" ON public.overtime_requests
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = overtime_requests.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Payment documents delete policy" ON public.payment_documents
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (uploaded_by = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY "Payment documents insert policy" ON public.payment_documents
  WITH CHECK ((has_role('admin'::text) OR (has_role('lead'::text) AND (EXISTS ( SELECT 1
   FROM (department_payments dp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((dp.id = payment_documents.payment_id) AND (p.department_id = dp.department_id)))))));

ALTER POLICY "Payment documents select policy" ON public.payment_documents
  USING ((has_role('admin'::text) OR (has_role('lead'::text) AND (EXISTS ( SELECT 1
   FROM (department_payments dp
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((dp.id = payment_documents.payment_id) AND (p.department_id = dp.department_id))))) OR (uploaded_by = (select auth.uid()))));

ALTER POLICY "Payment documents update policy" ON public.payment_documents
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (uploaded_by = ( SELECT (select auth.uid()) AS uid))))
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR (uploaded_by = ( SELECT (select auth.uid()) AS uid))));

ALTER POLICY "Payroll entries select policy" ON public.payroll_entries
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Payslips select policy" ON public.payslips
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Leads can view dept peer feedback" ON public.peer_feedback
  USING ((EXISTS ( SELECT 1
   FROM (profiles lead
     JOIN profiles subject ON ((subject.id = peer_feedback.subject_user_id)))
  WHERE ((lead.id = (select auth.uid())) AND (lead.is_department_lead = true) AND ((subject.department = lead.department) OR (subject.department = ANY (COALESCE(lead.lead_departments, ARRAY[]::text[]))))))));

ALTER POLICY peer_feedback_insert ON public.peer_feedback
  WITH CHECK ((((select auth.uid()) = reviewer_user_id) AND (subject_user_id <> reviewer_user_id)));

ALTER POLICY peer_feedback_select ON public.peer_feedback
  USING ((((select auth.uid()) = subject_user_id) OR ((select auth.uid()) = reviewer_user_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['developer'::user_role, 'admin'::user_role, 'super_admin'::user_role])))))));

ALTER POLICY peer_feedback_update ON public.peer_feedback
  USING ((((select auth.uid()) = reviewer_user_id) AND (status = 'pending'::text)));

ALTER POLICY "Performance ratings select policy" ON public.performance_ratings
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM performance_reviews pr
  WHERE ((pr.id = performance_ratings.performance_review_id) AND ((pr.user_id = ( SELECT (select auth.uid()) AS uid)) OR (pr.reviewer_id = ( SELECT (select auth.uid()) AS uid))))))));

ALTER POLICY "Performance reviews insert" ON public.performance_reviews
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR (p.is_department_lead = true))))));

ALTER POLICY "Performance reviews select" ON public.performance_reviews
  USING (((user_id = (select auth.uid())) OR (reviewer_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text])) OR ((p.is_department_lead = true) AND (performance_reviews.user_id IN ( SELECT pr.id
           FROM profiles pr
          WHERE ((pr.department = p.department) OR (pr.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[])))))))))))));

ALTER POLICY "Performance reviews update" ON public.performance_reviews
  USING (((reviewer_id = ( SELECT (select auth.uid()) AS uid)) OR has_role('admin'::text)));

ALTER POLICY "Profiles insert policy" ON public.profiles
  WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND ((user_roles.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text, 'developer'::text]))))) OR has_role('admin'::text)));

ALTER POLICY "Profiles update policy" ON public.profiles
  USING (((id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND ((user_roles.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text, 'developer'::text]))))) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT (profiles_1.role)::text AS role
   FROM profiles profiles_1
  WHERE (profiles_1.id = (select auth.uid()))) = 'developer'::text)));

ALTER POLICY profiles_select_own ON public.profiles
  USING ((id = (select auth.uid())));

ALTER POLICY "Project updates insert policy" ON public.project_updates
  WITH CHECK (((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = project_updates.project_id) AND (project_members.user_id = ( SELECT (select auth.uid()) AS uid))))) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Project updates update policy" ON public.project_updates
  USING (((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = project_updates.project_id) AND (project_members.user_id = ( SELECT (select auth.uid()) AS uid))))) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Projects insert scoped" ON public.projects
  WITH CHECK ((is_admin_like() OR (created_by = (select auth.uid())) OR (project_manager_id = (select auth.uid()))));

ALTER POLICY "Projects select scoped" ON public.projects
  USING ((is_admin_like() OR ( SELECT has_role('lead'::text) AS has_role) OR (created_by = (select auth.uid())) OR (project_manager_id = (select auth.uid())) OR is_project_member(id, (select auth.uid())) OR has_assigned_task_in_project(id, (select auth.uid()))));

ALTER POLICY purchase_order_items_admin_manage ON public.purchase_order_items
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY purchase_orders_admin_manage ON public.purchase_orders
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY "Push subscriptions delete own" ON public.push_subscriptions
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Push subscriptions insert own" ON public.push_subscriptions
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Push subscriptions select own" ON public.push_subscriptions
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Push subscriptions update own" ON public.push_subscriptions
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)))
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY authenticated_read_funding_categories ON public.requisition_funding_categories
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY users_insert_own_requisitions ON public.requisitions
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY risk_register_select ON public.risk_register
  USING ((is_admin_like() OR (control_owner_id = (select auth.uid())) OR (((ARRAY[department] || supporting_departments) || control_owner_departments) && current_user_lead_departments()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.department = ANY (((ARRAY[risk_register.department] || risk_register.supporting_departments) || risk_register.control_owner_departments))))))));

ALTER POLICY risk_register_update ON public.risk_register
  USING ((is_admin_like() OR (department = ANY (current_user_lead_departments())) OR (control_owner_id = (select auth.uid()))))
  WITH CHECK ((is_admin_like() OR (department = ANY (current_user_lead_departments())) OR (control_owner_id = (select auth.uid()))));

ALTER POLICY "Salary structures select policy" ON public.salary_structures
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (EXISTS ( SELECT 1
   FROM employee_salaries es
  WHERE ((es.id = salary_structures.employee_salary_id) AND (es.user_id = ( SELECT (select auth.uid()) AS uid)))))));

ALTER POLICY suppliers_admin_manage ON public.suppliers
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text, 'admin'::text]))))));

ALTER POLICY "Task assignments insert policy" ON public.task_assignments
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = task_assignments.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Task assignments select policy" ON public.task_assignments
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = task_assignments.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Task assignments update policy" ON public.task_assignments
  USING ((( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = task_assignments.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Task updates insert policy" ON public.task_updates
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Task updates select policy" ON public.task_updates
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = task_updates.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Task user completion insert policy" ON public.task_user_completion
  WITH CHECK (((user_id = ( SELECT (select auth.uid()) AS uid)) AND (EXISTS ( SELECT 1
   FROM task_assignments
  WHERE ((task_assignments.task_id = task_user_completion.task_id) AND (task_assignments.user_id = ( SELECT (select auth.uid()) AS uid)))))));

ALTER POLICY "Task user completion select policy" ON public.task_user_completion
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role)));

ALTER POLICY "Tasks select policy" ON public.tasks
  USING ((( SELECT has_role('admin'::text) AS has_role) OR ( SELECT has_role('lead'::text) AS has_role) OR (assigned_to = (select auth.uid())) OR (assigned_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM task_assignments ta
  WHERE ((ta.task_id = tasks.id) AND (ta.user_id = (select auth.uid()))))) OR is_project_manager_of(project_id, (select auth.uid())) OR ((assignment_type = 'department'::text) AND (department IS NOT NULL) AND (department = ( SELECT pr.department
   FROM profiles pr
  WHERE (pr.id = (select auth.uid())))))));

ALTER POLICY "Tasks update policy" ON public.tasks
  USING ((( SELECT has_role('admin'::text) AS has_role) OR ( SELECT has_role('lead'::text) AS has_role) OR (assigned_to = (select auth.uid())) OR (assigned_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM task_assignments ta
  WHERE ((ta.task_id = tasks.id) AND (ta.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = tasks.project_id) AND (p.project_manager_id = (select auth.uid())))))))
  WITH CHECK ((( SELECT has_role('admin'::text) AS has_role) OR ( SELECT has_role('lead'::text) AS has_role) OR (assigned_to = (select auth.uid())) OR (assigned_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM task_assignments ta
  WHERE ((ta.task_id = tasks.id) AND (ta.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = tasks.project_id) AND (p.project_manager_id = (select auth.uid())))))));

ALTER POLICY "Timesheets delete policy" ON public.timesheets
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Timesheets insert policy" ON public.timesheets
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Timesheets select policy" ON public.timesheets
  USING (((user_id = ( SELECT (select auth.uid()) AS uid)) OR ( SELECT has_role('admin'::text) AS has_role) OR (( SELECT has_role('lead'::text) AS has_role) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = timesheets.user_id) AND (profiles.department_id = ( SELECT profiles_1.department_id
           FROM profiles profiles_1
          WHERE (profiles_1.id = ( SELECT (select auth.uid()) AS uid))))))))));

ALTER POLICY "Timesheets update policy" ON public.timesheets
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "Leads can view dept team documentation" ON public.user_documentation
  USING ((EXISTS ( SELECT 1
   FROM (profiles lead
     JOIN profiles subject ON ((subject.id = user_documentation.user_id)))
  WHERE ((lead.id = (select auth.uid())) AND (lead.is_department_lead = true) AND ((subject.department = lead.department) OR (subject.department = ANY (COALESCE(lead.lead_departments, ARRAY[]::text[]))))))));

ALTER POLICY "User documentation delete policy" ON public.user_documentation
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "User documentation insert policy" ON public.user_documentation
  WITH CHECK ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "User documentation select policy" ON public.user_documentation
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "User documentation update policy" ON public.user_documentation
  USING ((user_id = ( SELECT (select auth.uid()) AS uid)));

ALTER POLICY "User roles delete policy" ON public.user_roles
  USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text, 'developer'::text]))))) OR has_role('admin'::text)));

ALTER POLICY "User roles select (self or admin)" ON public.user_roles
  USING (((user_id = (select auth.uid())) OR has_role('admin'::text)));

ALTER POLICY "User roles update policy" ON public.user_roles
  USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['admin'::text, 'super_admin'::text, 'developer'::text]))))) OR has_role('admin'::text)));

ALTER POLICY "Weekly report meeting windows admin manage" ON public.weekly_report_meeting_windows
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))))))) AND weekly_report_can_mutate(week_number, year)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))))))) AND weekly_report_can_mutate(week_number, year)));

ALTER POLICY "Authenticated can view submitted reports" ON public.weekly_reports
  USING (((status = 'submitted'::text) OR ((select auth.uid()) = user_id)));

ALTER POLICY "Leads and admins can insert weekly reports" ON public.weekly_reports
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((weekly_reports.user_id = (select auth.uid())) OR (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((weekly_reports.department = p.department) OR (weekly_reports.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))) AND weekly_report_can_mutate(week_number, year)));

ALTER POLICY "Leads and admins can update weekly reports" ON public.weekly_reports
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((weekly_reports.user_id = (select auth.uid())) OR (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((weekly_reports.department = p.department) OR (weekly_reports.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((weekly_reports.user_id = (select auth.uid())) OR (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((weekly_reports.department = p.department) OR (weekly_reports.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));

ALTER POLICY "Only admins can delete weekly reports" ON public.weekly_reports
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND ((weekly_reports.user_id = (select auth.uid())) OR (lower(TRIM(BOTH FROM (p.role)::text)) = ANY (ARRAY['developer'::text, 'super_admin'::text])) OR ((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) AND ((p.admin_domains IS NULL) OR ('reports'::text = ANY (p.admin_domains)))) OR (((lower(TRIM(BOTH FROM (p.role)::text)) = 'admin'::text) OR (p.is_department_lead = true)) AND ((weekly_reports.department = p.department) OR (weekly_reports.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))))))));