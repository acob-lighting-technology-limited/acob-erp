
-- Fix SECURITY DEFINER views → SECURITY INVOKER
-- These views were running with creator permissions, bypassing RLS entirely.
ALTER VIEW public.employee_directory SET (security_invoker = true);
ALTER VIEW public.profiles_public SET (security_invoker = true);
ALTER VIEW public.unified_work SET (security_invoker = true);
;
