ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS setup_token text,
ADD COLUMN IF NOT EXISTS setup_token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS must_reset_password boolean DEFAULT false;;
