-- Create transactional function for assigning assets
DROP FUNCTION IF EXISTS assign_asset(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION assign_asset(
  p_asset_id uuid,
  p_assigned_to uuid,
  p_assigned_by uuid,
  p_assignment_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_assigned_to uuid;
BEGIN
  -- Lock any current assignments for this asset
  SELECT assigned_to
  INTO previous_assigned_to
  FROM asset_assignments
  WHERE asset_id = p_asset_id AND is_current = true
  ORDER BY assigned_at DESC
  LIMIT 1
  FOR UPDATE;

  -- Mark all existing assignments as not current
  UPDATE asset_assignments
  SET
    is_current = false,
    handed_over_at = NOW(),
    handover_notes = 'Reassigned via assign_asset()'
  WHERE asset_id = p_asset_id AND is_current = true;

  -- Insert the new assignment
  INSERT INTO asset_assignments (
    asset_id,
    assigned_to,
    assigned_from,
    assigned_by,
    assignment_notes,
    is_current
  )
  VALUES (
    p_asset_id,
    p_assigned_to,
    previous_assigned_to,
    p_assigned_by,
    p_assignment_notes,
    true
  );

  -- Ensure asset status is marked as assigned
  UPDATE assets
  SET status = 'assigned'
  WHERE id = p_asset_id;

  RETURN previous_assigned_to;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_asset(uuid, uuid, uuid, text) TO authenticated;

-- Grant execute permission to anon users (if needed for service role)
GRANT EXECUTE ON FUNCTION assign_asset(uuid, uuid, uuid, text) TO anon;
