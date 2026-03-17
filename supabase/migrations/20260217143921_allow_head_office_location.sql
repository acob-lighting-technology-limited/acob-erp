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
    'Head Office'::text
])));;
