-- Drop the asset_assignments audit trigger to prevent duplicate logging
-- Asset changes should be logged once via the assets table trigger only
DROP TRIGGER IF EXISTS audit_asset_assignments_changes ON asset_assignments;;
