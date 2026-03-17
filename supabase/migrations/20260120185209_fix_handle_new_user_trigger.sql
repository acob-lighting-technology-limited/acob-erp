-- Fix the handle_new_user function to use correct column names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, company_email, employment_status)
  VALUES (NEW.id, NEW.email, 'active');
  
  RETURN NEW;
END;
$function$;;
