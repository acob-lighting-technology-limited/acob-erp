-- Create transactional function for assigning devices
DROP FUNCTION IF EXISTS assign_device(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION assign_device(
  p_device_id uuid,
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
  -- Lock any current assignments for this device
  SELECT assigned_to
  INTO previous_assigned_to
  FROM device_assignments
  WHERE device_id = p_device_id AND is_current = true
  ORDER BY assigned_at DESC
  LIMIT 1
  FOR UPDATE;

  -- Mark all existing assignments as not current
  UPDATE device_assignments
  SET
    is_current = false,
    handed_over_at = NOW(),
    handover_notes = 'Reassigned via assign_device()'
  WHERE device_id = p_device_id AND is_current = true;

  -- Insert the new assignment
  INSERT INTO device_assignments (
    device_id,
    assigned_to,
    assigned_from,
    assigned_by,
    assignment_notes,
    is_current
  )
  VALUES (
    p_device_id,
    p_assigned_to,
    previous_assigned_to,
    p_assigned_by,
    p_assignment_notes,
    true
  );

  -- Ensure device status is marked as assigned
  UPDATE devices
  SET status = 'assigned'
  WHERE id = p_device_id;

  RETURN previous_assigned_to;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_device(uuid, uuid, uuid, text) TO authenticated;

-- Grant execute permission to anon users (if needed for service role)
GRANT EXECUTE ON FUNCTION assign_device(uuid, uuid, uuid, text) TO anon;

