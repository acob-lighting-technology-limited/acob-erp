-- Add department_changed_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_changed_at DATE;

-- Create history table
CREATE TABLE IF NOT EXISTS public.employee_department_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_department TEXT,
  new_department TEXT NOT NULL,
  changed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for history table
ALTER TABLE public.employee_department_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read department history
CREATE POLICY "Profiles select policy" 
ON public.employee_department_history FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins to insert department history
-- Borrowing logic from profiles update policy
CREATE POLICY "Admins can insert department history" 
ON public.employee_department_history FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS ( 
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role::text = ANY (ARRAY['admin', 'super_admin']::text[]))
  )
);
;
