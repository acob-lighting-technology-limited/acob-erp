
-- Add indexes for unindexed foreign key columns
-- These improve JOIN and DELETE cascade performance

-- action_items
CREATE INDEX IF NOT EXISTS idx_action_items_report_id ON action_items(report_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_by ON action_items(assigned_by);

-- correspondence_records
CREATE INDEX IF NOT EXISTS idx_correspondence_records_incoming_ref ON correspondence_records(incoming_reference_id);

-- employee_department_history
CREATE INDEX IF NOT EXISTS idx_employee_dept_history_profile_id ON employee_department_history(profile_id);

-- help_desk_tickets
CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_category_id ON help_desk_tickets(category_id);

-- leave_approval_role_routes
CREATE INDEX IF NOT EXISTS idx_leave_approval_role_routes_approver_role ON leave_approval_role_routes(approver_role_code);

-- leave_approver_assignments
CREATE INDEX IF NOT EXISTS idx_leave_approver_assignments_user_id ON leave_approver_assignments(user_id);

-- leave_evidence
CREATE INDEX IF NOT EXISTS idx_leave_evidence_uploaded_by ON leave_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_leave_evidence_verified_by ON leave_evidence(verified_by);

-- leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_original_request_id ON leave_requests(original_request_id);

-- notification_delivery_policies
CREATE INDEX IF NOT EXISTS idx_notification_delivery_policies_updated_by ON notification_delivery_policies(updated_by);

-- weekly_report_meeting_windows
CREATE INDEX IF NOT EXISTS idx_weekly_report_meeting_windows_created_by ON weekly_report_meeting_windows(created_by);
CREATE INDEX IF NOT EXISTS idx_weekly_report_meeting_windows_updated_by ON weekly_report_meeting_windows(updated_by);

-- Also recreate key performance indexes that were dropped (high-value ones)
-- audit_logs: user + created_at is the primary access pattern
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- leave_requests: user_id is the primary filter
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- profiles: department is queried constantly
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_company_email ON profiles(company_email);

-- notifications: user_id + read is the primary filter for the notification bell
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, read);

-- notification_queue: status + process_after for the queue worker
CREATE INDEX IF NOT EXISTS idx_notification_queue_worker ON notification_queue(status, process_after) WHERE status = 'pending';
;
