-- Add office_location column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Add check constraint to match office locations from assets
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_office_location_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_office_location_check
CHECK (
  office_location IS NULL OR
  office_location IN (
    'Accounts',
    'Admin & HR',
    'Assistant Executive Director',
    'Business, Growth and Innovation',
    'General Conference Room',
    'IT and Communications',
    'Kitchen',
    'Legal, Regulatory and Compliance',
    'MD Conference Room',
    'MD Office',
    'Operations',
    'Reception',
    'Technical',
    'Technical Extension'
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_office_location ON profiles(office_location);;
