-- Drop all versions of the trigger to be sure
DROP TRIGGER IF EXISTS audit_asset_assignment_changes ON asset_assignments;

-- Re-create it exactly ONCE
CREATE TRIGGER audit_asset_assignment_changes
  AFTER INSERT OR UPDATE OR DELETE ON asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION audit_asset_assignment_changes();
;
