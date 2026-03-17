
-- Fix RLS initplan: wrap bare auth.uid() calls in (SELECT auth.uid()) so Postgres
-- evaluates the function once per query, not once per row.

-- audit_logs
DROP POLICY IF EXISTS "Audit logs insert policy" ON public.audit_logs;
CREATE POLICY "Audit logs insert policy" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (user_id IS NULL OR user_id = (SELECT auth.uid())));

-- correspondence_approvals
DROP POLICY IF EXISTS "correspondence_approvals_update" ON public.correspondence_approvals;
CREATE POLICY "correspondence_approvals_update" ON public.correspondence_approvals FOR UPDATE TO authenticated
  USING ((approver_id = (SELECT auth.uid())) OR correspondence_is_admin())
  WITH CHECK ((approver_id = (SELECT auth.uid())) OR correspondence_is_admin());

-- correspondence_department_codes
DROP POLICY IF EXISTS "correspondence_department_codes_select" ON public.correspondence_department_codes;
CREATE POLICY "correspondence_department_codes_select" ON public.correspondence_department_codes FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- correspondence_events
DROP POLICY IF EXISTS "correspondence_events_insert" ON public.correspondence_events;
CREATE POLICY "correspondence_events_insert" ON public.correspondence_events FOR INSERT TO authenticated
  WITH CHECK ((actor_id = (SELECT auth.uid())) OR correspondence_is_admin());

-- correspondence_records
DROP POLICY IF EXISTS "correspondence_records_insert" ON public.correspondence_records;
CREATE POLICY "correspondence_records_insert" ON public.correspondence_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND originator_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "correspondence_records_select" ON public.correspondence_records;
CREATE POLICY "correspondence_records_select" ON public.correspondence_records FOR SELECT TO authenticated
  USING ((originator_id = (SELECT auth.uid())) OR (responsible_officer_id = (SELECT auth.uid())) OR correspondence_is_admin() OR ((department_name IS NOT NULL) AND correspondence_is_lead_for_department(department_name)) OR ((assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(assigned_department_name)));

DROP POLICY IF EXISTS "correspondence_records_update" ON public.correspondence_records;
CREATE POLICY "correspondence_records_update" ON public.correspondence_records FOR UPDATE TO authenticated
  USING ((originator_id = (SELECT auth.uid())) OR (responsible_officer_id = (SELECT auth.uid())) OR correspondence_is_admin() OR ((department_name IS NOT NULL) AND correspondence_is_lead_for_department(department_name)) OR ((assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(assigned_department_name)))
  WITH CHECK ((originator_id = (SELECT auth.uid())) OR (responsible_officer_id = (SELECT auth.uid())) OR correspondence_is_admin() OR ((department_name IS NOT NULL) AND correspondence_is_lead_for_department(department_name)) OR ((assigned_department_name IS NOT NULL) AND correspondence_is_lead_for_department(assigned_department_name)));

-- correspondence_versions
DROP POLICY IF EXISTS "correspondence_versions_insert" ON public.correspondence_versions;
CREATE POLICY "correspondence_versions_insert" ON public.correspondence_versions FOR INSERT TO authenticated
  WITH CHECK ((uploaded_by = (SELECT auth.uid())) OR correspondence_is_admin());

-- dev_login_logs
DROP POLICY IF EXISTS "Authenticated users can write own dev login logs" ON public.dev_login_logs;
CREATE POLICY "Authenticated users can write own dev login logs" ON public.dev_login_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- help_desk_approvals
DROP POLICY IF EXISTS "help_desk_approvals_update" ON public.help_desk_approvals;
CREATE POLICY "help_desk_approvals_update" ON public.help_desk_approvals FOR UPDATE TO authenticated
  USING ((approver_id = (SELECT auth.uid())) OR help_desk_is_admin())
  WITH CHECK ((approver_id = (SELECT auth.uid())) OR help_desk_is_admin());

-- help_desk_categories
DROP POLICY IF EXISTS "help_desk_categories_select" ON public.help_desk_categories;
CREATE POLICY "help_desk_categories_select" ON public.help_desk_categories FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- help_desk_comments
DROP POLICY IF EXISTS "help_desk_comments_insert" ON public.help_desk_comments;
CREATE POLICY "help_desk_comments_insert" ON public.help_desk_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM help_desk_tickets t WHERE t.id = help_desk_comments.ticket_id AND (t.requester_id = (SELECT auth.uid()) OR t.assigned_to = (SELECT auth.uid()) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department))));

-- help_desk_events
DROP POLICY IF EXISTS "help_desk_events_insert" ON public.help_desk_events;
CREATE POLICY "help_desk_events_insert" ON public.help_desk_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM help_desk_tickets t WHERE t.id = help_desk_events.ticket_id AND (t.requester_id = (SELECT auth.uid()) OR t.assigned_to = (SELECT auth.uid()) OR help_desk_is_admin() OR help_desk_is_lead_for_department(t.service_department))));

-- help_desk_tickets
DROP POLICY IF EXISTS "help_desk_tickets_insert" ON public.help_desk_tickets;
CREATE POLICY "help_desk_tickets_insert" ON public.help_desk_tickets FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND created_by = (SELECT auth.uid()) AND requester_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "help_desk_tickets_select" ON public.help_desk_tickets;
CREATE POLICY "help_desk_tickets_select" ON public.help_desk_tickets FOR SELECT TO authenticated
  USING ((requester_id = (SELECT auth.uid())) OR (assigned_to = (SELECT auth.uid())) OR (created_by = (SELECT auth.uid())) OR help_desk_is_admin() OR help_desk_is_lead_for_department(service_department));

DROP POLICY IF EXISTS "help_desk_tickets_update" ON public.help_desk_tickets;
CREATE POLICY "help_desk_tickets_update" ON public.help_desk_tickets FOR UPDATE TO authenticated
  USING ((assigned_to = (SELECT auth.uid())) OR (requester_id = (SELECT auth.uid())) OR help_desk_is_admin() OR help_desk_is_lead_for_department(service_department))
  WITH CHECK ((assigned_to = (SELECT auth.uid())) OR (requester_id = (SELECT auth.uid())) OR help_desk_is_admin() OR help_desk_is_lead_for_department(service_department));

-- leave_approvals
DROP POLICY IF EXISTS "Leave approvals approver insert policy" ON public.leave_approvals;
CREATE POLICY "Leave approvals approver insert policy" ON public.leave_approvals FOR INSERT TO authenticated
  WITH CHECK (approver_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_approvals.leave_request_id AND lr.current_approver_user_id = (SELECT auth.uid()) AND lr.status IN ('pending', 'pending_evidence')));

-- leave_evidence
DROP POLICY IF EXISTS "Leave evidence insert policy" ON public.leave_evidence;
CREATE POLICY "Leave evidence insert policy" ON public.leave_evidence FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.id = leave_evidence.leave_request_id AND lr.user_id = (SELECT auth.uid())));

-- leave_requests
DROP POLICY IF EXISTS "Leave requests approver select policy" ON public.leave_requests;
CREATE POLICY "Leave requests approver select policy" ON public.leave_requests FOR SELECT TO authenticated
  USING (current_approver_user_id = (SELECT auth.uid()));

-- notification_user_delivery_preferences
DROP POLICY IF EXISTS "Notification user prefs select own" ON public.notification_user_delivery_preferences;
CREATE POLICY "Notification user prefs select own" ON public.notification_user_delivery_preferences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Notification user prefs update own" ON public.notification_user_delivery_preferences;
CREATE POLICY "Notification user prefs update own" ON public.notification_user_delivery_preferences FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Notification user prefs upsert own" ON public.notification_user_delivery_preferences;
CREATE POLICY "Notification user prefs upsert own" ON public.notification_user_delivery_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- notification_queue
DROP POLICY IF EXISTS "Notification queue select" ON public.notification_queue;
CREATE POLICY "Notification queue select" ON public.notification_queue FOR SELECT TO authenticated
  USING (has_role('admin'::text) OR (user_id = (SELECT auth.uid())));

-- action_items: fix bare auth.uid() in USING clauses
DROP POLICY IF EXISTS "Users can update their own action items or admins/leads" ON public.action_items;
CREATE POLICY "Users can update their own action items or admins/leads" ON public.action_items FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = assigned_by) OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = (SELECT auth.uid()) AND (lower(trim(p.role::text)) = ANY (ARRAY['developer','super_admin'])) OR (lower(trim(p.role::text)) = 'admin' AND (p.admin_domains IS NULL OR 'reports' = ANY(p.admin_domains))) OR (p.is_department_lead = true AND (action_items.department = p.department OR action_items.department = ANY(COALESCE(p.lead_departments, ARRAY[]::text[])))))));
;
