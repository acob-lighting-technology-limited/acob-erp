-- Add email_notifications column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

-- Update RLS if needed (usually profiles are updatable by owner, so likely fine, but good to check)
-- Existing policies should cover update if they allow updating 'profiles' generally.
