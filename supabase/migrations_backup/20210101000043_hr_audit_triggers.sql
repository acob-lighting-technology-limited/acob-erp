-- Add Audit Triggers for HR and Critical Tables
-- This ensures all important actions are logged for compliance

-- Create audit log trigger function if not exists
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      auth.uid(),
      'INSERT',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (
      auth.uid(),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
    VALUES (
      auth.uid(),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id::text,
      row_to_json(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Leave Requests Audit Trigger
DROP TRIGGER IF EXISTS audit_leave_requests_changes ON leave_requests;
CREATE TRIGGER audit_leave_requests_changes
  AFTER INSERT OR UPDATE OR DELETE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Leave Approvals Audit Trigger
DROP TRIGGER IF EXISTS audit_leave_approvals_changes ON leave_approvals;
CREATE TRIGGER audit_leave_approvals_changes
  AFTER INSERT OR UPDATE OR DELETE ON leave_approvals
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Attendance Records Audit Trigger
DROP TRIGGER IF EXISTS audit_attendance_records_changes ON attendance_records;
CREATE TRIGGER audit_attendance_records_changes
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Performance Reviews Audit Trigger
DROP TRIGGER IF EXISTS audit_performance_reviews_changes ON performance_reviews;
CREATE TRIGGER audit_performance_reviews_changes
  AFTER INSERT OR UPDATE OR DELETE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Goals Objectives Audit Trigger
DROP TRIGGER IF EXISTS audit_goals_objectives_changes ON goals_objectives;
CREATE TRIGGER audit_goals_objectives_changes
  AFTER INSERT OR UPDATE OR DELETE ON goals_objectives
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Profiles Audit Trigger (CRITICAL - tracks role changes)
DROP TRIGGER IF EXISTS audit_profiles_changes ON profiles;
CREATE TRIGGER audit_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Assets Audit Trigger
DROP TRIGGER IF EXISTS audit_assets_changes ON assets;
CREATE TRIGGER audit_assets_changes
  AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Asset Assignments Audit Trigger
DROP TRIGGER IF EXISTS audit_asset_assignments_changes ON asset_assignments;
CREATE TRIGGER audit_asset_assignments_changes
  AFTER INSERT OR UPDATE OR DELETE ON asset_assignments
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Tasks Audit Trigger
DROP TRIGGER IF EXISTS audit_tasks_changes ON tasks;
CREATE TRIGGER audit_tasks_changes
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Refresh schema
NOTIFY pgrst, 'reload schema';
