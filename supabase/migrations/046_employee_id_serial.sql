-- Function to generate next global serial number for employees
-- This ignores the year for the sequence, ensuring the serial number is globally unique and increasing
-- Format: ACOB/YYYY/NNN where NNN is the serial
-- Example: 
-- ACOB/2025/050 -> Next is ACOB/2026/051 (if year is 2026)
-- ACOB/2025/050 -> Next is ACOB/2025/051 (if year is 2025)

CREATE OR REPLACE FUNCTION get_next_employee_serial()
RETURNS TEXT AS $$
DECLARE
  next_serial INTEGER;
  serial_str TEXT;
BEGIN
  -- Find the highest serial number across ALL employees
  -- We extract the last part of the string (after the last /)
  SELECT COALESCE(MAX(
    CAST(
      NULLIF(regexp_replace(employee_number, '^.*\/([0-9]+)$', '\1'), employee_number) AS INTEGER
    )
  ), 0) + 1
  INTO next_serial
  FROM profiles
  WHERE employee_number LIKE 'ACOB/%/%';

  -- Format as 3-digit serial (001, 002, etc.)
  serial_str := LPAD(next_serial::TEXT, 3, '0');

  RETURN serial_str;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_employee_serial() TO authenticated;
