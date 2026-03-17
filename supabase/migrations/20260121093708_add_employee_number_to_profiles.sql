-- Add employee_number column to profiles table
-- Format: ACOB/{YEAR}/{SERIAL} e.g., ACOB/2026/058

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS employee_number TEXT;

-- Add unique constraint to ensure no duplicate employee numbers
ALTER TABLE profiles
ADD CONSTRAINT profiles_employee_number_key UNIQUE (employee_number);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_employee_number ON profiles(employee_number);

-- Add comment explaining the format
COMMENT ON COLUMN profiles.employee_number IS 'Unique employee identifier in format: ACOB/{YEAR}/{SERIAL} e.g., ACOB/2026/058';;
