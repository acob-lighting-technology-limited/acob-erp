
-- Create a unique partial index to ensure only one current assignment per device
CREATE UNIQUE INDEX unique_current_device_assignment 
ON device_assignments (device_id) 
WHERE is_current = true;
;
