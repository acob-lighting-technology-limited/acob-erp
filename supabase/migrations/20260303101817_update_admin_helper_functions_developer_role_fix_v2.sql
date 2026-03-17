-- Update admin helper functions to include 'developer' role

-- Update is_admin() to include 'developer' role as a secondary check
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() 
      and (is_admin = true OR role = 'developer')
  );
$function$;

-- Update is_admin_like() to include 'developer'
CREATE OR REPLACE FUNCTION public.is_admin_like()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'developer')
  );
$function$;

-- Update correspondence_is_admin() to include 'developer'
CREATE OR REPLACE FUNCTION public.correspondence_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'developer')
  );
$function$;

-- Update help_desk_is_admin() to include 'developer'
CREATE OR REPLACE FUNCTION public.help_desk_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin', 'developer')
  );
$function$;
;
