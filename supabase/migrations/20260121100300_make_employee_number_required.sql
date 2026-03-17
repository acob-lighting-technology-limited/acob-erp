-- Make employee_number NOT NULL for new records
-- Note: Existing NULL values need to be updated first before enforcing NOT NULL
-- For now, we'll just ensure the constraint exists and validation is handled at app level

-- Add a CHECK constraint to ensure employee_number follows the format
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_employee_number_format;

-- Add format validation for employee_number (ACOB/YEAR/NUMBER pattern)
ALTER TABLE profiles
ADD CONSTRAINT profiles_employee_number_format 
CHECK (
  employee_number IS NULL OR 
  employee_number ~ '^ACOB/[0-9]{4}/[0-9]{3}$'
);

COMMENT ON COLUMN profiles.employee_number IS 'Unique employee identifier in format: ACOB/{YEAR}/{SERIAL} e.g., ACOB/2026/058. Required for new employees.';;
