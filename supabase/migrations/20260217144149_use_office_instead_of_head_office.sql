ALTER TABLE profiles DROP CONSTRAINT profiles_office_location_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_office_location_check 
CHECK (office_location IS NULL OR (office_location = ANY (ARRAY[
    'Accounts'::text, 
    'Admin & HR'::text, 
    'Assistant Executive Director'::text, 
    'Business, Growth and Innovation'::text, 
    'General Conference Room'::text, 
    'IT and Communications'::text, 
    'Kitchen'::text, 
    'Legal, Regulatory and Compliance'::text, 
    'MD Conference Room'::text, 
    'MD Office'::text, 
    'Operations'::text, 
    'Reception'::text, 
    'Site'::text, 
    'Technical'::text, 
    'Technical Extension'::text,
    'Office'::text
])));

-- Also update pending_users to use 'Office' if it was 'Head Office'
UPDATE pending_users SET office_location = 'Office' WHERE office_location = 'Head Office';
;
