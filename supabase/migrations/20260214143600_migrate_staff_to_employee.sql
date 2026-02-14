-- Migration to update 'staff' role to 'employee'
-- This ensures compatibility with the updated codebase where 'staff' has been replaced by 'employee'

-- 1. Add 'employee' to user_role enum if it doesn't match
-- Note: schema alterations to enums cannot run in a transaction block with data updates using the new value in some older Postgres versions,
-- but usually works in newer ones. Using separate statements is safer if running manually.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';

-- 2. Update existing profiles
UPDATE profiles 
SET role = 'employee'::user_role 
WHERE role::text = 'staff';

-- 3. Update the default value for future inserts
ALTER TABLE profiles 
ALTER COLUMN role 
SET DEFAULT 'employee'::user_role;
