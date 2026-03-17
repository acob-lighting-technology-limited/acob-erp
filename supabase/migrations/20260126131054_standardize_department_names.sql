-- Update profiles table
UPDATE profiles
SET department = 'Business, Growth and Innovation'
WHERE department = 'Business Growth and Innovation';

-- Update asset_assignments table
UPDATE asset_assignments
SET department = 'Business, Growth and Innovation'
WHERE department = 'Business Growth and Innovation';

-- Update assets table
UPDATE assets
SET department = 'Business, Growth and Innovation'
WHERE department = 'Business Growth and Innovation';

-- Handle other non-standard departments if necessary
-- For now, focusing on the reported issue
;
