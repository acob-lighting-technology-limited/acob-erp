-- Migration: Phase 2 Performance Fixes (Indexing)
-- Description: Adds missing indexes to foreign key columns to improve query performance

-- 1. Admin and Audit Logs
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id ON admin_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_fk ON audit_logs(user_id);

-- 2. Assets and Inventory
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_by ON asset_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_from ON asset_assignments(assigned_from);
CREATE INDEX IF NOT EXISTS idx_asset_issues_created_by ON asset_issues(created_by);
CREATE INDEX IF NOT EXISTS idx_asset_issues_resolved_by ON asset_issues(resolved_by);
CREATE INDEX IF NOT EXISTS idx_asset_types_created_by ON asset_types(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);

-- 3. HR and Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_records_shift_id ON attendance_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_suspensions_lifted_by ON employee_suspensions(lifted_by);
CREATE INDEX IF NOT EXISTS idx_performance_ratings_review_id ON performance_ratings(performance_review_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status_changed_by ON profiles(status_changed_by);
CREATE INDEX IF NOT EXISTS idx_timesheets_approved_by ON timesheets(approved_by);

-- 4. CRM
CREATE INDEX IF NOT EXISTS idx_crm_contacts_pipeline_id ON crm_contacts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_pipeline_id ON crm_opportunities(pipeline_id);

-- 5. Projects and Tasks
CREATE INDEX IF NOT EXISTS idx_departments_head_id ON departments(department_head_id);
CREATE INDEX IF NOT EXISTS idx_project_items_created_by ON project_items(created_by);
CREATE INDEX IF NOT EXISTS idx_project_members_assigned_by ON project_members(assigned_by);
CREATE INDEX IF NOT EXISTS idx_project_updates_user_id ON project_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_remote_tasks_created_by ON remote_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_task_updates_user_id_fk ON task_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by_fk ON tasks(assigned_by);

-- 6. Starlink System
CREATE INDEX IF NOT EXISTS idx_starlink_documents_uploaded_by ON starlink_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_starlink_payments_created_by ON starlink_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_starlink_sites_created_by ON starlink_sites(created_by);

-- 7. System and Tokens
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON system_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_token_records_generated_by ON token_records(generated_by);
CREATE INDEX IF NOT EXISTS idx_token_sales_generated_by ON token_sales(generated_by);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
