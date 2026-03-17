CREATE OR REPLACE FUNCTION reassign_asset(
  p_asset_id UUID,
  p_new_assignment_type TEXT,
  p_assigned_to UUID,
  p_department TEXT,
  p_office_location TEXT,
  p_assigned_by UUID,
  p_assigned_at TIMESTAMPTZ,
  p_assignment_notes TEXT,
  p_handover_notes TEXT,
  p_new_status TEXT DEFAULT 'assigned'
) RETURNS VOID AS $$
BEGIN
  -- 1. Close current assignment
  UPDATE asset_assignments
  SET is_current = false,
      handed_over_at = NOW(),
      handover_notes = p_handover_notes
  WHERE asset_id = p_asset_id AND is_current = true;

  -- 2. Create new assignment
  INSERT INTO asset_assignments (
    asset_id,
    assignment_type,
    assigned_to,
    department,
    office_location,
    assigned_by,
    assigned_at,
    assignment_notes,
    is_current
  ) VALUES (
    p_asset_id,
    p_new_assignment_type,
    p_assigned_to,
    p_department,
    p_office_location,
    p_assigned_by,
    p_assigned_at,
    p_assignment_notes,
    true
  );

  -- 3. Update asset state
  UPDATE assets
  SET status = p_new_status,
      assignment_type = p_new_assignment_type,
      department = p_department,
      office_location = p_office_location
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql;
;
