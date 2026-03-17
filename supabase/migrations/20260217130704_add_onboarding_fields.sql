-- 1. Add extra columns to pending_users for the form
ALTER TABLE public.pending_users 
ADD COLUMN IF NOT EXISTS personal_email TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT,
ADD COLUMN IF NOT EXISTS additional_phone_number TEXT,
ADD COLUMN IF NOT EXISTS site_location TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT, -- ensure it exists
ADD COLUMN IF NOT EXISTS residential_address TEXT, -- ensure it exists
ADD COLUMN IF NOT EXISTS current_work_location TEXT; -- ensure it exists

-- 2. Add personal_email to profiles for long-term storage
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS personal_email TEXT;

-- 3. Ensure RLS policies
-- Allow ANON to INSERT into pending_users (for public form)
DROP POLICY IF EXISTS "Enable insert for anon users" ON public.pending_users;
CREATE POLICY "Enable insert for anon users" ON public.pending_users
FOR INSERT TO anon
WITH CHECK (true);

-- Allow ADMINs to SELECT/DELETE (already likely exists, but ensuring)
CREATE POLICY "Enable read for authenticated users only" ON public.pending_users
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Enable delete for authenticated users only" ON public.pending_users
FOR DELETE TO authenticated
USING (true);
;
