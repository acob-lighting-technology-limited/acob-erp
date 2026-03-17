-- Add "Site" to office location constraints

-- Update profiles table constraint
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
    'Site',
    'Technical',
    'Technical Extension'
  )
);

-- Update assets table constraint
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_office_location_check;

ALTER TABLE assets
ADD CONSTRAINT assets_office_location_check
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
    'Site',
    'Technical',
    'Technical Extension'
  )
);;
