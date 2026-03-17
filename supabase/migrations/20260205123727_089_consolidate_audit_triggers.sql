-- Step 1: Drop all triggers using the old log_audit_changes function
DROP TRIGGER IF EXISTS audit_leave_requests_changes ON leave_requests;
DROP TRIGGER IF EXISTS audit_leave_approvals_changes ON leave_approvals;
DROP TRIGGER IF EXISTS audit_attendance_records_changes ON attendance_records;
DROP TRIGGER IF EXISTS audit_performance_reviews_changes ON performance_reviews;
DROP TRIGGER IF EXISTS audit_goals_objectives_changes ON goals_objectives;
DROP TRIGGER IF EXISTS audit_profiles_changes ON profiles;
DROP TRIGGER IF EXISTS audit_assets_changes ON assets;
DROP TRIGGER IF EXISTS audit_asset_assignments_changes ON asset_assignments;
DROP TRIGGER IF EXISTS audit_tasks_changes ON tasks;

-- Step 2: Recreate triggers using the unified audit_log_changes function
CREATE TRIGGER audit_leave_requests_changes
  AFTER INSERT OR UPDATE OR DELETE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_leave_approvals_changes
  AFTER INSERT OR UPDATE OR DELETE ON leave_approvals
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_attendance_records_changes
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_performance_reviews_changes
  AFTER INSERT OR UPDATE OR DELETE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_goals_objectives_changes
  AFTER INSERT OR UPDATE OR DELETE ON goals_objectives
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_assets_changes
  AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_asset_assignments_changes
  AFTER INSERT OR UPDATE OR DELETE ON asset_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_tasks_changes
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Step 3: Drop the duplicate function
DROP FUNCTION IF EXISTS log_audit_changes();;
