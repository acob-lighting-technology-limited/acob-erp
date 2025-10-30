-- Quick diagnostic queries to check admin access and feedback visibility

-- 1. Check if your user is admin (replace YOUR_USER_ID with your actual auth user ID)
-- Run this query and check if is_admin is true
SELECT id, company_email, is_admin 
FROM public.profiles 
WHERE id = auth.uid();

-- 2. Check if any feedback exists
SELECT COUNT(*) as total_feedback 
FROM public.feedback;

-- 3. Check if you can see feedback as admin
SELECT f.*, p.first_name, p.last_name, p.company_email
FROM public.feedback f
LEFT JOIN public.profiles p ON p.id = f.user_id
ORDER BY f.created_at DESC
LIMIT 10;

-- 4. Check if the is_admin() function exists and works
SELECT public.is_admin() as is_current_user_admin;

-- 5. List all RLS policies on feedback table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'feedback';

-- 6. List all RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';




