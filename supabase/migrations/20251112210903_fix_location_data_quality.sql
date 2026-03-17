
-- Fix Critical Location Field Data Quality Issues
-- This migration addresses phone numbers, emails, and job titles in location fields

-- Fix Lawrence Adukwu (phone in location)
UPDATE profiles
SET 
  current_work_location = 'Kagini, Hakim Avenue',
  updated_at = NOW()
WHERE company_email = 'a.lawrence@org.acoblighting.com';

-- Fix Abdulsamad Danmusa (email in site_name, phone in site_state, job title in location)
UPDATE profiles
SET 
  current_work_location = 'Office (Abuja)',
  site_name = 'Abuja Office',
  site_state = 'FCT',
  updated_at = NOW()
WHERE company_email = 'd.abdulsamad@org.acoblighting.com';

-- Fix Chibuikem Ilonze (email in site_name, phone in site_state)
UPDATE profiles
SET 
  site_name = 'Office',
  site_state = 'FCT',
  updated_at = NOW()
WHERE company_email = 'i.chibuikem@org.acoblighting.com';

-- Standardize "Abuja." to "Abuja" (remove trailing period)
UPDATE profiles
SET 
  current_work_location = 'Abuja',
  updated_at = NOW()
WHERE current_work_location = 'Abuja.';
;
