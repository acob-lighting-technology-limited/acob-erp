-- Migration: Fix Search Path for SECURITY DEFINER and INVOKER functions
-- Description: Adds explicit search_path to all remaining public functions to prevent search path hijacking

-- 1. Audit and Logs
ALTER FUNCTION audit_log_changes() SET search_path = public, pg_temp;

-- 2. System Settings
ALTER FUNCTION get_system_setting(text) SET search_path = public, pg_temp;
ALTER FUNCTION update_system_setting(text, jsonb, uuid) SET search_path = public, pg_temp;

-- 3. RBAC
ALTER FUNCTION has_role(text) SET search_path = public, pg_temp;

-- 4. Notifications
ALTER FUNCTION mark_notification_read(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION mark_all_notifications_read() SET search_path = public, pg_temp;
ALTER FUNCTION mark_notifications_read(uuid, uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION create_notification(uuid, text, text, text, jsonb, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION create_notification(uuid, text, text, text, text, text, text, uuid, text, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_old_notifications() SET search_path = public, pg_temp;
ALTER FUNCTION populate_notification_actor() SET search_path = public, pg_temp;

-- 5. Sync and Task Management
ALTER FUNCTION notify_token_generated() SET search_path = public, pg_temp;
ALTER FUNCTION get_last_sync_timestamp(text) SET search_path = public, pg_temp;
ALTER FUNCTION notify_task_completed() SET search_path = public, pg_temp;
ALTER FUNCTION record_sync_completion(text, timestamp with time zone, timestamp with time zone, integer, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION broadcast_event_notification() SET search_path = public, pg_temp;
ALTER FUNCTION update_task_status_from_completions() SET search_path = public, pg_temp;

-- 6. HR and Suspensions
ALTER FUNCTION check_and_lift_expired_suspensions() SET search_path = public, pg_temp;

-- 7. Trigger and Helper Functions
ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION update_asset_types_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_crm_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION sync_contact_from_customer() SET search_path = public, pg_temp;
ALTER FUNCTION sync_customer_from_contact() SET search_path = public, pg_temp;
ALTER FUNCTION update_starlink_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION get_next_asset_serial(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION handle_departments_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION handle_dept_payments_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION auto_add_payment_category() SET search_path = public, pg_temp;
ALTER FUNCTION update_employee_suspensions_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_office_locations_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION check_acquisition_year_order() SET search_path = public, pg_temp;
ALTER FUNCTION check_asset_deletion_allowed() SET search_path = public, pg_temp;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
